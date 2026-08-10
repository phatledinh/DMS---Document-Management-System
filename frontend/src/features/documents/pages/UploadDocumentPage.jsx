import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Form, Input, Progress, Select, Space, Table, Tag, TreeSelect, Typography, Upload } from 'antd';
import { toast } from 'react-toastify';
import { getCategories } from '../../../api/categoryApi.js';
import { getTags } from '../../../api/tagApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { formatFileSize } from '../utils/documentFormatters.js';
import { useBatchUploadDocuments } from '../hooks/useBatchUploadDocuments.js';
import styles from './UploadDocumentPage.module.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'tiff'];
const DANGEROUS_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'js', 'html', 'htm', 'jar', 'msi', 'ps1', 'vbs'];

function getExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function defaultTitle(fileName) {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(0, index) : fileName;
}

function validateFile(file) {
  const extension = getExtension(file.name);
  if (file.size > MAX_FILE_SIZE) return 'Kích thước file tối đa là 50MB.';
  if (DANGEROUS_EXTENSIONS.includes(extension)) return 'Định dạng file này không được phép upload.';
  if (!ALLOWED_EXTENSIONS.includes(extension)) return 'Chỉ hỗ trợ PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/TIFF.';
  return null;
}

function statusTag(status) {
  const meta = {
    queued: ['default', 'Chờ upload'],
    uploading: ['processing', 'Đang upload'],
    init_failed: ['error', 'Lỗi khởi tạo'],
    upload_failed: ['error', 'Lỗi upload'],
    completing: ['processing', 'Đang xác nhận'],
    complete_failed: ['error', 'Lỗi xác nhận'],
    processing: ['success', 'Đang xử lý'],
  }[status || 'queued'];
  return <Tag color={meta[0]}>{meta[1]}</Tag>;
}

function buildCategoryTree(categories) {
  const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  byId.forEach((c) => {
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId).children.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

function buildTreeSelectData(tree) {
  return tree.map((node) => ({
    title: node.name,
    value: node.id,
    children: node.children?.length > 0 ? buildTreeSelectData(node.children) : [],
  }));
}

export default function UploadDocumentPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const uploadMutation = useBatchUploadDocuments();
  const [items, setItems] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [tagList, setTagList] = useState([]);
  const [isCategoryLoading, setCategoryLoading] = useState(false);
  const [isTagLoading, setTagLoading] = useState(false);

  const categoryTreeData = useMemo(() => {
    const tree = buildCategoryTree(categoryList);
    return buildTreeSelectData(tree);
  }, [categoryList]);

  const tagOptions = useMemo(
    () => tagList.map((tag) => ({ label: tag.name, value: tag.id })),
    [tagList],
  );

  useEffect(() => {
    async function fetchCategories() {
      setCategoryLoading(true);
      try {
        const data = await getCategories({ activeOnly: true });
        const list = Array.isArray(data) ? data : (data?.content || data?.items || []);
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
        const list = Array.isArray(data) ? data : (data?.content || data?.items || []);
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
    () => Object.fromEntries(items.map((item) => [item.clientItemId, item.file])),
    [items],
  );

  const uploadProps = {
    name: 'file',
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
          toast.error(`Chỉ được upload tối đa ${MAX_BATCH_FILES} file mỗi batch.`);
          return current;
        }
        const clientItemId = `${Date.now()}-${nextFile.uid || nextFile.name}`;
        return [...current, { clientItemId, file: nextFile, title: defaultTitle(nextFile.name), status: 'queued', progress: 0 }];
      });
      return false;
    },
    onRemove: (file) => {
      setItems((current) => current.filter((item) => item.file.uid !== file.uid));
    },
  };

  function updateItem(clientItemId, patch) {
    setItems((current) => current.map((item) => (item.clientItemId === clientItemId ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(values) {
    if (!items.length) {
      toast.error('Vui lòng chọn ít nhất một file cần upload.');
      return;
    }

    const payload = {
      files: items.map((item) => ({
        clientItemId: item.clientItemId,
        fileName: item.file.name,
        fileSize: item.file.size,
        contentType: item.file.type || 'application/octet-stream',
        title: item.title,
      })),
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      tagIds: values.tagIds?.map(Number),
      effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
      expiryDate: values.expiryDate?.format('YYYY-MM-DD'),
    };

    try {
      const result = await uploadMutation.mutateAsync({ payload, filesByClientItemId, onItemChange: updateItem });
      const succeeded = result.complete?.succeeded || 0;
      const failed = (result.init?.failed || 0) + (result.uploadFailures?.length || 0) + (result.complete?.failed || 0);
      if (failed) {
        toast.warning(`Batch hoàn tất một phần: ${succeeded} thành công, ${failed} lỗi.`);
      } else if (succeeded === items.length) {
        toast.success('Upload hoàn tất, tài liệu đang được xử lý.');
      } else {
        toast.warning('Upload chưa hoàn tất, vui lòng kiểm tra trạng thái từng file.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  const columns = [
    {
      title: 'File',
      dataIndex: 'file',
      render: (file) => (
        <div>
          <div>{file.name}</div>
          <Text type="secondary">{formatFileSize(file.size)}</Text>
        </div>
      ),
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      render: (value, record) => (
        <Input value={value} disabled={uploadMutation.isPending} onChange={(event) => updateItem(record.clientItemId, { title: event.target.value })} />
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {statusTag(value)}
          {(value === 'uploading' || value === 'completing' || value === 'processing') && <Progress percent={record.progress || 0} size="small" />}
          {record.error && <Text type="danger">{record.error}</Text>}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.shell}>
      <main className={styles.mainArea}>
        <div className={styles.canvas}>
          <Card className={styles.container}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <div>
                <Title level={3}>Upload tài liệu mới</Title>
                <Text type="secondary">Tải một hoặc nhiều file qua presigned URL và gửi metadata chung để worker xử lý sau upload.</Text>
              </div>

              {uploadMutation.isError && <Alert type="error" showIcon message={getApiErrorMessage(uploadMutation.error)} />}

              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item label="File tài liệu" required>
                  <Dragger {...uploadProps} disabled={uploadMutation.isPending}>
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">Kéo thả file vào đây hoặc bấm để chọn file</p>
                    <p className="ant-upload-hint">PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/TIFF. Tối đa 50MB/file, {MAX_BATCH_FILES} file/batch.</p>
                  </Dragger>
                </Form.Item>

                {!!items.length && (
                  <Form.Item label="Danh sách file">
                    <Table rowKey="clientItemId" columns={columns} dataSource={items} pagination={false} size="small" />
                  </Form.Item>
                )}

                <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Vui lòng chọn danh mục.' }]}>
                  <TreeSelect
                    allowClear
                    showSearch
                    treeDefaultExpandAll
                    placeholder="Chọn danh mục"
                    treeData={categoryTreeData}
                    loading={isCategoryLoading}
                    treeLine
                    filterTreeNode={(input, node) =>
                      node.title.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Form.Item name="tagIds" label="Tags">
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    placeholder="Chọn tags"
                    options={tagOptions}
                    loading={isTagLoading}
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Space size="middle" style={{ width: '100%' }} align="start">
                  <Form.Item name="effectiveDate" label="Ngày hiệu lực">
                    <DatePicker format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="expiryDate" label="Ngày hết hạn">
                    <DatePicker format="DD/MM/YYYY" />
                  </Form.Item>
                </Space>


                <Space>
                  <Button onClick={() => navigate('/admin/documents-admin')} disabled={uploadMutation.isPending}>
                    Hủy
                  </Button>
                  <Button type="primary" htmlType="submit" icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                    Upload
                  </Button>
                  <Button onClick={() => navigate('/admin/documents-admin')} disabled={uploadMutation.isPending}>
                    Về danh sách
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
