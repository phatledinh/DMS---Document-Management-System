import { useEffect, useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FilterOutlined,
  FolderOutlined,
  HistoryOutlined,
  InboxOutlined,
  MoreOutlined,
  SearchOutlined,
  TagOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import styles from './SearchPage.module.css';

const { Title, Text, Paragraph } = Typography;

const MOCK_DOCUMENTS = [
  {
    id: 'DOC-001',
    title: 'Quy trình kiểm soát tài liệu ISO 9001:2015',
    code: 'SOP-QA-001',
    category: 'iso',
    categoryLabel: 'ISO Standards',
    department: 'qa',
    departmentLabel: 'QA Department',
    fileType: 'pdf',
    status: 'approved',
    statusLabel: 'Approved',
    size: '2.4 MB',
    updatedAt: '12 Oct 2023',
    views: 150,
    tags: ['ISO 9001', 'Quy trình', 'QA'],
    snippet:
      'Tài liệu này quy định quy trình thống nhất trong việc soạn thảo, phê duyệt, ban hành, cập nhật và lưu trữ các tài liệu theo tiêu chuẩn ISO 9001 nhằm đảm bảo tính toàn vẹn của hệ thống quản lý chất lượng.',
    author: 'Phạm Minh Anh - QA Lead',
  },
  {
    id: 'DOC-002',
    title: 'Hướng dẫn đánh giá nội bộ theo ISO 27001',
    code: 'GUI-IT-042',
    category: 'sop',
    categoryLabel: 'SOP',
    department: 'it',
    departmentLabel: 'IT Security',
    fileType: 'docx',
    status: 'draft',
    statusLabel: 'Draft',
    size: '1.1 MB',
    updatedAt: '05 Nov 2023',
    views: 45,
    tags: ['ISO 27001', 'Quy trình', 'IT'],
    snippet:
      'Bản thảo hướng dẫn chi tiết các bước thực hiện đánh giá nội bộ định kỳ. Quy trình này áp dụng cho toàn bộ các phòng ban liên quan đến hệ thống quản lý an toàn thông tin ISO 27001.',
    author: 'Nguyễn Hoàng Nam - Security Officer',
  },
  {
    id: 'DOC-003',
    title: 'Sổ tay chất lượng ISO 2023',
    code: 'MAN-QA-001',
    category: 'iso',
    categoryLabel: 'ISO Standards',
    department: 'qa',
    departmentLabel: 'QA Department',
    fileType: 'pdf',
    status: 'archived',
    statusLabel: 'Archived',
    size: '5.8 MB',
    updatedAt: '10 Jan 2023',
    views: 890,
    tags: ['ISO', 'Quy trình', 'Archived'],
    snippet:
      'Sổ tay tổng hợp mô tả cấu trúc hệ thống, bao gồm sơ đồ tổ chức và danh mục các quy trình cốt lõi đáp ứng yêu cầu ISO. Tài liệu đã được thay thế bởi phiên bản 2024.',
    author: 'Trần Văn Bình - ISO Representative',
  },
  {
    id: 'DOC-004',
    title: 'Chính sách an toàn thông tin & Bảo mật dữ liệu doanh nghiệp',
    code: 'POL-IT-2024-002',
    category: 'policy',
    categoryLabel: 'Chính sách',
    department: 'it',
    departmentLabel: 'IT Security',
    fileType: 'pdf',
    status: 'approved',
    statusLabel: 'Approved',
    size: '3.2 MB',
    updatedAt: '15 Feb 2024',
    views: 412,
    tags: ['Chính sách', 'Bảo mật', 'IT'],
    snippet:
      'Chính sách tổng thể quy định mức độ truy cập dữ liệu, sao lưu an toàn và nghĩa vụ bảo mật thông tin đối với toàn thể cán bộ nhân viên.',
    author: 'Vũ Ngọc Mai - CISO',
  },
  {
    id: 'DOC-005',
    title: 'Quy trình xử lý sự cố an ninh mạng SOP-SEC-2024',
    code: 'SOP-SEC-009',
    category: 'sop',
    categoryLabel: 'SOP',
    department: 'it',
    departmentLabel: 'IT Security',
    fileType: 'docx',
    status: 'approved',
    statusLabel: 'Approved',
    size: '1.8 MB',
    updatedAt: '20 Mar 2024',
    views: 230,
    tags: ['SOP', 'An ninh', 'Sự cố'],
    snippet:
      'Hướng dẫn ứng phó nhanh khi phát hiện rủi ro hoặc tấn công an ninh mạng, các bước cô lập hệ thống và khôi phục dữ liệu theo quy trình.',
    author: 'Đỗ Đức Thắng - Incident Response Specialist',
  },
  {
    id: 'DOC-006',
    title: 'Báo cáo tài chính & Kiểm toán ngân sách 2023',
    code: 'BC-FIN-2023-01',
    category: 'policy',
    categoryLabel: 'Chính sách',
    department: 'finance',
    departmentLabel: 'Kế toán - Tài chính',
    fileType: 'xlsx',
    status: 'approved',
    statusLabel: 'Approved',
    size: '4.5 MB',
    updatedAt: '28 Dec 2023',
    views: 610,
    tags: ['Tài chính', 'Báo cáo'],
    snippet:
      'Báo cáo tổng kết thu chi năm 2023 được kiểm toán độc lập xác nhận tuân thủ chuẩn mực kế toán doanh nghiệp.',
    author: 'Lê Thu Trang - Kế toán trưởng',
  },
];

const SUGGESTED_TAGS = ['quy trình ISO', 'ISO 9001', 'SOP', 'Chính sách', 'Bảo mật'];

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial query params from URL
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('relevance');

  // Facet Sidebar Filters
  const initialCategory = searchParams.get('category');
  const [selectedCategories, setSelectedCategories] = useState(
    initialCategory ? [initialCategory] : ['iso', 'sop']
  );
  const [selectedFileTypes, setSelectedFileTypes] = useState(
    searchParams.get('fileType') ? [searchParams.get('fileType')] : ['pdf']
  );
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateRange, setDateRange] = useState(null);

  // Pagination & Preview
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [previewDoc, setPreviewDoc] = useState(null);

  // Sync state if URL changes
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setKeyword(q);
    const cat = searchParams.get('category');
    if (cat) setSelectedCategories([cat]);
  }, [searchParams]);

  // Filter Logic
  const filteredDocuments = useMemo(() => {
    return MOCK_DOCUMENTS.filter((doc) => {
      const kw = keyword.trim().toLowerCase();
      const matchKeyword =
        !kw ||
        doc.title.toLowerCase().includes(kw) ||
        doc.code.toLowerCase().includes(kw) ||
        doc.snippet.toLowerCase().includes(kw) ||
        doc.tags.some((t) => t.toLowerCase().includes(kw));

      const matchCat =
        selectedCategories.length === 0 || selectedCategories.includes(doc.category);
      const matchType =
        selectedFileTypes.length === 0 || selectedFileTypes.includes(doc.fileType);
      const matchStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(doc.status);

      return matchKeyword && matchCat && matchType && matchStatus;
    });
  }, [keyword, selectedCategories, selectedFileTypes, selectedStatuses]);

  // Sorted List
  const sortedDocuments = useMemo(() => {
    const docs = [...filteredDocuments];
    if (sortBy === 'newest') {
      return docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    if (sortBy === 'views') {
      return docs.sort((a, b) => b.views - a.views);
    }
    return docs;
  }, [filteredDocuments, sortBy]);

  // Paginated List
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDocuments.slice(start, start + pageSize);
  }, [sortedDocuments, currentPage]);

  const handleResetFilters = () => {
    setKeyword('');
    setSelectedCategories([]);
    setSelectedFileTypes([]);
    setSelectedStatuses([]);
    setDateRange(null);
    setCurrentPage(1);
    setSearchParams({});
    toast.info('Đã xóa tất cả bộ lọc');
  };

  const handleDownload = (doc, e) => {
    if (e) e.stopPropagation();
    toast.success(`Đang tải xuống: ${doc.title}`);
  };

  const renderHighlightedText = (text, query) => {
    if (!query || !query.trim()) return text;
    const words = query.trim().split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className={styles.highlightTerm}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
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

  const renderStatusTag = (status) => {
    switch (status) {
      case 'approved':
        return (
          <Tag icon={<CheckCircleOutlined />} className={styles.statusApproved}>
            Approved
          </Tag>
        );
      case 'draft':
        return (
          <Tag icon={<ClockCircleOutlined />} className={styles.statusDraft}>
            Draft
          </Tag>
        );
      case 'archived':
        return (
          <Tag icon={<InboxOutlined />} className={styles.statusArchived}>
            Archived
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
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
      {/* Header Search Section */}
      <div className={`${styles.heroSection} ${styles.heroCompact}`}>
        <div className={styles.heroBackground} />
        <div className={styles.searchBoxWrapper}>
          <Input
            size="large"
            className={styles.searchInput}
            placeholder="Tìm kiếm tài liệu, quy trình ISO, mã tài liệu..."
            prefix={<SearchOutlined style={{ color: '#86909c', fontSize: 18, marginRight: 6 }} />}
            value={keyword}
            onChange={(e) => {
              const val = e.target.value;
              setKeyword(val);
              setCurrentPage(1);
              if (val) setSearchParams({ q: val });
              else setSearchParams({});
            }}
            allowClear
          />
        </div>

        <div className={styles.suggestions}>
          <span className={styles.suggestionLabel}>Gợi ý:</span>
          {SUGGESTED_TAGS.map((tag) => (
            <span
              key={tag}
              className={styles.suggestionTag}
              onClick={() => {
                setKeyword(tag);
                setSearchParams({ q: tag });
                setCurrentPage(1);
                toast.info(`Tìm kiếm: "${tag}"`);
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Main Layout Grid */}
      <Row gutter={[24, 24]}>
        {/* Left Sidebar: Filters & Facets */}
        <Col xs={24} md={8} lg={6}>
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTitle}>
                <FilterOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                BỘ LỌC
              </div>
              <Button type="link" size="small" danger onClick={handleResetFilters}>
                Xóa tất cả
              </Button>
            </div>

            {/* Category */}
            <div className={styles.facetSection}>
              <div className={styles.facetTitle}>Danh mục</div>
              <Checkbox.Group
                className={styles.facetCheckboxGroup}
                value={selectedCategories}
                onChange={(vals) => {
                  setSelectedCategories(vals);
                  setCurrentPage(1);
                }}
              >
                <div className={styles.facetRow}>
                  <Checkbox value="iso">ISO Standards</Checkbox>
                  <span className={styles.facetCountBadge}>8</span>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="sop">SOP Quy trình</Checkbox>
                  <span className={styles.facetCountBadge}>15</span>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="policy">Chính sách</Checkbox>
                  <span className={styles.facetCountBadge}>3</span>
                </div>
              </Checkbox.Group>
            </div>

            {/* File Type */}
            <div className={styles.facetSection}>
              <div className={styles.facetTitle}>Loại tệp</div>
              <Checkbox.Group
                className={styles.facetCheckboxGroup}
                value={selectedFileTypes}
                onChange={(vals) => {
                  setSelectedFileTypes(vals);
                  setCurrentPage(1);
                }}
              >
                <div className={styles.facetRow}>
                  <Checkbox value="pdf">
                    <Flex align="center" gap={6}>
                      <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                      PDF
                    </Flex>
                  </Checkbox>
                  <span className={styles.facetCountBadge}>10</span>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="docx">
                    <Flex align="center" gap={6}>
                      <FileWordOutlined style={{ color: '#1677ff' }} />
                      DOCX
                    </Flex>
                  </Checkbox>
                  <span className={styles.facetCountBadge}>2</span>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="xlsx">
                    <Flex align="center" gap={6}>
                      <FileExcelOutlined style={{ color: '#52c41a' }} />
                      XLSX
                    </Flex>
                  </Checkbox>
                  <span className={styles.facetCountBadge}>1</span>
                </div>
              </Checkbox.Group>
            </div>

            {/* Status */}
            <div className={styles.facetSection}>
              <div className={styles.facetTitle}>Trạng thái</div>
              <Checkbox.Group
                className={styles.facetCheckboxGroup}
                value={selectedStatuses}
                onChange={(vals) => {
                  setSelectedStatuses(vals);
                  setCurrentPage(1);
                }}
              >
                <div className={styles.facetRow}>
                  <Checkbox value="approved">Approved</Checkbox>
                  <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                    Hợp lệ
                  </Tag>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="draft">Draft</Checkbox>
                  <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
                    Bản thảo
                  </Tag>
                </div>
                <div className={styles.facetRow}>
                  <Checkbox value="archived">Archived</Checkbox>
                  <Tag style={{ margin: 0, fontSize: 11 }}>Lưu trữ</Tag>
                </div>
              </Checkbox.Group>
            </div>

            {/* Date Range */}
            <div className={styles.facetSection}>
              <div className={styles.facetTitle}>Thời gian cập nhật</div>
              <DatePicker.RangePicker
                style={{ width: '100%', borderRadius: 8 }}
                placeholder={['Từ ngày', 'Đến ngày']}
                value={dateRange}
                onChange={(val) => setDateRange(val)}
              />
            </div>
          </div>
        </Col>

        {/* Right Area: Results */}
        <Col xs={24} md={16} lg={18}>
          <div className={styles.resultsHeader}>
            <div>
              <Title level={4} className={styles.resultsHeadingTitle}>
                Kết quả cho:{' '}
                <span className={styles.searchTermText}>
                  "{keyword || 'Tất cả tài liệu'}"
                </span>
              </Title>
              <Text className={styles.resultsMetaText}>
                Tìm thấy {sortedDocuments.length} kết quả (45ms)
              </Text>
            </div>

            <Flex align="center" gap={12}>
              <Space.Compact>
                <Button
                  type={viewMode === 'list' ? 'primary' : 'default'}
                  icon={<UnorderedListOutlined />}
                  onClick={() => setViewMode('list')}
                />
                <Button
                  type={viewMode === 'grid' ? 'primary' : 'default'}
                  icon={<AppstoreOutlined />}
                  onClick={() => setViewMode('grid')}
                />
              </Space.Compact>

              <div className={styles.sortWrapper}>
                <Text style={{ fontSize: 13, color: '#86909c' }}>Sắp xếp theo:</Text>
                <Select
                  value={sortBy}
                  onChange={(val) => setSortBy(val)}
                  style={{ width: 140 }}
                  options={[
                    { value: 'relevance', label: 'Độ liên quan' },
                    { value: 'newest', label: 'Mới nhất' },
                    { value: 'views', label: 'Xem nhiều nhất' },
                  ]}
                />
              </div>
            </Flex>
          </div>

          {sortedDocuments.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: '36px 0' }}>
              <Empty
                description="Không tìm thấy tài liệu phù hợp"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={handleResetFilters}>
                  Xóa tất cả bộ lọc
                </Button>
              </Empty>
            </Card>
          ) : viewMode === 'list' ? (
            <div className={styles.resultsList}>
              {paginatedDocs.map((doc) => (
                <article
                  key={doc.id}
                  className={styles.resultListCard}
                  onClick={() => setPreviewDoc(doc)}
                >
                  <div className={styles.cardIconCol}>{renderFileIcon(doc.fileType)}</div>

                  <div className={styles.cardBodyCol}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <Title level={5} className={styles.cardTitle}>
                          {renderHighlightedText(doc.title, keyword)}
                        </Title>
                        <div className={styles.badgeRow}>
                          <span className={styles.codeBadge}>{doc.code}</span>
                          {renderStatusTag(doc.status)}
                        </div>
                      </div>
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

                    <Paragraph className={styles.snippetText}>
                      {renderHighlightedText(doc.snippet, keyword)}
                    </Paragraph>

                    <div className={styles.cardMetaFooter}>
                      <span className={styles.metaItem}>
                        <FolderOutlined />
                        {doc.departmentLabel}
                      </span>
                      <span className={styles.dotDivider} />
                      <span>{doc.size}</span>
                      <span className={styles.dotDivider} />
                      <span className={styles.metaItem}>
                        <CalendarOutlined />
                        {doc.updatedAt}
                      </span>
                      <span className={styles.dotDivider} />
                      <span className={styles.metaItem}>
                        <EyeOutlined />
                        {doc.views} lượt xem
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {paginatedDocs.map((doc) => (
                <Col xs={24} sm={12} lg={8} key={doc.id}>
                  <Card
                    className={styles.docCard}
                    bodyStyle={{
                      padding: 16,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <div className={styles.gridCardHeader}>
                      {renderFileIcon(doc.fileType)}
                      {renderStatusTag(doc.status)}
                    </div>

                    <Tooltip title={doc.title} mouseEnterDelay={0.5}>
                      <Text className={styles.gridDocTitle}>
                        {renderHighlightedText(doc.title, keyword)}
                      </Text>
                    </Tooltip>
                    <div className={styles.docCode}>{doc.code}</div>

                    <div className={styles.cardTags}>
                      {doc.tags.map((t) => (
                        <Tag key={t} color="blue" style={{ borderRadius: 12, fontSize: 11 }}>
                          {t}
                        </Tag>
                      ))}
                    </div>

                    <div className={styles.gridCardFooter}>
                      <span>{doc.size}</span>
                      <span>{doc.updatedAt}</span>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {sortedDocuments.length > 0 && (
            <div className={styles.paginationRow}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={sortedDocuments.length}
                onChange={(page) => setCurrentPage(page)}
                showSizeChanger={false}
              />
            </div>
          )}
        </Col>
      </Row>

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
          width={680}
        >
          <div className={styles.previewModalContent}>
            <div className={styles.modalMetaRow}>
              <Tag color="cyan">{previewDoc.categoryLabel}</Tag>
              <Tag color="geekblue">{previewDoc.departmentLabel}</Tag>
              {renderStatusTag(previewDoc.status)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                Cập nhật: {previewDoc.updatedAt}
              </Text>
            </div>

            <Paragraph style={{ background: '#f5f7fa', padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
              <strong>Tóm tắt nội dung:</strong> {previewDoc.snippet}
            </Paragraph>

            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <strong>Tác giả:</strong> {previewDoc.author}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <strong>Lượt xem:</strong> {previewDoc.views} lần
              </Text>
              <Flex align="center" gap={6}>
                <TagOutlined style={{ color: '#86909c' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <strong>Từ khóa:</strong>
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
