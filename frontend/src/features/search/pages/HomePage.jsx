import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FilterOutlined,
  HistoryOutlined,
  MoreOutlined,
  SearchOutlined,
  TagOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Flex,
  Input,
  Empty,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDocuments, getDownloadUrl } from '../../../api/documentApi.js';
import { formatDateTime, formatFileSize, getPageContent, normalizeDocument } from '../../documents/utils/documentFormatters.js';
import styles from './HomePage.module.css';

const { Title, Text, Paragraph } = Typography;

const SUGGESTED_SEARCHES = ['Quy trình ISO 9001', 'SOP-QA-001', 'Báo cáo tài chính', 'Hợp đồng', 'Biểu mẫu nhân sự'];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('');

  const [previewDoc, setPreviewDoc] = useState(null);
  const latestDocumentsQuery = useQuery({
    queryKey: ['home-latest-documents'],
    queryFn: () => getDocuments({ page: 0, size: 6, sort: 'createdAt,desc' }),
  });
  const latestDocuments = getPageContent(latestDocumentsQuery.data).map(normalizeDocument).filter(Boolean);

  const handleSearchSubmit = (value) => {
    const q = value !== undefined ? value : searchQuery;
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleDownload = async (doc, e) => {
    if (e) e.stopPropagation();
    try {
      const download = await getDownloadUrl(doc.id);
      window.location.href = download.downloadUrl || download.url;
    } catch {
      toast.error('Không thể tạo liên kết tải xuống tài liệu');
    }
  };

  const renderFileIcon = (fileType) => {
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return (
          <div className={`${styles.iconBadge} ${styles.pdfBadge}`}>
            <FilePdfOutlined />
          </div>
        );
      case 'docx':
        return (
          <div className={`${styles.iconBadge} ${styles.docxBadge}`}>
            <FileWordOutlined />
          </div>
        );
      case 'xlsx':
        return (
          <div className={`${styles.iconBadge} ${styles.xlsxBadge}`}>
            <FileExcelOutlined />
          </div>
        );
      default:
        return (
          <div className={`${styles.iconBadge} ${styles.defaultBadge}`}>
            <FileTextOutlined />
          </div>
        );
    }
  };

  const getDropdownMenuItems = (doc) => [
    {
      key: 'preview',
      icon: <EyeOutlined />,
      label: 'Xem chi tiết',
      onClick: () => setPreviewDoc(doc),
    },
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: 'Tải xuống',
      onClick: () => handleDownload(doc),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Hero Search Section */}
      <div className={styles.heroSection}>
        <div className={styles.heroBackground} />
        <div className={styles.heroBadge}>
          <SearchOutlined />
          <span>Tìm kiếm toàn văn</span>
        </div>
        <Title level={1} className={styles.heroTitle}>
          Tìm kiếm tài liệu
        </Title>
        <Paragraph className={styles.heroSubtitle}>
          Nhập từ khóa, mã tài liệu hoặc tag — hệ thống chỉ hiển thị tài liệu bạn có quyền xem.
        </Paragraph>

        <div className={styles.searchCard}>
          <div className={styles.searchRow}>
            <Input
              size="large"
              className={styles.searchInput}
              placeholder="Nhập từ khóa tìm kiếm..."
              prefix={<SearchOutlined style={{ color: '#647383', fontSize: 22, marginRight: 8 }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => handleSearchSubmit()}
              allowClear
            />
            <Button type="primary" size="large" className={styles.searchButton} onClick={() => handleSearchSubmit()}>
              Tìm kiếm
            </Button>
          </div>

          <div className={styles.suggestions}>
            {SUGGESTED_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.suggestionBtn}
                onClick={() => handleSearchSubmit(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Filter Bar */}
      <div className={styles.filterCard}>
        <div className={styles.filterBar}>
          <FilterOutlined style={{ color: '#1677ff', fontSize: 16 }} />
          <Select
            className={styles.filterSelect}
            placeholder="Danh mục"
            value={selectedCategory || undefined}
            onChange={(val) => {
              setSelectedCategory(val);
              navigate(`/search?category=${val || ''}`);
            }}
            allowClear
            options={[
              { value: 'hr', label: 'Nhân sự' },
              { value: 'it', label: 'Công nghệ' },
              { value: 'qa', label: 'QA/QC' },
              { value: 'finance', label: 'Tài chính' },
            ]}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Phòng ban"
            value={selectedDepartment || undefined}
            onChange={(val) => {
              setSelectedDepartment(val);
              navigate(`/search?department=${val || ''}`);
            }}
            allowClear
            options={[
              { value: 'qa', label: 'QA/QC' },
              { value: 'dev', label: 'Development' },
              { value: 'hr', label: 'Hành chính Nhân sự' },
            ]}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Loại file"
            value={selectedFileType || undefined}
            onChange={(val) => {
              setSelectedFileType(val);
              navigate(`/search?fileType=${val || ''}`);
            }}
            allowClear
            options={[
              { value: 'pdf', label: 'PDF' },
              { value: 'docx', label: 'DOCX' },
              { value: 'xlsx', label: 'XLSX' },
            ]}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Tags"
            value={selectedTag || undefined}
            onChange={(val) => {
              setSelectedTag(val);
              navigate(`/search?tag=${val || ''}`);
            }}
            allowClear
            options={[
              { value: 'iso', label: 'ISO' },
              { value: 'internal', label: 'Nội bộ' },
              { value: 'sop', label: 'SOP' },
            ]}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Khoảng thời gian"
            value={selectedDateRange || undefined}
            onChange={(val) => {
              setSelectedDateRange(val);
              navigate(`/search?dateRange=${val || ''}`);
            }}
            allowClear
            options={[
              { value: '7', label: '7 ngày qua' },
              { value: '30', label: '30 ngày qua' },
            ]}
          />
        </div>
      </div>

      {/* Latest Documents Section */}
      <div>
        <div className={styles.sectionHeader}>
          <Title level={3} className={styles.sectionTitle}>
            <HistoryOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            Tài liệu mới nhất
          </Title>
        </div>

        <Spin spinning={latestDocumentsQuery.isLoading}>
          {latestDocuments.length ? (
            <Row gutter={[16, 16]}>
              {latestDocuments.map((doc) => (
                <Col xs={24} sm={12} lg={8} key={doc.id}>
                  <Card
                    className={styles.docCard}
                    bodyStyle={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <div className={styles.cardHeader}>
                      {renderFileIcon(doc.fileType)}
                      <Dropdown
                        menu={{ items: getDropdownMenuItems(doc) }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          shape="circle"
                          icon={<MoreOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Dropdown>
                    </div>

                    <Tooltip title={doc.title || doc.fileName} mouseEnterDelay={0.5}>
                      <Text className={styles.docTitle}>{doc.title || doc.fileName}</Text>
                    </Tooltip>

                    <div className={styles.cardTags}>
                      {doc.status && (
                        <Tag color="blue" style={{ borderRadius: 12, fontSize: 11 }}>
                          {doc.status}
                        </Tag>
                      )}
                      {doc.visibility && (
                        <Tag style={{ borderRadius: 12, fontSize: 11 }}>
                          {doc.visibility}
                        </Tag>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <div className={styles.metaGroup}>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span className={styles.dotDivider} />
                        <span>{formatDateTime(doc.updatedAt || doc.createdAt)}</span>
                      </div>
                      <Tag style={{ margin: 0, fontSize: 11 }}>{doc.departmentName || doc.departmentId || '—'}</Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description={latestDocumentsQuery.isError ? 'Không thể tải tài liệu mới nhất' : 'Chưa có tài liệu'} />
          )}
        </Spin>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <Modal
          open={!!previewDoc}
          title={
            <Flex align="center" gap={10}>
              {renderFileIcon(previewDoc.fileType)}
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{previewDoc.title}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Mã tài liệu: {previewDoc.documentCode || '—'}
                </Text>
              </div>
            </Flex>
          }
          onCancel={() => setPreviewDoc(null)}
          footer={[
            <Button key="close" onClick={() => setPreviewDoc(null)}>
              Đóng
            </Button>,
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(previewDoc)}
            >
              Tải xuống ({formatFileSize(previewDoc.fileSize)})
            </Button>,
          ]}
          width={600}
        >
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <Tag color="cyan">{previewDoc.categoryName || previewDoc.categoryId || '—'}</Tag>
              <Tag color="geekblue">{previewDoc.departmentName || previewDoc.departmentId || '—'}</Tag>
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
                Ngày cập nhật: {formatDateTime(previewDoc.updatedAt || previewDoc.createdAt)}
              </Text>
            </div>

            <Paragraph style={{ background: '#f5f7fa', padding: 12, borderRadius: 8, fontSize: 13 }}>
              <strong>Mô tả:</strong> {previewDoc.description || 'Không có mô tả.'}
            </Paragraph>

            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <strong>Người đăng:</strong> {previewDoc.uploadedByName || previewDoc.uploadedBy || '—'}
              </Text>
              <Flex align="center" gap={6}>
                <TagOutlined style={{ color: '#86909c' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <strong>Trạng thái:</strong>
                </Text>
                <Tag>{previewDoc.status || '—'}</Tag>
              </Flex>
            </Space>
          </div>
        </Modal>
      )}
    </div>
  );
}
