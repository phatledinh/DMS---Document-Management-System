import { useState } from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BellOutlined,
  CloudUploadOutlined,
  CloseOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlusCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import styles from './UploadDocumentPage.module.css';

const navItems = [
  { label: 'Dashboard', icon: <AppstoreOutlined /> },
  { label: 'Documents', icon: <FileTextOutlined />, active: true },
  { label: 'Categories', icon: <FolderOpenOutlined /> },
  { label: 'Departments', icon: <ShopOutlined /> },
  { label: 'Tags', icon: <TagsOutlined /> },
  { label: 'Users', icon: <TeamOutlined /> },
  { label: 'Audit Logs', icon: <HistoryOutlined /> },
];

export default function UploadDocumentPage() {
  const [accessLevel, setAccessLevel] = useState('DEPARTMENT');

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>DT</div>
          <div>
            <h1>Deep Trust Admin</h1>
            <p>Enterprise DMS</p>
          </div>
        </div>

        <button className={styles.sidebarUploadButton} type="button"><PlusCircleOutlined />Upload Document</button>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <a key={item.label} className={item.active ? styles.navItemActive : styles.navItem} href="#">
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <a className={styles.navItem} href="#"><SettingOutlined /><span>Settings</span></a>
          <a className={styles.navItem} href="#"><QuestionCircleOutlined /><span>Help Center</span></a>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <label className={styles.topbarSearch}>
            <SearchOutlined />
            <input placeholder="Search documents, IDs, or categories..." type="text" />
          </label>
          <div className={styles.topbarActions}>
            <button className={styles.iconButton} title="notifications" type="button"><BellOutlined /><span className={styles.notificationDot} /></button>
            <button className={styles.iconButton} title="help" type="button"><QuestionCircleOutlined /></button>
            <button className={styles.iconButton} title="settings" type="button"><SettingOutlined /></button>
            <div className={styles.avatar}>A</div>
          </div>
        </header>

        <div className={styles.canvas}>
          <div className={styles.container}>
            <div className={styles.pageHeader}>
              <button className={styles.backButton} type="button"><ArrowLeftOutlined /></button>
              <div>
                <h2>Upload tài liệu mới</h2>
                <p>Add a new document to the repository with appropriate metadata and access controls.</p>
              </div>
            </div>

            <form className={styles.form}>
              <section className={styles.card}>
                <label className={styles.dropZone}>
                  <div className={styles.uploadIcon}><CloudUploadOutlined /></div>
                  <h3>Drag and drop file here</h3>
                  <p>or click to browse from your computer</p>
                  <div className={styles.fileTypes}>
                    <span>PDF</span>
                    <span>DOCX</span>
                    <span>XLSX</span>
                    <span>IMAGE</span>
                  </div>
                  <small>Maximum file size: 50MB</small>
                  <input accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.tiff" type="file" />
                </label>
              </section>

              <section className={styles.card}>
                <h3 className={styles.sectionTitle}>Document Metadata</h3>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <span>Tiêu đề (Title) <strong>*</strong></span>
                    <input placeholder="Enter document title" type="text" />
                  </label>
                  <label>
                    <span>Mã tài liệu</span>
                    <input disabled value="Tự sinh sau upload" />
                  </label>
                  <label>
                    <span>Danh mục (Category) <strong>*</strong></span>
                    <div className={styles.selectWrap}>
                      <select defaultValue=""><option value="" disabled>Select category...</option><option>Human Resources</option><option>Finance & Accounting</option><option>Legal Contracts</option><option>Technical Specs</option></select>
                      <DownOutlined />
                    </div>
                  </label>
                  <label className={styles.fullField}>
                    <span>Mô tả (Description)</span>
                    <textarea placeholder="Briefly describe the contents or purpose of this document..." rows={3} />
                  </label>
                  <label className={styles.fullField}>
                    <span>Tags</span>
                    <div className={styles.tagsInput}>
                      <span>ISO 9001 <button type="button"><CloseOutlined /></button></span>
                      <span>QA Procedure <button type="button"><CloseOutlined /></button></span>
                      <input placeholder="Add tag..." type="text" />
                    </div>
                  </label>
                  <label>
                    <span>Ngày hiệu lực (Effective Date)</span>
                    <input type="date" />
                  </label>
                  <label>
                    <span>Ngày hết hạn (Expiration Date)</span>
                    <input type="date" />
                  </label>
                </div>
              </section>

              <section className={styles.card}>
                <h3 className={styles.sectionTitle}>Access & Permissions</h3>
                <div className={styles.radioGroup}>
                  {['PUBLIC', 'DEPARTMENT', 'RESTRICTED'].map((level) => (
                    <label key={level}>
                      <input checked={accessLevel === level} name="access_level" onChange={() => setAccessLevel(level)} type="radio" value={level} />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>

                <div className={styles.conditionalPanel}>
                  {accessLevel === 'DEPARTMENT' && (
                    <label>
                      <span>Phòng ban (Departments) <strong>*</strong></span>
                      <select multiple defaultValue={['all']}>
                        <option value="all">All Internal Departments</option>
                        <option value="hr">Human Resources</option>
                        <option value="it">IT & Operations</option>
                        <option value="finance">Finance</option>
                        <option value="legal">Legal</option>
                      </select>
                      <small>Hold Ctrl/Cmd to select multiple.</small>
                    </label>
                  )}

                  {accessLevel === 'RESTRICTED' && (
                    <div className={styles.restrictedFields}>
                      <label><span>Owner</span><input disabled value="Current User (Admin)" /></label>
                      <label>
                        <span>Shared Users</span>
                        <div className={styles.userSearch}><UserAddOutlined /><input placeholder="Search by email or name..." type="text" /></div>
                      </label>
                    </div>
                  )}

                  {accessLevel === 'PUBLIC' && (
                    <div className={styles.publicWarning}>
                      <ExclamationCircleOutlined />
                      <p>Warning: This document will be accessible to anyone with the link, including external parties without an account.</p>
                    </div>
                  )}
                </div>
              </section>

              <div className={styles.bottomSpacer} />
              <div className={styles.actionBar}>
                <button className={styles.cancelButton} type="button">Hủy</button>
                <button className={styles.submitButton} type="submit"><UploadOutlined />Upload</button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
