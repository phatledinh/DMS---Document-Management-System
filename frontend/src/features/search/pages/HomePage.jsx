import { useState } from 'react';
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
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import styles from './HomePage.module.css';

const { Title, Text, Paragraph } = Typography;

// Mock latest documents for the Home Page
const LATEST_DOCUMENTS = [
  {
    id: 'DOC-001',
    title: 'Quy trình ISO 9001 - QA',
    code: 'SOP-QA-2024-001',
    category: 'qa',
    categoryLabel: 'Kiểm soát chất lượng',
    departmentLabel: 'Phòng QA/QC',
    fileType: 'pdf',
    size: '2.5MB',
    updatedAt: '21/07/2024',
    tags: ['ISO 9001', 'QA'],
    description: 'Quy trình kiểm soát chất lượng chuẩn ISO 9001 năm 2024 dành cho bộ phận QA/QC.',
    author: 'Phạm Minh Anh - QA Lead',
  },
  {
    id: 'DOC-002',
    title: 'Hướng dẫn sử dụng phần mềm v2.0',
    code: 'HDSD-IT-2024-005',
    category: 'it',
    categoryLabel: 'Công nghệ thông tin',
    departmentLabel: 'Khối Công nghệ',
    fileType: 'docx',
    size: '1.2MB',
    updatedAt: '20/07/2024',
    tags: ['Hướng dẫn', 'DMS'],
    description: 'Sổ tay hướng dẫn thao tác chi tiết các chức năng tìm kiếm, phân quyền và lưu trữ tài liệu.',
    author: 'Nguyễn Hoàng Nam - System Admin',
  },
  {
    id: 'DOC-003',
    title: 'Báo cáo tài chính Quý 2/2024',
    code: 'BC-TC-2024-Q2',
    category: 'finance',
    categoryLabel: 'Tài chính - Kế toán',
    departmentLabel: 'Phòng Kế toán',
    fileType: 'xlsx',
    size: '4.8MB',
    updatedAt: '19/07/2024',
    tags: ['Báo cáo', 'Tài chính'],
    description: 'Báo cáo tổng kết thu chi, phân bổ ngân sách các dự án trọng điểm trong Quý 2 năm 2024.',
    author: 'Trần Thị Thu - Kế toán trưởng',
  },
  {
    id: 'DOC-004',
    title: 'Hợp đồng đối tác ABC',
    code: 'HĐ-PL-2024-089',
    category: 'legal',
    categoryLabel: 'Pháp chế',
    departmentLabel: 'Ban Pháp chế',
    fileType: 'pdf',
    size: '800KB',
    updatedAt: '18/07/2024',
    tags: ['Hợp đồng', 'Nội bộ'],
    description: 'Hợp đồng hợp tác kinh doanh và thỏa thuận bảo mật thông tin NDA với đối tác chiến lược ABC.',
    author: 'Lê Văn Cường - Chuyên viên Pháp chế',
  },
  {
    id: 'DOC-005',
    title: 'Danh sách nhân sự 2024',
    code: 'DS-NS-2024-012',
    category: 'hr',
    categoryLabel: 'Nhân sự',
    departmentLabel: 'Phòng Hành chính Nhân sự',
    fileType: 'docx',
    size: '150KB',
    updatedAt: '17/07/2024',
    tags: ['Nhân sự', 'Nội bộ'],
    description: 'Danh sách cơ cấu nhân sự, phòng ban và ma trận phân quyền hệ thống DMS 2024.',
    author: 'Vũ Ngọc Mai - Trưởng phòng HR',
  },
  {
    id: 'DOC-006',
    title: 'Sổ tay nhân viên',
    code: 'ST-NS-2024-001',
    category: 'hr',
    categoryLabel: 'Nhân sự',
    departmentLabel: 'Phòng Hành chính Nhân sự',
    fileType: 'pdf',
    size: '5.1MB',
    updatedAt: '15/07/2024',
    tags: ['Nội bộ', 'Sổ tay'],
    description: 'Sổ tay văn hóa doanh nghiệp, chế độ phúc lợi và các quy định làm việc chung.',
    author: 'Vũ Ngọc Mai - Trưởng phòng HR',
  },
];

const SUGGESTED_SEARCHES = ['ISO 9001', 'Quy trình', 'SOP'];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);

  const handleSearchSubmit = (value) => {
    const q = value !== undefined ? value : searchQuery;
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleDownload = (doc, e) => {
    if (e) e.stopPropagation();
    toast.success(`Đang tải xuống: ${doc.title}`);
  };

  const renderFileIcon = (fileType) => {
    switch (fileType) {
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
        <Title level={1} className={styles.heroTitle}>
          Central Document Repository
        </Title>
        <Paragraph className={styles.heroSubtitle}>
          Kho quản lý và tra cứu tài liệu tập trung cho toàn bộ doanh nghiệp
        </Paragraph>

        {/* Hero Search Box */}
        <div className={styles.searchBoxWrapper}>
          <Input
            size="large"
            className={styles.searchInput}
            placeholder="Nhập từ khóa tìm kiếm (tên tài liệu, mã, tags...)"
            prefix={<SearchOutlined style={{ color: '#86909c', fontSize: 20, marginRight: 8 }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={() => handleSearchSubmit()}
            allowClear
          />
        </div>

        {/* Search Suggestions */}
        <div className={styles.suggestions}>
          <span className={styles.suggestionLabel}>Gợi ý tìm kiếm:</span>
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

        <Row gutter={[16, 16]}>
          {LATEST_DOCUMENTS.map((doc) => (
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

                <Tooltip title={doc.title} mouseEnterDelay={0.5}>
                  <Text className={styles.docTitle}>{doc.title}</Text>
                </Tooltip>

                <div className={styles.cardTags}>
                  {doc.tags.map((t) => (
                    <Tag key={t} color="blue" style={{ borderRadius: 12, fontSize: 11 }}>
                      {t}
                    </Tag>
                  ))}
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.metaGroup}>
                    <span>{doc.size}</span>
                    <span className={styles.dotDivider} />
                    <span>{doc.updatedAt}</span>
                  </div>
                  <Tag style={{ margin: 0, fontSize: 11 }}>{doc.departmentLabel}</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
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
                  Mã tài liệu: {previewDoc.code}
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
              Tải xuống ({previewDoc.size})
            </Button>,
          ]}
          width={600}
        >
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <Tag color="cyan">{previewDoc.categoryLabel}</Tag>
              <Tag color="geekblue">{previewDoc.departmentLabel}</Tag>
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
                Ngày cập nhật: {previewDoc.updatedAt}
              </Text>
            </div>

            <Paragraph style={{ background: '#f5f7fa', padding: 12, borderRadius: 8, fontSize: 13 }}>
              <strong>Mô tả:</strong> {previewDoc.description}
            </Paragraph>

            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <strong>Người đăng:</strong> {previewDoc.author}
              </Text>
              <Flex align="center" gap={6}>
                <TagOutlined style={{ color: '#86909c' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <strong>Thẻ:</strong>
                </Text>
                {previewDoc.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </Flex>
            </Space>
          </div>
        </Modal>
      )}
    </div>
  );
}
