import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DownOutlined,
  FileSearchOutlined,
  FolderFilled,
  FolderOpenFilled,
  LockOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Empty, Input, Spin, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getCategories } from '../../../api/categoryApi.js';
import { searchDocuments } from '../../../api/searchApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import { formatDateTime, formatFileSize, getPageContent, normalizeDocument } from '../../documents/utils/documentFormatters.js';
import styles from './CategoriesUser.module.css';

const restrictedCategories = ['Báo cáo tài chính', 'Chính sách'];
const defaultPermissions = ['VIEW', 'DOWNLOAD'];

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function buildCategoryTree(categories) {
  const byId = new Map(categories.map((category) => [category.id, { ...category, children: [] }]));
  const roots = [];

  byId.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId).children.push(category);
    } else {
      roots.push(category);
    }
  });

  return roots;
}

function flattenTree(tree) {
  const rows = [];

  function walk(nodes, level = 0) {
    nodes.forEach((node) => {
      rows.push({ ...node, level });
      if (node.children?.length) walk(node.children, level + 1);
    });
  }

  walk(tree);
  return rows;
}

function collectAllIds(tree) {
  const ids = new Set();

  function walk(nodes) {
    nodes.forEach((node) => {
      if (node.children?.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    });
  }

  walk(tree);
  return ids;
}

function PermissionPills({ permissions = defaultPermissions }) {
  return (
    <div className={styles.permissionPills}>
      {permissions.map((permission) => (
        <span className={styles.permissionPill} key={permission}>{permission}</span>
      ))}
    </div>
  );
}

function CategoryNode({ item, level = 0, selectedId, expandedIds, onSelect, onToggle }) {
  const hasChildren = item.children?.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;

  return (
    <div className={styles.categoryNode}>
      <button
        type="button"
        className={`${styles.categoryCard} ${isSelected ? styles.activeCard : ''}`}
        style={{ '--category-level': level }}
        onClick={() => onSelect(item)}
      >
        <span
          role="button"
          tabIndex={hasChildren ? 0 : -1}
          className={hasChildren ? styles.chevronButton : styles.chevronPlaceholder}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) onToggle(item.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && hasChildren) {
              event.stopPropagation();
              onToggle(item.id);
            }
          }}
        >
          {hasChildren ? (isExpanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <div className={styles.categoryContentWrap}>
          <div className={styles.categoryHeader}>
            <div className={styles.categoryTitle}>
              {hasChildren && isExpanded ? <FolderOpenFilled /> : <FolderFilled />}
              <strong>{item.name}</strong>
            </div>
            <span>{item.children?.length || 0} danh mục con</span>
          </div>
          <PermissionPills permissions={item.permissions || defaultPermissions} />
        </div>
      </button>
      {hasChildren && isExpanded && (
        <div className={styles.children}>
          {item.children.map((child) => (
            <CategoryNode
              key={child.id}
              item={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentItem({ doc, onOpen }) {
  const canOpen = Boolean(doc.id);

  return (
    <button
      type="button"
      className={styles.documentItem}
      disabled={!canOpen}
      onClick={() => canOpen && onOpen(doc.id)}
    >
      <FileSearchOutlined className={styles.documentIcon} />
      <div className={styles.documentMain}>
        <strong>{doc.title || doc.fileName}</strong>
        <span>{doc.documentCode || '—'} · {formatFileSize(doc.fileSize)} · {formatDateTime(doc.updatedAt || doc.createdAt)}</span>
      </div>
      <span className={styles.statusPill}>{doc.status || 'Sẵn sàng'}</span>
    </button>
  );
}

export default function CategoriesUser() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [documents, setDocuments] = useState([]);
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const selectedCategory = useMemo(() => {
    return flatCategories.find((category) => category.id === selectedCategoryId) || flatCategories[0] || null;
  }, [flatCategories, selectedCategoryId]);

  const filteredCategories = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return [];
    return flatCategories.filter((category) => [category.name, category.slug, category.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)));
  }, [filterText, flatCategories]);

  const handleToggle = useCallback((id) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((category) => {
    setSelectedCategoryId(category.id);
    if (category.children?.length) {
      setExpandedIds((current) => new Set(current).add(category.id));
    }
  }, []);

  useEffect(() => {
    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        const data = await getCategories({ activeOnly: true });
        const list = normalizeList(data);
        const tree = buildCategoryTree(list);
        setCategories(list);
        setSelectedCategoryId((currentId) => {
          if (currentId && list.some((category) => category.id === currentId)) return currentId;
          return list[0]?.id || null;
        });
        setExpandedIds(collectAllIds(tree));
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        setCategories([]);
        setSelectedCategoryId(null);
      } finally {
        setIsLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory?.id) {
      setDocuments([]);
      setDocumentsTotal(0);
      return;
    }

    async function loadDocuments() {
      setIsLoadingDocuments(true);
      try {
        const data = await searchDocuments({ categoryId: selectedCategory.id, page: 0, size: 5, sort: 'created_at_desc' });
        const content = getPageContent(data);
        setDocuments(content.map((item) => normalizeDocument(item.document || item)).filter(Boolean));
        setDocumentsTotal(data?.totalElements ?? data?.total ?? content.length);
      } catch {
        setDocuments([]);
        setDocumentsTotal(0);
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    loadDocuments();
  }, [selectedCategory?.id]);

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>MH24</span>
          <h1>Danh mục của tôi</h1>
          <p>Chỉ hiển thị các danh mục nằm trong phạm vi quyền truy cập của bạn.</p>
        </div>
      </header>

      <section className={styles.searchCard} aria-label="Tìm danh mục">
        <Input prefix={<SearchOutlined />} placeholder="Tìm danh mục…" value={filterText} onChange={(event) => setFilterText(event.target.value)} allowClear />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <Spin spinning={isLoadingCategories}>
            <div className={styles.categoryList}>
              {!isLoadingCategories && !filterText && categoryTree.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có danh mục" />}
              {!isLoadingCategories && !filterText && categoryTree.map((item) => (
                <CategoryNode key={item.id} item={item} selectedId={selectedCategory?.id} expandedIds={expandedIds} onSelect={handleSelect} onToggle={handleToggle} />
              ))}
              {!isLoadingCategories && filterText && filteredCategories.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy danh mục phù hợp" />}
              {!isLoadingCategories && filterText && filteredCategories.map((item) => (
                <button key={item.id} type="button" className={`${styles.categoryCard} ${selectedCategory?.id === item.id ? styles.activeCard : ''}`} style={{ '--category-level': item.level || 0 }} onClick={() => handleSelect(item)}>
                  <span className={styles.chevronPlaceholder} />
                  <div className={styles.categoryContentWrap}>
                    <div className={styles.categoryHeader}>
                      <div className={styles.categoryTitle}><FolderFilled /><strong>{item.name}</strong></div>
                      <span>{item.children?.length || 0} danh mục con</span>
                    </div>
                    <PermissionPills permissions={item.permissions || defaultPermissions} />
                  </div>
                </button>
              ))}
            </div>
          </Spin>

          <section className={styles.restrictedCard}>
            <div className={styles.restrictedHeader}>
              <LockOutlined />
              <h3>Danh mục chưa được cấp quyền</h3>
            </div>
            <div className={styles.restrictedTags}>
              {restrictedCategories.map((category) => (
                <Tag key={category}>{category}</Tag>
              ))}
            </div>
            <p>Liên hệ quản trị viên nếu bạn cần truy cập các danh mục này.</p>
          </section>
        </div>

        <aside className={styles.sidePanel}>
          <section className={styles.detailCard}>
            {selectedCategory ? (
              <>
                <h3>{selectedCategory.name}</h3>
                <div className={styles.permissionLine}>
                  <SafetyCertificateOutlined />
                  <span>Quyền của bạn: {(selectedCategory.permissions || defaultPermissions).join(', ')}</span>
                </div>
                <div className={styles.detailStats}>
                  <div><strong>{selectedCategory.children?.length || 0}</strong><span>Danh mục con</span></div>
                  <div><strong>{documentsTotal}</strong><span>Tài liệu</span></div>
                </div>
                <p className={styles.descriptionText}>{selectedCategory.description || 'Chưa có mô tả cho danh mục này.'}</p>
                <div className={styles.relatedHeader}>Tài liệu trong danh mục</div>
                <Spin spinning={isLoadingDocuments}>
                  {documents.length ? (
                    <div className={styles.documentList}>
                      {documents.map((doc) => (
                        <DocumentItem doc={doc} key={doc.id || doc.title || doc.fileName} onOpen={(id) => navigate(`/documents/${id}`)} />
                      ))}
                    </div>
                  ) : (
                    !isLoadingDocuments && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tài liệu trong danh mục này" />
                  )}
                </Spin>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một danh mục để xem chi tiết" />
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
