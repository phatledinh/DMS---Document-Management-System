import { useMemo, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useDocumentSearch } from '../hooks/useDocumentSearch.js';
import {
  formatDateTime,
  formatFileSize,
  normalizeDocument,
} from '../../documents/utils/documentFormatters.js';
import styles from './SearchPage.module.css';

/* ───────── helpers ───────── */

const ACCESS_LABELS = { PUBLIC: 'Công khai', DEPARTMENT: 'Theo phòng ban', RESTRICTED: 'Giới hạn' };

function normalizeSearchResult(result) {
  const doc = normalizeDocument(result?.document || result);
  if (!doc) return null;
  return { ...doc, highlight: result?.highlight, relevanceScore: result?.relevanceScore, matchCount: result?.matchCount ?? 0 };
}

function cleanSnippet(raw) {
  if (!raw) return '';
  return raw.replace(/\uFFFD/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\s{3,}/g, '  ').trim();
}

function sanitizeHighlight(value) {
  const cleaned = cleanSnippet(String(value || ''));
  if (!cleaned) return '';
  const sanitized = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: ['em', 'mark'], ALLOWED_ATTR: [] });
  return sanitized.replace(/<[^>]+>/g, '').length >= 5 ? sanitized : '';
}

function getHighlightSections(result) {
  const source = result.highlight || result.highlights || {};
  const fields = [
    ['title', 'Tiêu đề'],
    ['description', 'Mô tả'],
    ['content', 'Nội dung'],
    ['snippet', 'Nội dung'],
  ];
  const seen = new Set();
  return fields.flatMap(([key, label]) => {
    const value = source?.[key] ?? (key === 'snippet' ? result.snippet : undefined);
    const html = sanitizeHighlight(value);
    const plain = html.replace(/<[^>]+>/g, '');
    if (!html || seen.has(plain)) return [];
    seen.add(plain);
    return [{ key, label, html }];
  });
}

function relevanceMeta(score, matchCount) {
  const safeScore = Number(score) || 0;
  if (safeScore >= 1 || matchCount >= 8) return { label: 'Độ trùng cao', cls: styles.relevanceHigh };
  if (safeScore >= 0.25 || matchCount >= 3) return { label: 'Độ trùng vừa', cls: styles.relevanceMedium };
  if (safeScore > 0 || matchCount > 0) return { label: 'Độ trùng thấp', cls: styles.relevanceLow };
  return null;
}

function getFacetLabel(items, value) {
  if (!value) return '';
  return items?.find((item) => String(item.value) === String(value))?.label || value;
}

function fileIconName(fileType) {
  const t = String(fileType || '').toLowerCase();
  if (t === 'pdf') return { icon: 'picture_as_pdf', cls: styles.iconPdf };
  if (t === 'docx' || t === 'doc') return { icon: 'description', cls: styles.iconDocx };
  if (t === 'xlsx' || t === 'xls') return { icon: 'table_chart', cls: styles.iconXlsx };
  if (['jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(t)) return { icon: 'image', cls: styles.iconImage };
  return { icon: 'draft', cls: styles.iconDefault };
}



const SORT_OPTIONS = [
  { value: 'relevance', label: 'Độ liên quan' },
  { value: 'createdAt,desc', label: 'Mới nhất' },
  { value: 'title,asc', label: 'Tên A-Z' },
];

const MAX_FACET = 5;

/* ── Icon component ── */
function MI({ name, size, style }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size || 20, ...style }}>{name}</span>;
}

/* ── Facet filter list ── */
function FacetGroup({ title, items, selected, onToggle, labelMap, maxItems = MAX_FACET, iconMap }) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  if (!items || items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <div className={styles.filterGroup}>
      <div className={styles.filterGroupHead} onClick={() => setCollapsed(!collapsed)}>
        <h3 className={styles.filterGroupTitle}>{title}</h3>
        <MI name={collapsed ? "expand_more" : "expand_less"} size={16} style={{ color: 'var(--text-secondary)' }} />
      </div>
      {!collapsed && (
        <div className={`${styles.filterGroupList} ${expanded ? styles.scrollableList : ''}`}>
          {visible.map((item) => {
            const isActive = String(item.value) === String(selected);
            const label = labelMap?.[item.value] ?? item.label ?? item.value;
            const iconInfo = iconMap?.(item.label || item.value);
            return (
              <label key={item.value} className={`${styles.facetRow} ${isActive ? styles.facetRowActive : ''}`}>
                <div className={styles.facetRowLeft}>
                  <input type="checkbox" className={styles.facetCheckbox} checked={isActive} onChange={() => onToggle(isActive ? undefined : item.value)} />
                  <span className={styles.facetLabel}>
                    {iconInfo && <MI name={iconInfo.icon} size={16} style={{ color: iconInfo.color }} />}
                    {label}
                  </span>
                </div>
                <span className={styles.facetCount}>{item.count}</span>
              </label>
            );
          })}
          {hasMore && (
            <button type="button" className={styles.showMore} onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Thu gọn' : `+${items.length - maxItems} thêm`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ current, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 2 && i <= current + 2)) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  return (
    <div className={styles.pagination}>
      <button className={styles.pageBtn} disabled={current <= 1} onClick={() => onChange(current - 1)}>
        <MI name="chevron_left" size={20} />
      </button>
      {pages.map((p, i) =>
        p === '...' ? <span key={`e${i}`} className={styles.pageEllipsis}>...</span> : (
          <button key={p} className={`${styles.pageBtn} ${p === current ? styles.pageBtnActive : ''}`} onClick={() => onChange(p)}>{p}</button>
        ),
      )}
      <button className={styles.pageBtn} disabled={current >= totalPages} onClick={() => onChange(current + 1)}>
        <MI name="chevron_right" size={20} />
      </button>
    </div>
  );
}

/* ── File type icon mapper for facets ── */
function fileTypeFacetIcon(label) {
  const l = String(label).toLowerCase();
  if (l.includes('pdf')) return { icon: 'picture_as_pdf', color: '#D93025' };
  if (l.includes('doc')) return { icon: 'description', color: '#005bbf' };
  if (l.includes('xls')) return { icon: 'table_chart', color: '#0D9648' };
  if (l.includes('jpg') || l.includes('png') || l.includes('tif') || l.includes('image')) return { icon: 'image', color: '#F9AB00' };
  return null;
}

/* ─────────── Main Component ─────────── */

const EMPTY_FACETS = {};

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || 1);
  const pageSize = 10;

  const params = useMemo(() => ({
    q: searchParams.get('q') || undefined,
    page: page - 1, size: pageSize,
    sort: searchParams.get('sort') || 'relevance',
    fileType: searchParams.get('fileType') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    accessLevel: searchParams.get('accessLevel') || undefined,
    tagId: searchParams.get('tagId') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  }), [page, searchParams]);

  const searchQuery = useDocumentSearch(params);
  const raw = searchQuery.data?.content || searchQuery.data?.items || searchQuery.data?.data || [];
  const results = raw.map(normalizeSearchResult).filter(Boolean);
  const totalElements = searchQuery.data?.totalElements ?? searchQuery.data?.total ?? results.length;
  const searchTime = searchQuery.data?.searchTimeMs ?? searchQuery.data?.searchTime;
  const facets = searchQuery.data?.facets || EMPTY_FACETS;

  const updateParams = useCallback((next) => {
    const p = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => { if (v === undefined || v === null || v === '') p.delete(k); else p.set(k, v); });
    setSearchParams(p);
  }, [searchParams, setSearchParams]);

  const handleFilterChange = (key, val) => updateParams({ [key]: val, page: 1 });
  const clearAll = () => updateParams({ categoryId: undefined, departmentId: undefined, fileType: undefined, accessLevel: undefined, tagId: undefined, dateFrom: undefined, dateTo: undefined, page: 1 });
  const hasFilters = ['categoryId', 'departmentId', 'fileType', 'accessLevel', 'tagId', 'dateFrom', 'dateTo'].some((k) => searchParams.get(k));

  const activeFilters = useMemo(() => {
    const list = [];
    const catId = searchParams.get('categoryId');
    if (catId) list.push({ key: 'categoryId', label: `Danh mục: ${getFacetLabel(facets.categories, catId)}` });
    const depId = searchParams.get('departmentId');
    if (depId) list.push({ key: 'departmentId', label: `Phòng ban: ${getFacetLabel(facets.departments, depId)}` });
    const type = searchParams.get('fileType');
    if (type) list.push({ key: 'fileType', label: `Loại tệp: ${getFacetLabel(facets.fileTypes, type)}` });
    const acc = searchParams.get('accessLevel');
    if (acc) list.push({ key: 'accessLevel', label: `Quyền: ${ACCESS_LABELS[acc] || acc}` });
    const tId = searchParams.get('tagId');
    if (tId) list.push({ key: 'tagId', label: `Tag: ${getFacetLabel(facets.tags, tId)}` });
    const dFrom = searchParams.get('dateFrom');
    if (dFrom) list.push({ key: 'dateFrom', label: `Từ: ${dFrom}` });
    const dTo = searchParams.get('dateTo');
    if (dTo) list.push({ key: 'dateTo', label: `Đến: ${dTo}` });
    return list;
  }, [searchParams, facets]);

  return (
    <div className={styles.canvas}>
      <div className={styles.grid}>
        {/* ── Left Sidebar: Filters ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <h2 className={styles.sidebarTitle}>BỘ LỌC</h2>
            {hasFilters && <button type="button" className={styles.clearAllBtn} onClick={clearAll}>Xóa tất cả</button>}
          </div>

          <FacetGroup title="Danh mục" items={facets.categories} selected={searchParams.get('categoryId')} onToggle={(v) => handleFilterChange('categoryId', v)} />
          <FacetGroup title="Phòng ban" items={facets.departments} selected={searchParams.get('departmentId')} onToggle={(v) => handleFilterChange('departmentId', v)} />
          <FacetGroup title="Loại tệp" items={facets.fileTypes} selected={searchParams.get('fileType')} onToggle={(v) => handleFilterChange('fileType', v)} iconMap={fileTypeFacetIcon} />
          <FacetGroup title="Quyền truy cập" items={facets.accessLevels} selected={searchParams.get('accessLevel')} onToggle={(v) => handleFilterChange('accessLevel', v)} labelMap={ACCESS_LABELS} />
          <FacetGroup title="Tags" items={facets.tags} selected={searchParams.get('tagId')} onToggle={(v) => handleFilterChange('tagId', v)} maxItems={8} />

          <div className={styles.filterGroup}>
            <h3 className={styles.filterGroupTitle}>Thời gian cập nhật</h3>
            <div className={styles.dateGrid}>
              <input type="date" className={styles.dateInput} value={searchParams.get('dateFrom') || ''} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
              <input type="date" className={styles.dateInput} value={searchParams.get('dateTo') || ''} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </div>
          </div>
        </aside>

        {/* ── Right: Results ── */}
        <section className={styles.main}>
          {/* Results Header */}
          <div className={styles.resultsHead}>
            <div className={styles.resultsHeadTop}>
              <div>
                <h1 className={styles.resultsTitle}>
                  Tài liệu
                </h1>
                <p className={styles.resultsMeta}>
                  Tìm thấy {totalElements} kết quả{searchTime ? ` (${searchTime}ms)` : ''}
                </p>
              </div>

              <div className={styles.sortWrap}>
                <span className={styles.sortLabel}>Sắp xếp:</span>
                <select className={styles.sortSelect} value={searchParams.get('sort') || 'relevance'} onChange={(e) => handleFilterChange('sort', e.target.value)}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className={styles.filterChips}>
                {activeFilters.map(f => (
                  <div key={f.key} className={styles.chip}>
                    <span>{f.label}</span>
                    <button type="button" className={styles.chipBtn} onClick={() => handleFilterChange(f.key, undefined)}>
                      <MI name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error state */}
          {searchQuery.isError && (
            <div className={styles.errorBox}>Đã xảy ra lỗi khi tìm kiếm. Vui lòng thử lại.</div>
          )}

          {/* Loading */}
          {searchQuery.isLoading && <div className={styles.emptyBox}>Đang tìm kiếm...</div>}

          {/* Empty */}
          {!searchQuery.isLoading && !searchQuery.isError && results.length === 0 && (
            <div className={styles.emptyBox}>
              <MI name="search_off" size={40} style={{ marginBottom: 8 }} />
              <div>Không có kết quả phù hợp</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Thử thay đổi từ khóa hoặc bớt bộ lọc</div>
            </div>
          )}

          {/* Results List */}
          {!searchQuery.isLoading && results.length > 0 && (
            <>
              <div className={styles.resultsList}>
                {results.map((r) => {
                  const fi = fileIconName(r.fileType);
                  const highlightSections = getHighlightSections(r);
                  const desc = cleanSnippet(r.description || '');
                  const mc = r.matchCount || 0;
                  const relevance = relevanceMeta(r.relevanceScore, mc);

                  return (
                    <article key={r.id} className={styles.card} onClick={() => r.id && navigate(`/documents/${r.id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && r.id && navigate(`/documents/${r.id}`)}>
                      <div className={styles.cardIconWrap}>
                        <div className={`${styles.cardIcon} ${fi.cls}`}>
                          <MI name={fi.icon} />
                        </div>
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardTitleRow}>
                          <div>
                            <h3 className={styles.cardTitle}>{r.title || r.fileName}</h3>
                            <div className={styles.badgeRow}>
                              <span className={styles.codeBadge}>{r.documentCode || r.fileName || '—'}</span>
                              {mc > 0 && <span className={styles.matchBadge}><MI name="join" size={12} /> Trùng {mc} chỗ</span>}
                              {relevance && <span className={`${styles.relevanceBadge} ${relevance.cls}`}><MI name="equalizer" size={12} /> {relevance.label}</span>}
                            </div>
                          </div>
                          <button type="button" className={styles.moreBtn} onClick={(e) => e.stopPropagation()}>
                            <MI name="more_vert" />
                          </button>
                        </div>

                        {highlightSections.length > 0 ? (
                          <div className={styles.highlightList}>
                            {highlightSections.map((section) => (
                              <p key={section.key} className={styles.snippetText}>
                                <span className={styles.snippetLabel}>{section.label}</span>
                                <span dangerouslySetInnerHTML={{ __html: section.html }} />
                              </p>
                            ))}
                          </div>
                        ) : desc ? (
                          <p className={styles.snippetText}>{desc}</p>
                        ) : (
                          <p className={styles.snippetText} style={{ fontStyle: 'italic' }}>Không có mô tả.</p>
                        )}

                        <div className={styles.cardMeta}>
                          {r.categoryName && <span className={styles.metaItem}><MI name="folder" size={14} /> {r.categoryName}</span>}
                          {r.categoryName && <span className={styles.metaDot}>•</span>}
                          <span className={styles.metaItem}>{formatFileSize(r.fileSize)}</span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}><MI name="calendar_today" size={14} /> {formatDateTime(r.createdAt)}</span>
                          {r.departmentName && <>
                            <span className={styles.metaDot}>•</span>
                            <span className={styles.metaItem}>{r.departmentName}</span>
                          </>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <Pagination current={page} total={totalElements} pageSize={pageSize} onChange={(p) => updateParams({ page: p })} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
