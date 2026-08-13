import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUploadOutlined, UploadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  TreeSelect,
  Typography,
  Upload,
} from "antd";
import { toast } from "react-toastify";
import { getCategories } from "../../../api/categoryApi.js";
import { getTags } from "../../../api/tagApi.js";
import { getApiErrorMessage } from "../../../utils/response.js";
import { formatFileSize } from "../utils/documentFormatters.js";
import { useBatchUploadDocuments } from "../hooks/useBatchUploadDocuments.js";
import { useUserDashboard } from "../../dashboard/hooks/useUserDashboard.js";
import { useAuthStore } from "../../../store/authStore.js";
import styles from "./UploadDocumentPage.module.css";

const { Text } = Typography;
const { Dragger } = Upload;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "tiff",
];
const DANGEROUS_EXTENSIONS = [
  "exe",
  "sh",
  "bat",
  "cmd",
  "js",
  "html",
  "htm",
  "jar",
  "msi",
  "ps1",
  "vbs",
];

function getExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function defaultTitle(fileName) {
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName;
}

function validateFile(file) {
  const extension = getExtension(file.name);
  if (file.size > MAX_FILE_SIZE) return "Kích thước file tối đa là 50MB.";
  if (DANGEROUS_EXTENSIONS.includes(extension))
    return "Định dạng file này không được phép upload.";
  if (!ALLOWED_EXTENSIONS.includes(extension))
    return "Chỉ hỗ trợ PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/TIFF.";
  return null;
}

function statusTag(status) {
  const meta = {
    queued: ["default", "Chờ upload"],
    uploading: ["processing", "Đang upload"],
    init_failed: ["error", "Lỗi khởi tạo"],
    upload_failed: ["error", "Lỗi upload"],
    completing: ["processing", "Đang xác nhận"],
    complete_failed: ["error", "Lỗi xác nhận"],
    processing: ["success", "Đang xử lý"],
  }[status || "queued"];
  return <Tag color={meta[0]}>{meta[1]}</Tag>;
}

function buildCategoryTree(categories, allowedIds) {
  const includedIds = new Set(allowedIds);
  const parentMap = new Map();
  categories.forEach((c) => parentMap.set(c.id, c.parentId));

  allowedIds.forEach((id) => {
    let currentId = parentMap.get(id);
    while (currentId) {
      includedIds.add(currentId);
      currentId = parentMap.get(currentId);
    }
  });

  const byId = new Map(
    categories
      .filter((c) => includedIds.has(c.id))
      .map((c) => [c.id, { ...c, children: [] }])
  );

  const roots = [];
  byId.forEach((node, id) => {
    const category = categories.find((c) => c.id === id);
    if (category?.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function buildTreeSelectData(tree, allowedIds) {
  return tree.map((node) => ({
    title: node.name,
    value: node.id,
    selectable: allowedIds.includes(node.id),
    children:
      node.children?.length > 0 ? buildTreeSelectData(node.children, allowedIds) : [],
  }));
}

export default function UploadDocumentPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const uploadMutation = useBatchUploadDocuments();
  const [items, setItems] = useState([]);
  const [selectedClientItemId, setSelectedClientItemId] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [tagList, setTagList] = useState([]);
  const [isCategoryLoading, setCategoryLoading] = useState(false);
  const [isTagLoading, setTagLoading] = useState(false);
  const userDashboardQuery = useUserDashboard();
  const user = useAuthStore((state) => state.user);

  const allowedCategoryIds = useMemo(() => {
    if (user?.role === "ADMIN") {
      return categoryList.map((c) => c.id);
    }
    return userDashboardQuery.data?.permissionGroups
      ?.filter((g) => g.permissions?.includes("UPLOAD"))
      ?.map((g) => g.categoryId) || [];
  }, [userDashboardQuery.data, user, categoryList]);

  const categoryTreeData = useMemo(() => {
    const tree = buildCategoryTree(categoryList, allowedCategoryIds);
    return buildTreeSelectData(tree, allowedCategoryIds);
  }, [categoryList, allowedCategoryIds]);

  useEffect(() => {
    if (userDashboardQuery.isSuccess && allowedCategoryIds.length === 0) {
      Modal.warning({
        title: "Không có quyền upload",
        content: "Bạn không có quyền upload tài liệu cho bất kỳ danh mục nào. Vui lòng liên hệ quản trị viên.",
        onOk: () => navigate("/documents"),
      });
    }
  }, [userDashboardQuery.isSuccess, allowedCategoryIds.length, navigate]);

  const tagOptions = useMemo(
    () => tagList.map((tag) => ({ label: tag.name, value: tag.id })),
    [tagList],
  );

  useEffect(() => {
    async function fetchCategories() {
      setCategoryLoading(true);
      try {
        const data = await getCategories({ activeOnly: true });
        const list = Array.isArray(data)
          ? data
          : data?.content || data?.items || [];
        setCategoryList(list);
      } catch {
        setCategoryList([]);
      } finally {
        setCategoryLoading(false);
      }
    }

    async function fetchTags() {
      setTagLoading(true);
      try {
        const data = await getTags({ activeOnly: true });
        const list = Array.isArray(data)
          ? data
          : data?.content || data?.items || [];
        setTagList(list);
      } catch {
        setTagList([]);
      } finally {
        setTagLoading(false);
      }
    }

    fetchCategories();
    fetchTags();
  }, []);

  const filesByClientItemId = useMemo(
    () =>
      Object.fromEntries(items.map((item) => [item.clientItemId, item.file])),
    [items],
  );
  const selectedItem = useMemo(
    () =>
      items.find((item) => item.clientItemId === selectedClientItemId) ||
      items[0] ||
      null,
    [items, selectedClientItemId],
  );

  const uploadProps = {
    name: "file",
    multiple: true,
    fileList: items.map((item) => item.file),
    beforeUpload: (nextFile) => {
      const error = validateFile(nextFile);
      if (error) {
        toast.error(error);
        return Upload.LIST_IGNORE;
      }
      setItems((current) => {
        if (current.length >= MAX_BATCH_FILES) {
          toast.error(
            `Chỉ được upload tối đa ${MAX_BATCH_FILES} file mỗi batch.`,
          );
          return current;
        }
        const clientItemId = `${Date.now()}-${nextFile.uid || nextFile.name}`;
        if (!selectedClientItemId && current.length === 0) {
          setSelectedClientItemId(clientItemId);
        }
        return [
          ...current,
          {
            clientItemId,
            file: nextFile,
            title: defaultTitle(nextFile.name),
            categoryId: undefined,
            tagIds: [],
            effectiveDate: null,
            expiryDate: null,
            status: "queued",
            progress: 0,
          },
        ];
      });
      return false;
    },
    onRemove: (file) => {
      setItems((current) => {
        const next = current.filter((item) => item.file.uid !== file.uid);
        const removedItem = current.find((item) => item.file.uid === file.uid);
        if (removedItem?.clientItemId === selectedClientItemId) {
          setSelectedClientItemId(next[0]?.clientItemId || null);
        }
        return next;
      });
    },
  };

  function updateItem(clientItemId, patch) {
    setItems((current) =>
      current.map((item) =>
        item.clientItemId === clientItemId ? { ...item, ...patch } : item,
      ),
    );
  }

  async function handleSubmit() {
    if (!items.length) {
      toast.error("Vui lòng chọn ít nhất một file cần upload.");
      return;
    }

    if (items.some((item) => !item.title?.trim())) {
      toast.error("Tiêu đề tài liệu không được bỏ trống.");
      return;
    }

    if (items.some((item) => !item.categoryId)) {
      toast.error("Mỗi tài liệu phải chọn danh mục riêng.");
      return;
    }

    if (items.some((item) => item.effectiveDate && item.expiryDate && !item.expiryDate.isAfter(item.effectiveDate, "day"))) {
      toast.error("Ngày hết hạn phải sau ngày bắt đầu có hiệu lực.");
      return;
    }

    const firstItem = items[0];
    const payload = {
      categoryId: Number(firstItem.categoryId),
      tagIds: firstItem.tagIds?.map(Number),
      effectiveDate: firstItem.effectiveDate?.format("YYYY-MM-DD"),
      expiryDate: firstItem.expiryDate?.format("YYYY-MM-DD"),
      files: items.map((item) => ({
        clientItemId: item.clientItemId,
        fileName: item.file.name,
        fileSize: item.file.size,
        contentType: item.file.type || "application/octet-stream",
        title: item.title.trim(),
        categoryId: Number(item.categoryId),
        tagIds: item.tagIds?.map(Number),
        effectiveDate: item.effectiveDate?.format("YYYY-MM-DD"),
        expiryDate: item.expiryDate?.format("YYYY-MM-DD"),
      })),
    };

    try {
      const result = await uploadMutation.mutateAsync({
        payload,
        filesByClientItemId,
        onItemChange: updateItem,
      });
      const succeeded = result.complete?.succeeded || 0;
      const failed =
        (result.init?.failed || 0) +
        (result.uploadFailures?.length || 0) +
        (result.complete?.failed || 0);
      if (failed) {
        toast.warning(
          `Batch hoàn tất một phần: ${succeeded} thành công, ${failed} lỗi.`,
        );
      } else if (succeeded === items.length) {
        toast.success("Upload hoàn tất, tài liệu đang được xử lý.");
      } else {
        toast.warning(
          "Upload chưa hoàn tất, vui lòng kiểm tra trạng thái từng file.",
        );
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  const columns = [
    {
      title: "File",
      dataIndex: "file",
      render: (file) => (
        <div className={styles.fileCell}>
          <strong>{file.name}</strong>
          <span>{formatFileSize(file.size)}</span>
        </div>
      ),
    },
    {
      title: "Tiêu đề",
      dataIndex: "title",
      render: (value) => value || "—",
    },
    {
      title: "Danh mục",
      dataIndex: "categoryId",
      render: (value) => {
        const category = categoryList.find((item) => item.id === value);
        return category?.name || "Chưa chọn";
      },
    },
    {
      title: "Mã tài liệu",
      dataIndex: "documentCode",
      render: (value) => value || "Sẽ tự sinh sau upload",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (value, record) => (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {statusTag(value)}
          {(value === "uploading" ||
            value === "completing" ||
            value === "processing") && (
            <Progress percent={record.progress || 0} size="small" />
          )}
          {record.error && <Text type="danger">{record.error}</Text>}
        </Space>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <span className={styles.eyebrow}>Upload cá nhân</span>
        <h1>Upload tài liệu mới</h1>
        <p>
          Tải một hoặc nhiều file lên hệ thống. Mỗi file có tiêu đề, danh mục,
          tags và thời gian hiệu lực riêng.
        </p>
      </header>

      {uploadMutation.isError && (
        <Alert
          className={styles.alert}
          type="error"
          showIcon
          message={getApiErrorMessage(uploadMutation.error)}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} className={styles.form}>
        <div className={styles.uploadGrid}>
          <section className={styles.uploadCard}>
            <Form.Item label={null} required>
              <Dragger
                {...uploadProps}
                disabled={uploadMutation.isPending}
                className={styles.dropZone}
              >
                <p className={styles.uploadIcon}>
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">Kéo thả tệp vào đây</p>
                <p className="ant-upload-hint">hoặc bấm để chọn tệp từ máy tính của bạn</p>
                <Button className={styles.chooseButton}>Chọn tệp</Button>
              </Dragger>
            </Form.Item>

            {!!items.length && (
              <div className={styles.fileQueue}>
                {items.map((item) => (
                  <button
                    className={`${styles.queueItem} ${selectedItem?.clientItemId === item.clientItemId ? styles.queueItemActive : ""}`}
                    key={item.clientItemId}
                    type="button"
                    onClick={() => setSelectedClientItemId(item.clientItemId)}
                    disabled={uploadMutation.isPending}
                  >
                    <div>
                      <strong>{item.file.name}</strong>
                      <span>
                        {formatFileSize(item.file.size)} · {statusTag(item.status)}
                      </span>
                      {(item.status === "uploading" ||
                        item.status === "completing" ||
                        item.status === "processing") && (
                        <Progress percent={item.progress || 0} size="small" />
                      )}
                      {item.error && <Text type="danger">{item.error}</Text>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className={styles.afterUploadCard}>
            <h2>Sau khi tải lên</h2>
            <ol>
              <li><span>1</span>Tài liệu được tải lên qua URL bảo mật</li>
              <li><span>2</span>Hệ thống trích xuất nội dung và OCR nếu cần</li>
              <li><span>3</span>Tài liệu chuyển sang trạng thái xử lý</li>
              <li><span>4</span>Bạn có thể theo dõi trong danh sách tài liệu</li>
            </ol>
          </aside>
        </div>

        <section className={styles.metadataCard}>
          <h2>Thông tin tài liệu</h2>
          {!!items.length && (
            <div className={styles.tableWrap}>
              <Table
                rowKey="clientItemId"
                columns={columns}
                dataSource={items}
                pagination={false}
                size="small"
                scroll={{ x: 760 }}
                rowClassName={(record) =>
                  selectedItem?.clientItemId === record.clientItemId
                    ? styles.selectedQueueRow
                    : ""
                }
                onRow={(record) => ({
                  onClick: () =>
                    !uploadMutation.isPending && setSelectedClientItemId(record.clientItemId),
                })}
              />
            </div>
          )}
          {selectedItem ? (
            <div className={styles.selectedFileHint}>
              Đang nhập thông tin cho: <strong>{selectedItem.file.name}</strong>
            </div>
          ) : (
            <div className={styles.selectedFileHint} style={{ color: '#8c8c8c', fontStyle: 'italic' }}>
              Vui lòng kéo thả hoặc chọn tệp ở khung bên trái trước để mở khoá form điền thông tin.
            </div>
          )}
          <div className={styles.formGrid}>
            <Form.Item label="Tiêu đề file đang chọn *">
              <Input
                placeholder="VD: Quy trình kiểm soát chất lượng"
                status={selectedItem && !selectedItem.title?.trim() ? "error" : undefined}
                disabled={uploadMutation.isPending || !selectedItem}
                value={selectedItem?.title || ""}
                onChange={(event) =>
                  selectedItem &&
                  updateItem(selectedItem.clientItemId, { title: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item label="Mã tài liệu">
              <Input value={selectedItem?.documentCode || "Sẽ tự sinh sau upload"} disabled />
            </Form.Item>
            <Form.Item label="Danh mục *">
              <TreeSelect
                allowClear
                showSearch
                treeDefaultExpandAll
                placeholder="Chọn danh mục"
                status={selectedItem && !selectedItem.categoryId ? "error" : undefined}
                value={selectedItem?.categoryId}
                treeData={categoryTreeData}
                loading={isCategoryLoading}
                treeLine
                disabled={uploadMutation.isPending || !selectedItem}
                onChange={(value) =>
                  selectedItem &&
                  updateItem(selectedItem.clientItemId, { categoryId: value })
                }
                filterTreeNode={(input, node) =>
                  node.title.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="Tags">
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="ISO, QA, quy trình"
                value={selectedItem?.tagIds || []}
                options={tagOptions}
                loading={isTagLoading}
                disabled={uploadMutation.isPending || !selectedItem}
                optionFilterProp="label"
                onChange={(value) =>
                  selectedItem &&
                  updateItem(selectedItem.clientItemId, { tagIds: value })
                }
              />
            </Form.Item>
            <Form.Item label="Ngày hiệu lực">
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="dd/mm/yyyy"
                value={selectedItem?.effectiveDate || null}
                disabled={uploadMutation.isPending || !selectedItem}
                onChange={(value) =>
                  selectedItem &&
                  updateItem(selectedItem.clientItemId, { effectiveDate: value })
                }
              />
            </Form.Item>
            <Form.Item
              label="Ngày hết hạn"
              validateStatus={
                selectedItem?.effectiveDate &&
                selectedItem?.expiryDate &&
                !selectedItem.expiryDate.isAfter(selectedItem.effectiveDate, "day")
                  ? "error"
                  : undefined
              }
              help={
                selectedItem?.effectiveDate &&
                selectedItem?.expiryDate &&
                !selectedItem.expiryDate.isAfter(selectedItem.effectiveDate, "day")
                  ? "Ngày hết hạn phải sau ngày bắt đầu có hiệu lực."
                  : undefined
              }
            >
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="dd/mm/yyyy"
                value={selectedItem?.expiryDate || null}
                disabled={uploadMutation.isPending || !selectedItem}
                onChange={(value) =>
                  selectedItem &&
                  updateItem(selectedItem.clientItemId, { expiryDate: value })
                }
              />
            </Form.Item>
          </div>
          <div className={styles.inlineActions}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<UploadOutlined />}
              loading={uploadMutation.isPending}
            >
              Tải lên & xử lý
            </Button>
            <Button onClick={() => navigate("/documents")} disabled={uploadMutation.isPending}>
              Huỷ
            </Button>
            <Button onClick={() => navigate("/documents")} disabled={uploadMutation.isPending}>
              Về danh sách
            </Button>
          </div>
        </section>
      </Form>
    </main>
  );
}
