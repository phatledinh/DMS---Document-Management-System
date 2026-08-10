import { DownloadOutlined, FileDoneOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select, Tag } from 'antd';
import styles from './VersionUser.module.css';

const versionRows = [
  {
    document: 'Quy trình ISO 9001 — Kiểm soát chất lượng',
    version: 'v1.2',
    current: true,
    note: 'Cập nhật mục 4.2 và biểu mẫu đính kèm',
    size: '2.4 MB',
    uploadedAt: '21/07/2026',
    category: 'ISO',
    status: 'Sẵn sàng',
  },
  {
    document: 'Quy trình ISO 9001 — Kiểm soát chất lượng',
    version: 'v1.1',
    note: 'Bổ sung phụ lục kiểm tra định kỳ',
    size: '2.3 MB',
    uploadedAt: '12/05/2026',
    category: 'ISO',
    status: 'Sẵn sàng',
  },
  {
    document: 'Quy trình ISO 9001 — Kiểm soát chất lượng',
    version: 'v1.0',
    note: 'Phiên bản ban hành đầu tiên',
    size: '2.1 MB',
    uploadedAt: '02/01/2026',
    category: 'ISO',
    status: 'Lưu trữ',
  },
  {
    document: 'Báo cáo tài chính Quý 2 / 2026',
    version: 'v1.0',
    current: true,
    note: 'Bản nộp lần đầu',
    size: '3.1 MB',
    uploadedAt: '02/08/2026',
    category: 'Báo cáo',
    status: 'Sẵn sàng',
  },
];

export default function VersionUser() {
  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <span className={styles.eyebrow}>MH22</span>
          <h1>Version của tôi</h1>
          <p>Phiên bản tài liệu bạn đã tải lên.</p>
        </div>
        <span className={styles.summaryBadge}><FileDoneOutlined /> {versionRows.length} bản ghi</span>
      </header>

      <section className={styles.filterCard} aria-label="Bộ lọc version">
        <Input className={styles.searchInput} prefix={<SearchOutlined />} placeholder="Tìm theo tên tài liệu…" allowClear />
        <Select
          className={styles.filterSelect}
          placeholder="Danh mục"
          suffixIcon={<FilterOutlined />}
          allowClear
          options={[
            { value: 'iso', label: 'ISO' },
            { value: 'report', label: 'Báo cáo' },
          ]}
        />
        <Select
          className={styles.filterSelect}
          placeholder="Trạng thái"
          allowClear
          options={[
            { value: 'ready', label: 'Sẵn sàng' },
            { value: 'archive', label: 'Lưu trữ' },
          ]}
        />
        <Select
          className={styles.filterSelect}
          placeholder="Thời gian"
          allowClear
          options={[
            { value: '30', label: '30 ngày qua' },
            { value: '90', label: '90 ngày qua' },
          ]}
        />
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.versionTable}>
            <thead>
              <tr>
                <th>Tài liệu</th>
                <th>Phiên bản</th>
                <th>Ghi chú</th>
                <th>Dung lượng</th>
                <th>Ngày tải lên</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {versionRows.map((row) => (
                <tr key={`${row.document}-${row.version}`}>
                  <td>
                    <strong>{row.document}</strong>
                    <span>{row.category} · {row.status}</span>
                  </td>
                  <td>
                    <div className={styles.versionCell}>
                      <span>{row.version}</span>
                      {row.current && <Tag className={styles.currentTag}>hiện hành</Tag>}
                    </div>
                  </td>
                  <td>{row.note}</td>
                  <td>{row.size}</td>
                  <td>{row.uploadedAt}</td>
                  <td>
                    <Button type="link" className={styles.downloadButton} icon={<DownloadOutlined />}>
                      Tải
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.paginationFooter}>
        <span>Hiển thị 1–4 trong 4 bản ghi</span>
        <div className={styles.paginationButtons}>
          <button type="button">‹</button>
          <button type="button" className={styles.activePage}>1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <button type="button">›</button>
        </div>
      </footer>
    </main>
  );
}
