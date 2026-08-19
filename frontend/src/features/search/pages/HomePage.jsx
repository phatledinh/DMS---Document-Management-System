import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Dropdown,
  Input,
  Empty,
  Row,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getDocuments, getDownloadUrl } from "../../../api/documentApi.js";
import { getPopularSearchKeywords, searchDocuments } from "../../../api/searchApi.js";
import {
  formatDateTime,
  formatFileSize,
  getPageContent,
  normalizeDocument,
} from "../../documents/utils/documentFormatters.js";
import styles from "./HomePage.module.css";

const { Title, Text, Paragraph } = Typography;

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "90", label: "90 ngày qua" },
];

function dateFromDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days));
  return date.toISOString().slice(0, 10);
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFileType, setSelectedFileType] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("");

  const latestDocumentsQuery = useQuery({
    queryKey: ["home-latest-documents"],
    queryFn: () => getDocuments({ page: 0, size: 6, sort: "createdAt,desc" }),
  });
  const latestDocuments = getPageContent(latestDocumentsQuery.data)
    .map(normalizeDocument)
    .filter(Boolean);
  const searchMetadataQuery = useQuery({
    queryKey: ["home-search-metadata"],
    queryFn: () => searchDocuments({ page: 0, size: 1, sort: "createdAt,desc" }),
  });
  const popularKeywordsQuery = useQuery({
    queryKey: ["home-popular-search-keywords"],
    queryFn: () => getPopularSearchKeywords({ limit: 5 }),
  });
  const facets = searchMetadataQuery.data?.facets || {};
  const popularKeywords = Array.isArray(popularKeywordsQuery.data)
    ? popularKeywordsQuery.data.map((item) => item.keyword).filter(Boolean)
    : [];
  const facetOptions = (items = []) => items.map((item) => ({
    value: item.value,
    label: item.count === undefined ? item.label : `${item.label} (${item.count})`,
  }));

  const handleSearchSubmit = (value) => {
    const q = value !== undefined ? value : searchQuery;
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    } else {
      navigate("/search");
    }
  };

  const handleDownload = async (doc, e) => {
    if (e) e.stopPropagation();
    try {
      const download = await getDownloadUrl(doc.id);
      window.location.href = download.downloadUrl || download.url;
    } catch {
      toast.error("Không thể tạo liên kết tải xuống tài liệu");
    }
  };

  const renderFileIcon = (fileType) => {
    switch (fileType?.toLowerCase()) {
      case "pdf":
        return (
          <div className={`${styles.iconBadge} ${styles.pdfBadge}`}>
            <FilePdfOutlined />
          </div>
        );
      case "docx":
        return (
          <div className={`${styles.iconBadge} ${styles.docxBadge}`}>
            <FileWordOutlined />
          </div>
        );
      case "xlsx":
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
      key: "preview",
      icon: <EyeOutlined />,
      label: "Xem chi tiết",
      onClick: () => navigate(`/documents/${doc.slug}`),
    },
    {
      key: "download",
      icon: <DownloadOutlined />,
      label: "Tải xuống",
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
          Nhập từ khóa, mã tài liệu hoặc tag — hệ thống chỉ hiển thị tài liệu
          bạn có quyền xem.
        </Paragraph>

        <div className={styles.searchCard}>
          <div className={styles.searchRow}>
            <Input
              size="large"
              className={styles.searchInput}
              placeholder="Nhập từ khóa tìm kiếm..."
              prefix={
                <SearchOutlined
                  style={{ color: "#647383", fontSize: 22, marginRight: 8 }}
                />
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => handleSearchSubmit()}
              allowClear
            />
            <Button
              type="primary"
              size="large"
              className={styles.searchButton}
              onClick={() => handleSearchSubmit()}
            >
              Tìm kiếm
            </Button>
          </div>

          <div className={styles.suggestions}>
            {popularKeywords.map((tag) => (
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
          <FilterOutlined style={{ color: "#1677ff", fontSize: 16 }} />
          <Select
            className={styles.filterSelect}
            placeholder="Danh mục"
            value={selectedCategory || undefined}
            onChange={(val) => {
              setSelectedCategory(val);
              navigate(val ? `/search?categoryId=${encodeURIComponent(val)}` : "/search");
            }}
            allowClear
            loading={searchMetadataQuery.isLoading}
            options={facetOptions(facets.categories)}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Loại file"
            value={selectedFileType || undefined}
            onChange={(val) => {
              setSelectedFileType(val);
              navigate(val ? `/search?fileType=${encodeURIComponent(val)}` : "/search");
            }}
            allowClear
            loading={searchMetadataQuery.isLoading}
            options={facetOptions(facets.fileTypes)}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Tags"
            value={selectedTag || undefined}
            onChange={(val) => {
              setSelectedTag(val);
              navigate(val ? `/search?tagId=${encodeURIComponent(val)}` : "/search");
            }}
            allowClear
            loading={searchMetadataQuery.isLoading}
            options={facetOptions(facets.tags)}
          />

          <Select
            className={styles.filterSelect}
            placeholder="Khoảng thời gian"
            value={selectedDateRange || undefined}
            onChange={(val) => {
              setSelectedDateRange(val);
              navigate(val ? `/search?dateFrom=${dateFromDaysAgo(val)}` : "/search");
            }}
            allowClear
            options={DATE_RANGE_OPTIONS}
          />
        </div>
      </div>

      {/* Latest Documents Section */}
      <div>
        <div className={styles.sectionHeader}>
          <Title level={3} className={styles.sectionTitle}>
            <HistoryOutlined style={{ color: "#1677ff", marginRight: 8 }} />
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
                    styles={{
                      body: {
                        padding: 18,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      },
                    }}
                    onClick={() => navigate(`/documents/${doc.slug}`)}
                  >
                    <div className={styles.cardHeader}>
                      {renderFileIcon(doc.fileType)}
                      <Dropdown
                        menu={{ items: getDropdownMenuItems(doc) }}
                        trigger={["click"]}
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

                    <Tooltip
                      title={doc.title || doc.fileName}
                      mouseEnterDelay={0.5}
                    >
                      <Text className={styles.docTitle}>
                        {doc.title || doc.fileName}
                      </Text>
                    </Tooltip>

                    <div className={styles.cardFooter}>
                      <div className={styles.metaGroup}>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span className={styles.dotDivider} />
                        <span>
                          {formatDateTime(doc.updatedAt || doc.createdAt)}
                        </span>
                      </div>
                      <Tag style={{ margin: 0, fontSize: 11 }}>
                        {doc.departmentName || doc.departmentId || "—"}
                      </Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty
              description={
                latestDocumentsQuery.isError
                  ? "Không thể tải tài liệu mới nhất"
                  : "Chưa có tài liệu"
              }
            />
          )}
        </Spin>
      </div>

    </div>
  );
}
