import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Form, Input, Progress, Radio, Select, Space, Typography, Upload } from 'antd';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useUploadDocument } from '../hooks/useUploadDocument.js';
import styles from './UploadDocumentPage.module.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'tiff'];
const DANGEROUS_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'js', 'html', 'htm', 'jar', 'msi', 'ps1', 'vbs'];

function getExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function validateFile(file) {
  const extension = getExtension(file.name);
  if (file.size > MAX_FILE_SIZE) return 'Kích thước file tối đa là 50MB.';
  if (DANGEROUS_EXTENSIONS.includes(extension)) return 'Định dạng file này không được phép upload.';
  if (!ALLOWED_EXTENSIONS.includes(extension)) return 'Chỉ hỗ trợ PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/TIFF.';
  return null;
}

export default function UploadDocumentPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const uploadMutation = useUploadDocument();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('idle');
  const accessLevel = Form.useWatch('accessLevel', form) || 'DEPARTMENT';

  const uploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    beforeUpload: (nextFile) => {
      const error = validateFile(nextFile);
      if (error) {
        toast.error(error);
        return Upload.LIST_IGNORE;
      }
      setFile(nextFile);
      return false;
    },
    onRemove: () => {
      setFile(null);
      setProgress(0);
    },
  };

  async function handleSubmit(values) {
    if (!file) {
      toast.error('Vui lòng chọn file cần upload.');
      return;
    }

    const payload = {
      title: values.title,
      description: values.description,
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      tagIds: values.tagIds?.map(Number),
      accessLevel: values.accessLevel,
      departmentIds: values.departmentIds?.map(Number),
      sharedUserIds: values.sharedUserIds?.map(Number),
      effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
      expiryDate: values.expiryDate?.format('YYYY-MM-DD'),
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
    };

    try {
      const result = await uploadMutation.mutateAsync({
        payload,
        file,
        onProgress: setProgress,
        onStepChange: setStep,
      });
      toast.success('Upload hoàn tất, tài liệu đang được xử lý.');
      navigate(`/documents/${result.documentId}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <div className={styles.shell}>
      <main className={styles.mainArea}>
        <div className={styles.canvas}>
          <Card className={styles.container}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <div>
                <Title level={3}>Upload tài liệu mới</Title>
                <Text type="secondary">Tải file qua presigned URL và gửi metadata để worker xử lý sau upload.</Text>
              </div>

              {uploadMutation.isError && <Alert type="error" showIcon message={getApiErrorMessage(uploadMutation.error)} />}

              <Form
                form={form}
                layout="vertical"
                initialValues={{ accessLevel: 'DEPARTMENT' }}
                onFinish={handleSubmit}
              >
                <Form.Item label="File tài liệu" required>
                  <Dragger {...uploadProps} disabled={uploadMutation.isPending}>
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">Kéo thả file vào đây hoặc bấm để chọn file</p>
                    <p className="ant-upload-hint">PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/TIFF. Tối đa 50MB.</p>
                  </Dragger>
                </Form.Item>

                {uploadMutation.isPending && (
                  <Form.Item label={`Trạng thái: ${step}`}>
                    <Progress percent={step === 'completing' ? 100 : progress} />
                  </Form.Item>
                )}

                <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề.' }]}>
                  <Input placeholder="Nhập tiêu đề tài liệu" />
                </Form.Item>

                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={3} placeholder="Mô tả ngắn nội dung tài liệu" />
                </Form.Item>

                <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Vui lòng nhập ID danh mục.' }]}>
                  <Input placeholder="Nhập categoryId khi API danh mục chưa sẵn sàng" />
                </Form.Item>

                <Form.Item name="tagIds" label="Tags">
                  <Select mode="tags" placeholder="Nhập tagId rồi Enter" tokenSeparators={[',']} />
                </Form.Item>

                <Space size="middle" style={{ width: '100%' }} align="start">
                  <Form.Item name="effectiveDate" label="Ngày hiệu lực">
                    <DatePicker format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="expiryDate" label="Ngày hết hạn">
                    <DatePicker format="DD/MM/YYYY" />
                  </Form.Item>
                </Space>

                <Form.Item name="accessLevel" label="Quyền truy cập" rules={[{ required: true }]}>
                  <Radio.Group>
                    <Radio value="PUBLIC">Công khai</Radio>
                    <Radio value="DEPARTMENT">Theo phòng ban</Radio>
                    <Radio value="RESTRICTED">Giới hạn</Radio>
                  </Radio.Group>
                </Form.Item>

                {accessLevel === 'DEPARTMENT' && (
                  <Form.Item name="departmentIds" label="Phòng ban" rules={[{ required: true, message: 'Vui lòng nhập ít nhất một departmentId.' }]}>
                    <Select mode="tags" placeholder="Nhập departmentId rồi Enter" tokenSeparators={[',']} />
                  </Form.Item>
                )}

                {accessLevel === 'RESTRICTED' && (
                  <Form.Item name="sharedUserIds" label="Người được chia sẻ" rules={[{ required: true, message: 'Vui lòng nhập ít nhất một userId.' }]}>
                    <Select mode="tags" placeholder="Nhập userId rồi Enter" tokenSeparators={[',']} />
                  </Form.Item>
                )}

                <Space>
                  <Button onClick={() => navigate('/admin/documents')} disabled={uploadMutation.isPending}>
                    Hủy
                  </Button>
                  <Button type="primary" htmlType="submit" icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                    Upload
                  </Button>
                </Space>
              </Form>
            </Space>
          </Card>
        </div>
      </main>
    </div>
  );
}
