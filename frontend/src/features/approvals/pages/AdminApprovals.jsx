import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Input, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';
import styles from './AdminApprovals.module.css';

const approvalItems = [
  {
    id: 'QA-SOP-023',
    title: 'Quy trình kiểm tra nguyên vật liệu đầu vào',
    status: 'PENDING',
    submitter: 'Nguyễn Minh Khoa',
    submittedAt: '09/08/2026 09:12',
    department: 'Phòng QA',
    category: 'ISO',
    fileType: 'PDF',
    fileSize: '1.8 MB',
    tags: ['ISO', 'QA'],
    summary: 'Tài liệu mô tả các bước kiểm tra, ghi nhận và phê duyệt nguyên vật liệu đầu vào trước khi nhập kho.',
  },
  {
    id: 'HR-FRM-021',
    title: 'Biểu mẫu đánh giá thử việc 2026',
    status: 'PENDING',
    submitter: 'Lê Thị Hằng',
    submittedAt: '08/08/2026 16:40',
    department: 'Phòng Nhân sự',
    category: 'Biểu mẫu',
    fileType: 'DOCX',
    fileSize: '640 KB',
    tags: ['HR', 'Đánh giá'],
    summary: 'Biểu mẫu chuẩn hóa nội dung đánh giá nhân sự trong giai đoạn thử việc.',
  },
  {
    id: 'IT-POL-007',
    title: 'Chính sách sử dụng thiết bị cá nhân (BYOD)',
    status: 'PENDING',
    submitter: 'Phạm Anh Tuấn',
    submittedAt: '08/08/2026 10:05',
    department: 'Phòng CNTT',
    category: 'Chính sách',
    fileType: 'PDF',
    fileSize: '2.2 MB',
    tags: ['IT', 'Security'],
    summary: 'Chính sách hướng dẫn kiểm soát truy cập, bảo mật dữ liệu và trách nhiệm khi dùng thiết bị cá nhân.',
  },
  {
    id: 'FIN-RPT-114',
    title: 'Báo cáo ngân sách vận hành tháng 07/2026',
    status: 'APPROVED',
    submitter: 'Trần Hoàng Nam',
    submittedAt: '07/08/2026 14:25',
    department: 'Phòng Tài chính',
    category: 'Báo cáo',
    fileType: 'XLSX',
    fileSize: '980 KB',
    tags: ['Finance'],
    summary: 'Báo cáo tổng hợp chi phí vận hành và đề xuất điều chỉnh ngân sách.',
  },
  {
    id: 'MKT-PLN-032',
    title: 'Kế hoạch truyền thông nội bộ quý 4',
    status: 'REJECTED',
    submitter: 'Đỗ Minh Anh',
    submittedAt: '06/08/2026 11:18',
    department: 'Phòng Marketing',
    category: 'Kế hoạch',
    fileType: 'PDF',
    fileSize: '1.1 MB',
    tags: ['Marketing'],
    summary: 'Bản kế hoạch cần bổ sung người chịu trách nhiệm và mốc nghiệm thu trước khi xuất bản.',
  },
];

const statusOptions = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'ALL', label: 'Tất cả' },
];

const statusMeta = {
  PENDING: { label: 'Chờ duyệt', color: 'gold', icon: <ClockCircleOutlined /> },
  APPROVED: { label: 'Đã duyệt', color: 'green', icon: <CheckCircleOutlined /> },
  REJECTED: { label: 'Từ chối', color: 'red', icon: <CloseCircleOutlined /> },
};

function StatusTag({ status }) {
  const meta = statusMeta[status] || statusMeta.PENDING;
  return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
}

function SummaryCard({ label, value, status }) {
  const meta = statusMeta[status] || statusMeta.PENDING;
  return (
    <article className={styles.summaryCard}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className={styles.summaryIcon}>{meta.icon}</span>
    </article>
  );
}

function ApprovalListItem({ item, selected, onSelect }) {
  return (
    <button className={selected ? styles.approvalItemActive : styles.approvalItem} type="button" onClick={onSelect}>
      <span className={styles.fileIcon}><FileTextOutlined /></span>
      <span className={styles.itemContent}>
        <span className={styles.itemTitleRow}>
          <strong>{item.title}</strong>
          <StatusTag status={item.status} />
        </span>
        <span>{item.id} · {item.department} · {item.fileSize}</span>
        <small>{item.submitter} · {item.submittedAt}</small>
      </span>
    </button>
  );
}

export default function AdminApprovals() {
  const [activeStatus, setActiveStatus] = useState('PENDING');
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState();
  const [category, setCategory] = useState();
  const [selectedId, setSelectedId] = useState(approvalItems[0]?.id);

  const departments = useMemo(() => [...new Set(approvalItems.map((item) => item.department))], []);
  const categories = useMemo(() => [...new Set(approvalItems.map((item) => item.category))], []);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return approvalItems.filter((item) => {
      const matchesStatus = activeStatus === 'ALL' || item.status === activeStatus;
      const matchesKeyword = !normalizedKeyword || [item.title, item.id, item.submitter]
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
      const matchesDepartment = !department || item.department === department;
      const matchesCategory = !category || item.category === category;
      return matchesStatus && matchesKeyword && matchesDepartment && matchesCategory;
    });
  }, [activeStatus, category, department, keyword]);

  const selectedItem = approvalItems.find((item) => item.id === selectedId) || filteredItems[0] || approvalItems[0];
  const stats = {
    pending: approvalItems.filter((item) => item.status === 'PENDING').length,
    approved: approvalItems.filter((item) => item.status === 'APPROVED').length,
    rejected: approvalItems.filter((item) => item.status === 'REJECTED').length,
  };

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span>MH24</span>
          <h1>Duyệt bài đăng của người dùng</h1>
          <p>Kiểm tra tài liệu người dùng gửi lên, phê duyệt để xuất bản hoặc trả lại kèm lý do.</p>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <SummaryCard label="Đang chờ duyệt" value={stats.pending} status="PENDING" />
        <SummaryCard label="Đã duyệt" value={stats.approved} status="APPROVED" />
        <SummaryCard label="Đã từ chối" value={stats.rejected} status="REJECTED" />
      </section>

      <section className={styles.statusTabs}>
        {statusOptions.map((option) => (
          <button
            key={option.value}
            className={activeStatus === option.value ? styles.tabActive : styles.tab}
            type="button"
            onClick={() => setActiveStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className={styles.filters}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tiêu đề, mã tài liệu hoặc người gửi…"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          allowClear
          placeholder="Phòng ban"
          value={department}
          onChange={setDepartment}
          options={departments.map((value) => ({ value, label: value }))}
        />
        <Select
          allowClear
          placeholder="Danh mục"
          value={category}
          onChange={setCategory}
          options={categories.map((value) => ({ value, label: value }))}
        />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.listPanel}>
          {filteredItems.map((item) => (
            <ApprovalListItem
              key={item.id}
              item={item}
              selected={selectedItem?.id === item.id}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
          {filteredItems.length === 0 && <div className={styles.emptyState}>Không có bài đăng phù hợp bộ lọc.</div>}
        </div>

        {selectedItem && (
          <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <span>{selectedItem.id}</span>
                <h2>{selectedItem.title}</h2>
              </div>
              <StatusTag status={selectedItem.status} />
            </div>

            <dl className={styles.detailList}>
              <div><dt>Người gửi</dt><dd>{selectedItem.submitter}</dd></div>
              <div><dt>Thời gian gửi</dt><dd>{selectedItem.submittedAt}</dd></div>
              <div><dt>Phòng ban</dt><dd>{selectedItem.department}</dd></div>
              <div><dt>Danh mục</dt><dd>{selectedItem.category}</dd></div>
              <div><dt>Định dạng</dt><dd>{selectedItem.fileType} · {selectedItem.fileSize}</dd></div>
              <div><dt>Tags</dt><dd>{selectedItem.tags.join(', ')}</dd></div>
            </dl>

            <section className={styles.extractBox}>
              <h3>Nội dung trích xuất</h3>
              <p>{selectedItem.summary}</p>
            </section>

            <Space wrap className={styles.detailActions}>
              <Button icon={<EyeOutlined />}>Xem trước</Button>
              <Button danger disabled={selectedItem.status !== 'PENDING'}>Từ chối</Button>
              <Button type="primary" disabled={selectedItem.status !== 'PENDING'}>Phê duyệt</Button>
            </Space>
          </aside>
        )}
      </section>
    </main>
  );
}
