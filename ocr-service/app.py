import os
from io import BytesIO
from threading import Lock

import easyocr
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from vietocr.tool.config import Cfg
from vietocr.tool.predictor import Predictor

app = FastAPI(title="DMS VietOCR Service")
_predictor = None
_detector = None
_predictor_lock = Lock()
_detector_lock = Lock()


def get_predictor():
    global _predictor
    if _predictor is None:
        with _predictor_lock:
            if _predictor is None:
                config = Cfg.load_config_from_name(os.getenv("VIETOCR_CONFIG", "vgg_transformer"))
                config["device"] = os.getenv("VIETOCR_DEVICE", "cpu")
                model_path = os.getenv("VIETOCR_MODEL_PATH", "")
                if model_path:
                    config["weights"] = model_path
                _predictor = Predictor(config)
    return _predictor


def get_detector():
    global _detector
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                _detector = easyocr.Reader(["vi", "en"], gpu=os.getenv("EASYOCR_GPU", "false").lower() == "true", recognizer=False)
    return _detector


def box_bounds(box):
    xs = [point[0] for point in box]
    ys = [point[1] for point in box]
    return int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))


def sort_boxes(boxes):
    def key(box):
        left, top, right, bottom = box_bounds(box)
        height = max(1, bottom - top)
        return round(top / max(10, height)), left
    return sorted(boxes, key=key)


def expand(bounds, image_size, padding=4):
    left, top, right, bottom = bounds
    width, height = image_size
    return max(0, left - padding), max(0, top - padding), min(width, right + padding), min(height, bottom + padding)


def recognize_page(image):
    detector = get_detector()
    predictor = get_predictor()
    boxes = detector.detect(np.array(image), text_threshold=0.6, low_text=0.3, link_threshold=0.4)[0][0]
    lines = []
    for box in sort_boxes(boxes):
        crop_bounds = expand(box_bounds(box), image.size)
        crop = image.crop(crop_bounds)
        if crop.width < 8 or crop.height < 8:
            continue
        text = predictor.predict(crop).strip()
        if text:
            lines.append(text)
    if lines:
        return "\n".join(lines)
    return predictor.predict(image).strip()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    try:
        content = await file.read()
        image = Image.open(BytesIO(content)).convert("RGB")
        text = recognize_page(image)
        return {"text": text or "", "language": "vi", "engine": "EASYOCR_DETECTOR_VIETOCR"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
