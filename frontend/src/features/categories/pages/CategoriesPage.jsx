import { useCallback, useEffect, useMemo, useState } from "react";
import {
    DeleteOutlined,
    DownOutlined,
    EditOutlined,
    FileTextOutlined,
    FolderFilled,
    FolderOpenFilled,
    PlusOutlined,
    RightOutlined,
    SearchOutlined,
    UpOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Button, Checkbox, Form, Input, Modal, Select, Switch, TreeSelect } from "antd";
import { toast } from "react-toastify";
import {
    createCategory,
    deleteCategory,
    getCategories,
    updateCategory,
} from "../../../api/categoryApi.js";
import { getDepartments } from "../../../api/departmentApi.js";
import { searchDocuments } from "../../../api/searchApi.js";
import {
    formatDateTime,
    formatFileSize,
    getPageContent,
    normalizeDocument,
} from "../../documents/utils/documentFormatters.js";
import { getApiErrorMessage } from "../../../utils/response.js";
import styles from "./CategoriesPage.module.css";

function normalizeList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}


const CATEGORY_PERMISSIONS = [
    { label: "Xem", value: "VIEW" },
    { label: "Upload", value: "UPLOAD" },
    { label: "Download", value: "DOWNLOAD" },
    { label: "Sửa", value: "EDIT" },
    { label: "Xóa", value: "DELETE" },
];

const VIEW_DEPENDENT_PERMISSIONS = ["EDIT", "DOWNLOAD", "DELETE"];

function hasViewDependencyViolation(permissions = []) {
    return !permissions.includes("VIEW")
        && permissions.some((permission) => VIEW_DEPENDENT_PERMISSIONS.includes(permission));
}

function normalizeDepartmentPermissions(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item?.departmentId && Array.isArray(item.permissions))
        .map((item) => ({
            departmentId: item.departmentId,
            permissions: [...new Set(item.permissions)].filter(Boolean),
        }))
        .filter((item) => item.permissions.length > 0);
}

function normalizeUserPermissions(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item?.userId && Array.isArray(item.permissions))
        .map((item) => ({
            userId: item.userId,
            permissions: [...new Set(item.permissions)].filter(Boolean),
        }))
        .filter((item) => item.permissions.length > 0);
}

function buildCategoryTree(categories) {
    const byId = new Map(
        categories.map((category) => [
            category.id,
            { ...category, children: [] },
        ]),
    );
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

function buildTreeSelectData(tree, excludeId = null) {
    return tree
        .filter((node) => node.id !== excludeId)
        .map((node) => ({
            title: node.name,
            value: node.id,
            children:
                node.children?.length > 0
                    ? buildTreeSelectData(node.children, excludeId)
                    : [],
        }));
}

function collectAllIds(tree) {
    const ids = new Set();
    function walk(nodes) {
        for (const node of nodes) {
            if (node.children?.length > 0) {
                ids.add(node.id);
                walk(node.children);
            }
        }
    }
    walk(tree);
    return ids;
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

function TreeNode({
    item,
    level = 0,
    selectedId,
    expandedIds,
    onSelect,
    onToggle,
    onAddChild,
    onEdit,
    onDelete,
}) {
    const hasChildren = item.children?.length > 0;
    const isExpanded = expandedIds.has(item.id);
    const isSelected = selectedId === item.id;

    return (
        <div className={styles.treeNode}>
            <button
                type="button"
                className={
                    isSelected
                        ? `${styles.categoryCard} ${styles.categoryCardActive}`
                        : styles.categoryCard
                }
                style={{ "--category-level": level }}
                onClick={() => onSelect(item.id)}
            >
                {hasChildren ? (
                    <span
                        role="button"
                        tabIndex={0}
                        className={styles.chevronButton}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggle(item.id);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.stopPropagation();
                                onToggle(item.id);
                            }
                        }}
                    >
                        {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </span>
                ) : (
                    <span className={styles.chevronPlaceholder} />
                )}
                <span className={styles.categoryIcon}>
                    {hasChildren && isExpanded ? (
                        <FolderOpenFilled />
                    ) : (
                        <FolderFilled />
                    )}
                </span>
                <span className={styles.categoryContent}>
                    <span className={styles.categoryName}>{item.name}</span>
                    <span className={styles.categoryMeta}>
                        {item.slug} · {item.children?.length || 0} danh mục con · {item.documentCount || 0} tài liệu
                    </span>
                </span>
                <span className={styles.cardActions}>
                    <span
                        role="button"
                        tabIndex={0}
                        title="Thêm danh mục con"
                        className={styles.iconAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            onAddChild(item);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.stopPropagation();
                                onAddChild(item);
                            }
                        }}
                    >
                        <PlusOutlined />
                    </span>
                    <span
                        role="button"
                        tabIndex={0}
                        title="Sửa"
                        className={styles.iconAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit(item);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.stopPropagation();
                                onEdit(item);
                            }
                        }}
                    >
                        <EditOutlined />
                    </span>
                    <span
                        role="button"
                        tabIndex={0}
                        title="Xóa"
                        className={styles.iconAction}
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete(item);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.stopPropagation();
                                onDelete(item);
                            }
                        }}
                    >
                        <DeleteOutlined />
                    </span>
                </span>
            </button>
            {hasChildren && isExpanded && (
                <div className={styles.children}>
                    {item.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            item={child}
                            level={level + 1}
                            selectedId={selectedId}
                            expandedIds={expandedIds}
                            onSelect={onSelect}
                            onToggle={onToggle}
                            onAddChild={onAddChild}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CategoriesPage() {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [filterText, setFilterText] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [relatedDocuments, setRelatedDocuments] = useState([]);
    const [relatedTotal, setRelatedTotal] = useState(0);
    const [activeDetailTab, setActiveDetailTab] = useState("documents");
    const [isLoading, setLoading] = useState(false);
    const [isLoadingDocuments, setLoadingDocuments] = useState(false);
    const [isSubmitting, setSubmitting] = useState(false);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());

    const categoryTree = useMemo(
        () => buildCategoryTree(categories),
        [categories],
    );
    const flatCategories = useMemo(
        () => flattenTree(categoryTree),
        [categoryTree],
    );
    const filteredCategoryTree = useMemo(() => {
        const keyword = filterText.trim().toLowerCase();
        if (!keyword) return categoryTree;
        return flatCategories.filter((category) =>
            [category.name, category.slug, category.description]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(keyword)),
        );
    }, [categoryTree, filterText, flatCategories]);

    const selectedCategory = useMemo(() => {
        return (
            flatCategories.find(
                (category) => category.id === selectedCategoryId,
            ) ||
            flatCategories[0] ||
            null
        );
    }, [flatCategories, selectedCategoryId]);

    const departmentOptions = useMemo(() => departments.map((department) => ({
        label: `${department.name} (${department.code})`,
        value: department.id,
    })), [departments]);

    const parentCategory = selectedCategory?.parentId
        ? categories.find(
              (category) => category.id === selectedCategory.parentId,
          )
        : null;

    const selectedDepartments = useMemo(() => {
        const items = normalizeDepartmentPermissions(selectedCategory?.departmentPermissions);
        return items.map((item) => {
            const department = departments.find((entry) => entry.id === item.departmentId);
            return {
                ...item,
                departmentCode: department?.code,
                departmentName: department?.name || `Phòng ban #${item.departmentId}`,
            };
        });
    }, [departments, selectedCategory?.departmentPermissions]);


    const handleToggle = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    function expandAll() {
        setExpandedIds(collectAllIds(categoryTree));
    }

    function collapseAll() {
        setExpandedIds(new Set());
    }

    async function loadCategories() {
        setLoading(true);
        try {
            const data = await getCategories({ activeOnly: false });
            const list = normalizeList(data);
            setCategories(list);
            setSelectedCategoryId((currentId) => {
                if (
                    currentId &&
                    list.some((category) => category.id === currentId)
                )
                    return currentId;
                return list[0]?.id || null;
            });
            setExpandedIds(new Set());
        } catch (error) {
            toast.error(getApiErrorMessage(error));
            setCategories([]);
            setSelectedCategoryId(null);
        } finally {
            setLoading(false);
        }
    }


    async function loadDepartments() {
        try {
            const data = await getDepartments({ activeOnly: true });
            setDepartments(normalizeList(data));
        } catch {
            setDepartments([]);
        }
    }

    useEffect(() => {
        loadCategories();
        loadDepartments();
    }, []);

    useEffect(() => {
        if (!selectedCategory?.id) {
            setRelatedDocuments([]);
            setRelatedTotal(0);
            return;
        }

        async function loadRelatedDocuments() {
            setLoadingDocuments(true);
            try {
                const data = await searchDocuments({
                    categoryId: selectedCategory.id,
                    page: 0,
                    size: 5,
                    sort: "created_at_desc",
                });
                setRelatedDocuments(
                    getPageContent(data)
                        .map((item) => normalizeDocument(item.document || item))
                        .filter(Boolean),
                );
                setRelatedTotal(
                    data?.totalElements ??
                        data?.total ??
                        getPageContent(data).length,
                );
            } catch {
                setRelatedDocuments([]);
                setRelatedTotal(0);
            } finally {
                setLoadingDocuments(false);
            }
        }

        loadRelatedDocuments();
    }, [selectedCategory?.id]);

    function closeCreateModal() {
        setCreateModalOpen(false);
        form.resetFields();
    }

    function closeEditModal() {
        setEditModalOpen(false);
        setEditingCategory(null);
        editForm.resetFields();
    }

    function openCreateModal(parentId = null) {
        form.setFieldsValue({ parentId, isActive: true, sortOrder: 0, departmentPermissions: [], userPermissions: [] });
        setCreateModalOpen(true);
    }

    function openEditModal(category) {
        setEditingCategory(category);
        editForm.setFieldsValue({
            parentId: category.parentId,
            name: category.name,
            slug: category.slug,
            description: category.description,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            departmentPermissions: normalizeDepartmentPermissions(category.departmentPermissions),
            userPermissions: normalizeUserPermissions(category.userPermissions),
        });
        setEditModalOpen(true);
    }

    function toPayload(values) {
        const departmentPermissions = normalizeDepartmentPermissions(values.departmentPermissions);
        const departmentIds = departmentPermissions.map((entry) => entry.departmentId);
        if (new Set(departmentIds).size !== departmentIds.length) {
            throw new Error("Không thể lưu: mỗi phòng ban chỉ được thêm một lần trong danh mục.");
        }
        const invalidDepartment = departmentPermissions.find(
            (entry) => hasViewDependencyViolation(entry.permissions),
        );
        if (invalidDepartment) {
            throw new Error("Không thể lưu: quyền Sửa, Download và Xóa chỉ có hiệu lực khi phòng ban có quyền Xem. Vui lòng bật Xem hoặc bỏ các quyền phụ thuộc.");
        }
        return {
            parentId: values.parentId || null,
            name: values.name.trim(),
            slug: values.slug?.trim() || null,
            description: values.description?.trim() || null,
            sortOrder: Number(values.sortOrder || 0),
            isActive: values.isActive ?? true,
            departmentPermissions,
            userPermissions: normalizeUserPermissions(values.userPermissions),
        };
    }

    async function handleCreateCategory(values) {
        setSubmitting(true);
        try {
            await createCategory(toPayload(values));
            toast.success("Đã thêm danh mục mới");
            closeCreateModal();
            await loadCategories();
        } catch (error) {
            toast.error(getApiErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdateCategory(values) {
        if (!editingCategory) return;
        setSubmitting(true);
        try {
            await updateCategory(editingCategory.id, toPayload(values));
            toast.success("Đã cập nhật danh mục");
            closeEditModal();
            await loadCategories();
        } catch (error) {
            toast.error(getApiErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    }

    function handleDeleteCategory(category) {
        Modal.confirm({
            title: "Xác nhận xóa",
            content: `Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`,
            okText: "Xóa",
            okType: "danger",
            cancelText: "Hủy",
            onOk: async () => {
                try {
                    await deleteCategory(category.id);
                    toast.success("Đã xóa danh mục");
                    await loadCategories();
                } catch (error) {
                    toast.error(getApiErrorMessage(error));
                }
            },
        });
    }

    function renderCategoryForm(targetForm, onFinish, submitText) {
        const treeData = buildTreeSelectData(categoryTree, editingCategory?.id);

        return (
            <Form
                form={targetForm}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{ isActive: true, sortOrder: 0 }}
            >
                <Form.Item
                    name="name"
                    label="Tên danh mục"
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng nhập tên danh mục.",
                        },
                    ]}
                >
                    <Input placeholder="Ví dụ: Quy trình nội bộ" />
                </Form.Item>
                <Form.Item name="slug" label="Slug">
                    <Input placeholder="Tự tạo nếu bỏ trống" />
                </Form.Item>
                <Form.Item name="parentId" label="Danh mục cha">
                    <TreeSelect
                        allowClear
                        showSearch
                        treeDefaultExpandAll
                        placeholder="Không chọn nếu là danh mục gốc"
                        treeData={treeData}
                        treeLine
                        filterTreeNode={(input, node) =>
                            node.title
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                    />
                </Form.Item>
                <Form.Item name="description" label="Mô tả">
                    <Input.TextArea
                        rows={3}
                        placeholder="Nhập mô tả ngắn cho danh mục"
                    />
                </Form.Item>
                <Form.Item
                    name="isActive"
                    label="Trạng thái"
                    valuePropName="checked"
                >
                    <Switch
                        checkedChildren="Hoạt động"
                        unCheckedChildren="Không hoạt động"
                    />
                </Form.Item>
                <div className={styles.permissionBox}>
                    <div className={styles.permissionHeader}>
                        <div>
                            <h3>Phân quyền phòng ban</h3>
                            <p>
                                Quyền áp dụng cho mọi tài liệu thuộc danh mục này.
                                Upload có thể cấp độc lập; Sửa, Download và Xóa chỉ hoạt động khi đồng thời có quyền Xem.
                            </p>
                        </div>
                    </div>
                    <Form.List name="departmentPermissions">
                        {(fields, { add, remove }) => {
                            const currentPermissions = targetForm.getFieldValue("departmentPermissions") || [];
                            const selectedDepartmentIds = new Set(
                                currentPermissions.map((entry) => entry?.departmentId).filter(Boolean),
                            );
                            const addDepartment = () => {
                                const available = departments.find((department) => !selectedDepartmentIds.has(department.id));
                                if (!available) {
                                    Modal.warning({
                                        title: "Không còn phòng ban để thêm",
                                        content: "Mỗi phòng ban chỉ được thêm một lần trong danh mục.",
                                    });
                                    return;
                                }
                                add({ departmentId: available.id, permissions: ["VIEW"] });
                            };

                            return (
                            <div className={styles.permissionRows}>
                                {fields.map(({ key, name, ...restField }) => {
                                    const currentDepartmentId = targetForm.getFieldValue(["departmentPermissions", name, "departmentId"]);
                                    const otherSelectedIds = new Set(
                                        currentPermissions
                                            .filter((_, index) => index !== name)
                                            .map((entry) => entry?.departmentId)
                                            .filter(Boolean),
                                    );
                                    return (
                                    <div className={styles.permissionRow} key={key}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, "departmentId"]}
                                            rules={[{ required: true, message: "Chọn phòng ban" }]}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="Chọn phòng ban"
                                                options={departmentOptions.map((option) => ({
                                                    ...option,
                                                    disabled: option.value !== currentDepartmentId && otherSelectedIds.has(option.value),
                                                }))}
                                                optionFilterProp="label"
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, "permissions"]}
                                            rules={[{ required: true, message: "Chọn quyền" }]}
                                        >
                                            <Checkbox.Group
                                                options={CATEGORY_PERMISSIONS}
                                                onChange={(permissions) => {
                                                    if (hasViewDependencyViolation(permissions)) {
                                                        Modal.warning({
                                                            title: "Quyền chưa hợp lệ",
                                                            content: "Quyền Sửa, Download và Xóa chỉ có hiệu lực khi phòng ban có quyền Xem.",
                                                        });
                                                    }
                                                }}
                                            />
                                        </Form.Item>
                                        <Button danger onClick={() => remove(name)}>
                                            Xóa
                                        </Button>
                                    </div>
                                    );
                                })}
                                <Button type="dashed" onClick={addDepartment}>
                                    Thêm phòng ban
                                </Button>
                            </div>
                            );
                        }}
                    </Form.List>
                </div>
                <div className={styles.modalActions}>
                    <Button
                        onClick={
                            submitText === "Cập nhật"
                                ? closeEditModal
                                : closeCreateModal
                        }
                    >
                        Hủy
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<PlusOutlined />}
                        loading={isSubmitting}
                    >
                        {submitText}
                    </Button>
                </div>
            </Form>
        );
    }

    return (
        <div className={styles.page}>
            <main className={styles.pageBody}>
                <div className={styles.canvas}>
                    <div className={styles.container}>
                        <section className={styles.pageHeader}>
                            <div>
                                <h1>Quản lý danh mục</h1>
                                <p>
                                    Tổ chức tài liệu theo cây danh mục và nhóm
                                    nghiệp vụ.
                                </p>
                            </div>
                            <button
                                className={styles.primaryButton}
                                type="button"
                                onClick={() => openCreateModal()}
                            >
                                <PlusOutlined /> Thêm danh mục
                            </button>
                        </section>

                        <section className={styles.searchPanel}>
                            <SearchOutlined className={styles.searchIcon} />
                            <input
                                placeholder="Tìm danh mục..."
                                type="search"
                                value={filterText}
                                onChange={(event) =>
                                    setFilterText(event.target.value)
                                }
                            />
                        </section>

                        <section className={styles.managementGrid}>
                            <div className={styles.categoryListPanel}>
                                <div className={styles.treeHeader}>
                                    <h3>Cấu trúc danh mục</h3>
                                    <div>
                                        <button
                                            title="Mở rộng tất cả"
                                            type="button"
                                            onClick={expandAll}
                                        >
                                            <DownOutlined />
                                        </button>
                                        <button
                                            title="Thu gọn tất cả"
                                            type="button"
                                            onClick={collapseAll}
                                        >
                                            <UpOutlined />
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.categoryList}>
                                    {isLoading && (
                                        <div className={styles.emptyState}>
                                            Đang tải danh mục...
                                        </div>
                                    )}
                                    {!isLoading &&
                                        filteredCategoryTree.length === 0 && (
                                            <div className={styles.emptyState}>
                                                Không tìm thấy danh mục phù hợp
                                            </div>
                                        )}
                                    {!isLoading &&
                                        !filterText &&
                                        categoryTree.map((item) => (
                                            <TreeNode
                                                key={item.id}
                                                item={item}
                                                selectedId={
                                                    selectedCategory?.id
                                                }
                                                expandedIds={expandedIds}
                                                onSelect={setSelectedCategoryId}
                                                onToggle={handleToggle}
                                                onAddChild={(category) =>
                                                    openCreateModal(category.id)
                                                }
                                                onEdit={openEditModal}
                                                onDelete={handleDeleteCategory}
                                            />
                                        ))}
                                    {!isLoading &&
                                        filterText &&
                                        filteredCategoryTree.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={
                                                    selectedCategory?.id ===
                                                    item.id
                                                        ? `${styles.categoryCard} ${styles.categoryCardActive}`
                                                        : styles.categoryCard
                                                }
                                                style={{
                                                    "--category-level":
                                                        item.level || 0,
                                                }}
                                                onClick={() =>
                                                    setSelectedCategoryId(
                                                        item.id,
                                                    )
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.chevronPlaceholder
                                                    }
                                                />
                                                <span
                                                    className={
                                                        styles.categoryIcon
                                                    }
                                                >
                                                    <FolderFilled />
                                                </span>
                                                <span
                                                    className={
                                                        styles.categoryContent
                                                    }
                                                >
                                                    <span
                                                        className={
                                                            styles.categoryName
                                                        }
                                                    >
                                                        {item.name}
                                                    </span>
                                                    <span
                                                        className={
                                                            styles.categoryMeta
                                                        }
                                                    >
                                                        {item.slug} ·{" "}
                                                        {item.children
                                                            ?.length || 0}{" "}
                                                        danh mục con · {item.documentCount || 0} tài liệu
                                                    </span>
                                                </span>
                                                <span
                                                    className={
                                                        styles.cardActions
                                                    }
                                                >
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        title="Thêm danh mục con"
                                                        className={
                                                            styles.iconAction
                                                        }
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openCreateModal(
                                                                item.id,
                                                            );
                                                        }}
                                                    >
                                                        <PlusOutlined />
                                                    </span>
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        title="Sửa"
                                                        className={
                                                            styles.iconAction
                                                        }
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openEditModal(item);
                                                        }}
                                                    >
                                                        <EditOutlined />
                                                    </span>
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        title="Xóa"
                                                        className={
                                                            styles.iconAction
                                                        }
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleDeleteCategory(
                                                                item,
                                                            );
                                                        }}
                                                    >
                                                        <DeleteOutlined />
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            <aside className={styles.detailPanel}>
                                {selectedCategory ? (
                                    <>
                                        <div className={styles.detailHeader}>
                                            <span className={styles.detailIcon}>
                                                {selectedCategory.children
                                                    ?.length ? (
                                                    <FolderOpenFilled />
                                                ) : (
                                                    <FolderFilled />
                                                )}
                                            </span>
                                            <div>
                                                <h2>{selectedCategory.name}</h2>
                                                <p>{selectedCategory.slug}</p>
                                            </div>
                                        </div>
                                        <div className={styles.detailMetaGrid}>
                                            <button
                                                type="button"
                                                className={
                                                    activeDetailTab === "documents"
                                                        ? `${styles.detailMetaButton} ${styles.detailMetaButtonActive}`
                                                        : styles.detailMetaButton
                                                }
                                                onClick={() => setActiveDetailTab("documents")}
                                            >
                                                <strong>{relatedTotal}</strong>
                                                <span>Tài liệu</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={
                                                    activeDetailTab === "departments"
                                                        ? `${styles.detailMetaButton} ${styles.detailMetaButtonActive}`
                                                        : styles.detailMetaButton
                                                }
                                                onClick={() => setActiveDetailTab("departments")}
                                            >
                                                <strong>{selectedDepartments.length}</strong>
                                                <span>Phòng ban</span>
                                            </button>
                                            <div>
                                                <strong>
                                                    {selectedCategory.children
                                                        ?.length || 0}
                                                </strong>
                                                <span>Danh mục con</span>
                                            </div>
                                            <div>
                                                <strong>
                                                    {selectedCategory.isActive
                                                        ? "Hoạt động"
                                                        : "Tạm tắt"}
                                                </strong>
                                                <span>Trạng thái</span>
                                            </div>
                                        </div>
                                        <div className={styles.descriptionBox}>
                                            <strong>Mô tả</strong>
                                            <p>
                                                {selectedCategory.description ||
                                                    "Chưa có mô tả cho danh mục này."}
                                            </p>
                                            <span>
                                                Danh mục cha:{" "}
                                                {parentCategory?.name ||
                                                    "Danh mục gốc"}
                                            </span>
                                        </div>
                                        <div className={styles.relatedHeader}>
                                            {activeDetailTab === "documents"
                                                ? "Tài liệu trong danh mục"
                                                : "Phòng ban áp dụng danh mục"}
                                        </div>
                                        {activeDetailTab === "documents" ? (
                                            <div className={styles.documentList}>
                                                {isLoadingDocuments && (
                                                    <div
                                                        className={
                                                            styles.emptyState
                                                        }
                                                    >
                                                        Đang tải tài liệu...
                                                    </div>
                                                )}
                                                {!isLoadingDocuments &&
                                                    relatedDocuments.length ===
                                                        0 && (
                                                        <div
                                                            className={
                                                                styles.emptyState
                                                            }
                                                        >
                                                            Chưa có tài liệu liên
                                                            quan
                                                        </div>
                                                    )}
                                                {!isLoadingDocuments &&
                                                    relatedDocuments.map((doc) => (
                                                        <div
                                                            className={
                                                                styles.documentCard
                                                            }
                                                            key={doc.id}
                                                            onClick={() => navigate(`/documents/${doc.slug || doc.id}`)}
                                                            style={{ cursor: "pointer" }}
                                                        >
                                                            <FileTextOutlined />
                                                            <div>
                                                                <strong>
                                                                    {doc.title ||
                                                                        doc.fileName}
                                                                </strong>
                                                                <span>
                                                                    {doc.documentCode ||
                                                                        "—"}{" "}
                                                                    ·{" "}
                                                                    {formatFileSize(
                                                                        doc.fileSize,
                                                                    )}{" "}
                                                                    ·{" "}
                                                                    {formatDateTime(
                                                                        doc.updatedAt ||
                                                                            doc.createdAt,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        ) : (
                                            <div className={styles.documentList}>
                                                {selectedDepartments.length === 0 && (
                                                    <div className={styles.emptyState}>
                                                        Chưa có phòng ban nào áp dụng danh mục này
                                                    </div>
                                                )}
                                                {selectedDepartments.map((department) => (
                                                    <div
                                                        className={styles.documentCard}
                                                        key={department.departmentId}
                                                    >
                                                        <FolderFilled />
                                                        <div>
                                                            <strong>{department.departmentName}</strong>
                                                            <span>
                                                                {department.departmentCode || "—"} · Quyền: {department.permissions.join(", ")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className={styles.emptyState}>
                                        Chọn một danh mục để xem chi tiết
                                    </div>
                                )}
                            </aside>
                        </section>
                    </div>
                </div>
            </main>

            <Modal
                title="Thêm danh mục mới"
                open={isCreateModalOpen}
                onCancel={closeCreateModal}
                footer={null}
                destroyOnHidden
            >
                {renderCategoryForm(
                    form,
                    handleCreateCategory,
                    "Thêm danh mục",
                )}
            </Modal>

            <Modal
                title="Cập nhật danh mục"
                open={isEditModalOpen}
                onCancel={closeEditModal}
                footer={null}
                destroyOnHidden
            >
                {renderCategoryForm(editForm, handleUpdateCategory, "Cập nhật")}
            </Modal>
        </div>
    );
}
