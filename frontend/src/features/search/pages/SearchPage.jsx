import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Input, List, Pagination, Select, Space, Spin, Tag, Typography } from 'antd';
import DOMPurify from 'dompurify';
import { getApiErrorMessage } from '../../../utils/response.js';
import { useDocumentSearch } from '../hooks/useDocumentSearch.js';
import {
  formatDateTime,
  formatFileSize,
  getDocumentStatusMeta,
  getPageContent,
  normalizeDocument,
} from '../../documents/utils/documentFormatters.js';
import styles from './SearchPage.module.css';

const { Title, Text } = Typography;

function getHighlight(result) {
  const highlight = result.highlight || result.highlights;
  if (typeof highlight === 'string') return highlight;
  return highlight?.snippet || highlight?.content || result.snippet || result.description || '';
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const page = Number(searchParams.get('page') || 1);
  const pageSize = 10;

  const params = useMemo(
    () => ({
      q: searchParams.get('q') || undefined,
      page: page - 1,
      size: pageSize,
      sort: searchParams.get('sort') || 'relevance',
      fileType: searchParams.get('fileType') || undefined,
      status: searchParams.get('status') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
    }),
    [page, searchParams],
  );

  const searchQuery = useDocumentSearch(params);
  const results = getPageContent(searchQuery.data).map(normalizeDocument).filter(Boolean);
  const totalElements = searchQuery.data?.totalElements ?? searchQuery.data?.total ?? results.length;
  const searchTime = searchQuery.data?.searchTime;

  function updateParams(nextParams) {
    const next = new URLSearchParams(searchParams);
    Object.entries(nextParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  }

  function handleSearch() {
    updateParams({ q: keyword.trim(), page: 1 });
  }

  function handleFilterChange(key, value) {
    updateParams({ [key]: value, page: 1 });
  }

  return (
    <div className={styles.pageShell || ''}>
      <Card>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={3}>Tìm kiếm tài liệu</Title>
            <Text type="secondary">Tìm trong các tài liệu đã được lập chỉ mục và bạn có quyền truy cập.</Text>
          </div>

          <Flex gap={12} wrap="wrap">
            <Input.Search
              allowClear
              enterButton="Tìm kiếm"
              placeholder="Nhập từ khóa, mã tài liệu hoặc nội dung cần tìm"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={handleSearch}
              style={{ maxWidth: 560 }}
            />
            <Select
              allowClear
              placeholder="Loại file"
              value={searchParams.get('fileType') || undefined}
              onChange={(value) => handleFilterChange('fileType', value)}
              style={{ width: 160 }}
              options={[
                { value: 'PDF', label: 'PDF' },
                { value: 'DOCX', label: 'DOCX' },
                { value: 'XLSX', label: 'XLSX' },
                { value: 'IMAGE', label: 'Ảnh' },
              ]}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              value={searchParams.get('status') || undefined}
              onChange={(value) => handleFilterChange('status', value)}
              style={{ width: 180 }}
              options={[
                { value: 'INDEXED', label: 'Sẵn sàng' },
                { value: 'PROCESSING', label: 'Đang xử lý' },
                { value: 'EXTRACTION_FAILED', label: 'Lỗi trích xuất' },
              ]}
            />
          </Flex>

          {searchQuery.isError && <Alert type="error" showIcon message={getApiErrorMessage(searchQuery.error)} />}

          <Flex justify="space-between" align="center">
            <Text type="secondary">
              {totalElements} kết quả{searchTime ? ` trong ${searchTime} ms` : ''}
            </Text>
            <Select
              value={searchParams.get('sort') || 'relevance'}
              onChange={(value) => handleFilterChange('sort', value)}
              style={{ width: 180 }}
              options={[
                { value: 'relevance', label: 'Liên quan nhất' },
                { value: 'createdAt,desc', label: 'Mới nhất' },
                { value: 'title,asc', label: 'Tên A-Z' },
              ]}
            />
          </Flex>

          <Spin spinning={searchQuery.isLoading}>
            <List
              itemLayout="vertical"
              dataSource={results}
              locale={{ emptyText: <Empty description="Không có kết quả phù hợp" /> }}
              renderItem={(result) => {
                const statusMeta = getDocumentStatusMeta(result.status);
                const highlight = DOMPurify.sanitize(getHighlight(result), { ALLOWED_TAGS: ['em', 'mark'], ALLOWED_ATTR: [] });
                return (
                  <List.Item
                    actions={[
                      <Button key="detail" type="link" onClick={() => navigate(`/documents/${result.id}`)}>
                        Xem chi tiết
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined className={styles.resultIcon} />}
                      title={<Button type="link" onClick={() => navigate(`/documents/${result.id}`)}>{result.title || result.fileName}</Button>}
                      description={
                        <Space wrap>
                          <Text type="secondary">{result.documentCode || result.fileName || '—'}</Text>
                          <Text type="secondary">{formatFileSize(result.fileSize)}</Text>
                          <Text type="secondary">{formatDateTime(result.createdAt)}</Text>
                          {result.status && <Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
                        </Space>
                      }
                    />
                    {highlight ? (
                      <div className={styles.snippet} dangerouslySetInnerHTML={{ __html: highlight }} />
                    ) : (
                      <Text type="secondary">{result.description || 'Không có mô tả.'}</Text>
                    )}
                  </List.Item>
                );
              }}
            />
          </Spin>

          <Flex justify="flex-end">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={totalElements}
              showSizeChanger={false}
              onChange={(nextPage) => updateParams({ page: nextPage })}
            />
          </Flex>
        </Space>
      </Card>
    </div>
  );
}
