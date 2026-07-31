import { useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FolderOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  LeftOutlined,
  LockOutlined,
  ReloadOutlined,
  RightOutlined,
  TagOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Breadcrumb,
  Button,
  Divider,
  Flex,
  Modal,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import styles from './DocumentDetailPage.module.css';

const { Title, Text, Paragraph } = Typography;

// Mock Detail Data dictionary
const MOCK_DETAIL_DATA = {
  'DOC-001': {
    id: 'DOC-001',
    title: 'Quy trình kiểm soát tài liệu ISO 9001:2015',
    code: 'SOP-QA-001',
    rev: '1.2',
    status: 'INDEXED',
    category: 'ISO Standards',
    fileType: 'PDF',
    size: '2.4MB',
    totalPages: 25,
    tags: ['ISO', 'QA', 'Quality'],
    uploadDate: '12 Oct 2023',
    effectiveDate: '01 Jan 2024',
    views: 150,
    downloads: 45,
    uploader: 'Admin',
    accessLevel: 'DEPARTMENT',
    purposeText:
      'Quy trình này quy định phương pháp thống nhất để soạn thảo, xem xét, phê duyệt, ban hành, cập nhật, lưu trữ và hủy bỏ các tài liệu thuộc Hệ thống Quản lý Chất lượng (QMS) theo tiêu chuẩn ISO 9001:2015 nhằm đảm bảo:',
    purposeItems: [
      'Các tài liệu luôn phù hợp, đầy đủ và được cập nhật.',
      'Chỉ những phiên bản tài liệu hiện hành mới được sử dụng tại các vị trí làm việc.',
      'Ngăn ngừa việc sử dụng vô tình các tài liệu lỗi thời.',
    ],
    scopeText:
      'Áp dụng cho tất cả các tài liệu nội bộ và tài liệu nguồn gốc bên ngoài (như tiêu chuẩn quốc tế, quy định pháp luật, bản vẽ khách hàng) được kiểm soát bởi Hệ thống Quản lý Chất lượng của Deep Trust Corp.',
    versions: [
      { version: 'v1.2', date: '12 Oct 2023', author: 'Admin', current: true },
      { version: 'v1.1', date: '15 Jun 2022', author: 'System', current: false },
      { version: 'v1.0', date: '01 Jan 2021', author: 'Admin', current: false },
    ],
  },
};

export default function DocumentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Get document details or fallback to default DOC-001 mock
  const doc = MOCK_DETAIL_DATA[id] || MOCK_DETAIL_DATA['DOC-001'];

  // Viewer States
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Modals / Action States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadVersionOpen, setIsUploadVersionOpen] = useState(false);

  const handleDownload = () => {
    toast.success(`Đang tải xuống tài liệu: ${doc.title}`);
  };

  const handleRestoreVersion = (ver) => {
    toast.info(`Khôi phục về phiên bản ${ver.version} thành công!`);
  };

  const handleArchive = () => {
    Modal.confirm({
      title: 'Xác nhận lưu trữ tài liệu',
      content: `Bạn có chắc chắn muốn chuyển tài liệu "${doc.title}" sang trạng thái Lưu trữ (Archived)?`,
      okText: 'Lưu trữ',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => {
        toast.warning('Tài liệu đã được chuyển sang kho Lưu trữ');
      },
    });
  };

  const handleZoomIn = () => {
    if (zoomLevel < 150) setZoomLevel((prev) => prev + 10);
  };

  const handleZoomOut = () => {
    if (zoomLevel > 70) setZoomLevel((prev) => prev - 10);
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Top Header Navigation Bar */}
      <div className={styles.topBar}>
        <Flex align="center" gap={16}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ fontWeight: 500 }}
          >
            Quay lại kết quả
          </Button>
          <Divider type="vertical" />
          <Breadcrumb
            items={[
              { title: 'Tài liệu', href: '/documents' },
              { title: doc.category },
              { title: doc.code },
            ]}
          />
        </Flex>

        <Flex align="center" gap={12}>
          <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>
            Tải xuống ({doc.size})
          </Button>
        </Flex>
      </div>

      {/* Main Split Layout */}
      <div className={styles.splitLayout}>
        {/* Left Section: Document Previewer (75%) */}
        <section className={styles.previewerSection}>
          {/* Document Viewer Toolbar */}
          <div className={styles.viewerToolbar}>
            <div className={styles.docTitleBar}>
              <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
              <Text strong style={{ fontSize: 14 }} ellipsis title={doc.title}>
                {doc.title}
              </Text>
            </div>

            {/* Page Navigation Controls */}
            <Flex align="center" gap={4}>
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                disabled={currentPageNum <= 1}
                onClick={() => setCurrentPageNum((p) => p - 1)}
              />
              <Text type="secondary" style={{ fontSize: 12, padding: '0 8px' }}>
                Page {currentPageNum} of {doc.totalPages}
              </Text>
              <Button
                type="text"
                size="small"
                icon={<RightOutlined />}
                disabled={currentPageNum >= doc.totalPages}
                onClick={() => setCurrentPageNum((p) => p + 1)}
              />
            </Flex>

            {/* Zoom Controls */}
            <Flex align="center" gap={6}>
              <Tooltip title="Thu nhỏ">
                <Button
                  type="text"
                  size="small"
                  icon={<ZoomOutOutlined />}
                  onClick={handleZoomOut}
                />
              </Tooltip>
              <Text style={{ fontSize: 12, width: 44, textAlign: 'center' }}>{zoomLevel}%</Text>
              <Tooltip title="Phóng to">
                <Button
                  type="text"
                  size="small"
                  icon={<ZoomInOutlined />}
                  onClick={handleZoomIn}
                />
              </Tooltip>
              <Divider type="vertical" />
              <Tooltip title="Đặt lại kích thước chuẩn">
                <Button
                  type="text"
                  size="small"
                  onClick={handleResetZoom}
                  style={{ fontSize: 12 }}
                >
                  100%
                </Button>
              </Tooltip>
            </Flex>
          </div>

          {/* Paper Document Canvas */}
          <div className={styles.canvasContainer}>
            <div
              className={styles.paperCanvas}
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              {/* Paper Header */}
              <div className={styles.paperHeader}>
                <div>
                  <div className={styles.paperBrand}>DEEP TRUST CORP</div>
                  <div className={styles.paperSubBrand}>Quality Management System</div>
                </div>
                <div className={styles.paperMeta}>
                  <div>Doc No: {doc.code}</div>
                  <div style={{ color: '#86909c' }}>Rev: {doc.rev}</div>
                </div>
              </div>

              {/* Paper Body Simulation */}
              <div className={styles.paperBody}>
                <h2 className={styles.paperMainTitle}>
                  QUY TRÌNH KIỂM SOÁT TÀI LIỆU
                  <span className={styles.paperSubTitle}>ISO 9001:2015</span>
                </h2>

                <div className={styles.sectionHeader}>1. MỤC ĐÍCH (PURPOSE)</div>
                <div className={styles.sectionText}>{doc.purposeText}</div>
                <ul className={styles.paperList}>
                  {doc.purposeItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>

                <div className={styles.sectionHeader}>2. PHẠM VI ÁP DỤNG (SCOPE)</div>
                <div className={styles.sectionText}>{doc.scopeText}</div>
              </div>

              {/* Confidential Watermark */}
              <div className={styles.watermark}>CONFIDENTIAL</div>
            </div>
          </div>
        </section>

        {/* Right Section: Sidebar (25%) */}
        <aside className={styles.sidebarSection}>
          {/* 1. Document Info Header */}
          <div className={styles.docInfoHeader}>
            <div className={styles.badgeRow}>
              <Tag icon={<CheckCircleOutlined />} className={styles.statusIndexed}>
                {doc.status}
              </Tag>
              <span className={styles.docCodeBadge}>{doc.code}</span>
            </div>

            <Title level={4} className={styles.sidebarDocTitle}>
              {doc.title}
            </Title>

            <div className={styles.versionLevelRow}>
              <div className={styles.metaItemBlock}>
                <span className={styles.metaLabelSmall}>Phiên bản</span>
                <span className={styles.metaValSmall}>v{doc.rev}</span>
              </div>
              <Divider type="vertical" style={{ height: 28 }} />
              <div className={styles.metaItemBlock}>
                <span className={styles.metaLabelSmall}>Quyền truy cập</span>
                <Flex align="center" gap={4} className={styles.metaValSmall} style={{ color: '#d97706' }}>
                  <LockOutlined />
                  {doc.accessLevel}
                </Flex>
              </div>
            </div>
          </div>

          <div className={styles.sidebarContent}>
            {/* 2. Metadata Details */}
            <section>
              <div className={styles.sidebarBlockTitle}>
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
                Thông tin chi tiết (Metadata)
              </div>

              <div className={styles.metaDetailList}>
                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Danh mục</span>
                  <span className={styles.metaDetailVal}>
                    <FolderOutlined style={{ marginRight: 6, color: '#86909c' }} />
                    {doc.category}
                  </span>
                </div>

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Định dạng</span>
                  <span className={styles.metaDetailVal}>
                    <FilePdfOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
                    {doc.fileType} ({doc.size})
                  </span>
                </div>

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Tags</span>
                  <span className={styles.metaDetailVal}>
                    {doc.tags.map((t) => (
                      <Tag key={t} color="blue" style={{ fontSize: 11, marginBottom: 4 }}>
                        {t}
                      </Tag>
                    ))}
                  </span>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Ngày đăng</span>
                  <span className={styles.metaDetailVal}>{doc.uploadDate}</span>
                </div>

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Hiệu lực từ</span>
                  <span className={styles.metaDetailVal}>{doc.effectiveDate}</span>
                </div>

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Thống kê</span>
                  <Flex gap={12} className={styles.metaDetailVal}>
                    <span>
                      <EyeOutlined style={{ marginRight: 4 }} />
                      {doc.views} lượt xem
                    </span>
                    <span>
                      <DownloadOutlined style={{ marginRight: 4 }} />
                      {doc.downloads} lượt tải
                    </span>
                  </Flex>
                </div>

                <div className={styles.metaDetailRow}>
                  <span className={styles.metaDetailLabel}>Người đăng</span>
                  <Flex align="center" gap={6} className={styles.metaDetailVal}>
                    <Avatar size={22} style={{ backgroundColor: '#1677ff' }}>
                      {doc.uploader[0]}
                    </Avatar>
                    <span>{doc.uploader}</span>
                  </Flex>
                </div>
              </div>
            </section>

            {/* 3. Version History Timeline */}
            <section>
              <div className={styles.sidebarBlockTitle}>
                <HistoryOutlined style={{ color: '#1677ff' }} />
                Lịch sử phiên bản
              </div>

              <Timeline
                items={doc.versions.map((ver) => ({
                  color: ver.current ? '#1677ff' : '#d9d9d9',
                  children: (
                    <Flex align="center" justify="space-between">
                      <div>
                        <Text strong style={{ fontSize: 13 }}>
                          {ver.version}
                        </Text>{' '}
                        {ver.current && <Tag color="blue">Hiện tại</Tag>}
                        <div style={{ fontSize: 12, color: '#86909c' }}>
                          {ver.date} • {ver.author}
                        </div>
                      </div>
                      <Space size={4}>
                        <Tooltip title="Tải phiên bản này">
                          <Button
                            type="text"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload()}
                          />
                        </Tooltip>
                        {!ver.current && (
                          <Tooltip title="Khôi phục phiên bản này">
                            <Button
                              type="text"
                              size="small"
                              icon={<ReloadOutlined style={{ color: '#faad14' }} />}
                              onClick={() => handleRestoreVersion(ver)}
                            />
                          </Tooltip>
                        )}
                      </Space>
                    </Flex>
                  ),
                }))}
              />
            </section>
          </div>

          {/* 4. Action Buttons (Footer Fixed) */}
          <div className={styles.sidebarFooterActions}>
            <Button
              type="primary"
              size="large"
              block
              icon={<DownloadOutlined />}
              className={styles.downloadMainBtn}
              onClick={handleDownload}
            >
              Tải xuống tài liệu
            </Button>

            <Button
              icon={<EditOutlined />}
              block
              className={styles.actionSecondaryBtn}
              onClick={() => setIsEditModalOpen(true)}
            >
              Chỉnh sửa Metadata
            </Button>

            <Button
              icon={<UploadOutlined />}
              block
              className={styles.actionSecondaryBtn}
              onClick={() => setIsUploadVersionOpen(true)}
            >
              Tải lên phiên bản mới
            </Button>

            <Button
              danger
              icon={<InboxOutlined />}
              block
              className={styles.actionSecondaryBtn}
              onClick={handleArchive}
            >
              Lưu trữ tài liệu (Archive)
            </Button>
          </div>
        </aside>
      </div>

      {/* Edit Metadata Modal */}
      <Modal
        title="Chỉnh sửa thông tin Metadata"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={() => {
          setIsEditModalOpen(false);
          toast.success('Cập nhật Metadata thành công!');
        }}
        okText="Lưu thay đổi"
        cancelText="Hủy"
      >
        <p style={{ color: '#86909c', fontSize: 13 }}>
          Cho phép người dùng có quyền chỉnh sửa Tiêu đề, Mã tài liệu, Tags và Cấp độ truy cập.
        </p>
      </Modal>

      {/* Upload New Version Modal */}
      <Modal
        title="Tải lên phiên bản tài liệu mới"
        open={isUploadVersionOpen}
        onCancel={() => setIsUploadVersionOpen(false)}
        onOk={() => {
          setIsUploadVersionOpen(false);
          toast.success('Đã tải lên phiên bản mới v1.3 thành công!');
        }}
        okText="Tải lên"
        cancelText="Hủy"
      >
        <p style={{ color: '#86909c', fontSize: 13 }}>
          Tải lên tập tin mới (.pdf, .docx) để cập nhật phiên bản v1.3 cho hệ thống.
        </p>
      </Modal>
    </div>
  );
}
