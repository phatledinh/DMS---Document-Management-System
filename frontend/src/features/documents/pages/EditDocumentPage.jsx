import { FileTextOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Select, Spin } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getCategories } from '../../../api/categoryApi.js';
import { getDocumentById, updateDocument } from '../../../api/documentApi.js';
import { getTags } from '../../../api/tagApi.js';
import { getApiErrorMessage } from '../../../utils/response.js';
import styles from './EditDocumentPage.module.css';

const EMPTY_FORM = {
  title: '', documentCode: '', categoryId: '', tagIds: [],
  effectiveDate: '', expiryDate: '', description: '',
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.items || [];
}

export default function EditDocumentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadPage() {
      setLoading(true);
      setLoadError('');
      try {
        const [documentData, categoryData, tagData] = await Promise.all([
          getDocumentById(slug), getCategories({ activeOnly: true }), getTags(),
        ]);
        if (!active) return;
        setDocument(documentData);
        setCategories(asList(categoryData));
        setTags(asList(tagData));
        setForm({
          title: documentData?.title || '',
          documentCode: documentData?.documentCode || '',
          categoryId: documentData?.categoryId ?? '',
          tagIds: (documentData?.tags || []).map((tag) => tag.id),
          effectiveDate: documentData?.effectiveDate || '',
          expiryDate: documentData?.expiryDate || '',
          description: documentData?.description || '',
        });
      } catch (error) {
        if (active) setLoadError(getApiErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPage();
    return () => { active = false; };
  }, [slug]);

  const tagOptions = useMemo(
    () => tags.map((tag) => ({ label: tag.name, value: tag.id })),
    [tags],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) return toast.error('Tên tài liệu không được bỏ trống.');
    if (!form.categoryId) return toast.error('Vui lòng chọn danh mục.');
    if (form.effectiveDate && form.expiryDate && form.expiryDate <= form.effectiveDate) {
      return toast.error('Ngày hết hạn phải sau ngày hiệu lực.');
    }

    setSaving(true);
    try {
      await updateDocument(slug, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        categoryId: Number(form.categoryId),
        tagIds: form.tagIds.map(Number),
        effectiveDate: form.effectiveDate || null,
        expiryDate: form.expiryDate || null,
      });
      toast.success('Đã lưu thay đổi tài liệu.');
      navigate('/admin/documents-admin');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className={styles.statePanel}><Spin size="large" /></div>;
  if (loadError) {
    return <div className={styles.statePanel}><Alert type="error" showIcon message="Không thể tải tài liệu" description={loadError} /></div>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.pageBody}>
        <div className={styles.canvas}>
          <div className={styles.container}>
            <div className={styles.pageHeader}>
              <h2>Chỉnh sửa tài liệu</h2>
              <p><FileTextOutlined />{document?.title}</p>
            </div>
            <form className={styles.formCard} onSubmit={handleSubmit}>
              <section className={styles.section}>
                <h3>Thông tin cơ bản</h3>
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <span>Tên tài liệu <strong>*</strong></span>
                    <input disabled={isSaving} value={form.title} onChange={(event) => updateField('title', event.target.value)} type="text" />
                  </label>
                  <label>
                    <span>Mã tài liệu</span>
                    <input readOnly value={form.documentCode} />
                  </label>
                  <label>
                    <span>Danh mục <strong>*</strong></span>
                    <select disabled={isSaving} value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)}>
                      <option value="">Chọn danh mục</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label className={styles.fullField}>
                    <span>Thẻ tag (Tags)</span>
                    <Select className={styles.tagsSelect} mode="multiple" allowClear showSearch disabled={isSaving} optionFilterProp="label" options={tagOptions} placeholder="Chọn tags" value={form.tagIds} onChange={(value) => updateField('tagIds', value)} />
                  </label>
                  <label>
                    <span>Ngày hiệu lực</span>
                    <input disabled={isSaving} value={form.effectiveDate} onChange={(event) => updateField('effectiveDate', event.target.value)} type="date" />
                  </label>
                  <label>
                    <span>Ngày hết hạn</span>
                    <input disabled={isSaving} min={form.effectiveDate || undefined} value={form.expiryDate} onChange={(event) => updateField('expiryDate', event.target.value)} type="date" />
                  </label>
                  <label className={styles.fullField}>
                    <span>Mô tả chi tiết</span>
                    <textarea disabled={isSaving} rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                  </label>
                </div>
              </section>
              <footer className={styles.formFooter}>
                <button className={styles.cancelButton} disabled={isSaving} onClick={() => navigate('/admin/documents-admin')} type="button">Hủy</button>
                <button className={styles.saveButton} disabled={isSaving} type="submit"><SaveOutlined />{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
              </footer>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
