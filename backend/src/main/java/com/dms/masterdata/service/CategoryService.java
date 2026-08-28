package com.dms.masterdata.service;

import com.dms.audit.service.AuditLogService;
import com.dms.category.entity.CategoryDepartmentPermission;
import com.dms.category.entity.CategoryPermission;
import com.dms.category.repository.CategoryDepartmentPermissionRepository;
import com.dms.document.repository.DocumentRepository;
import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.identity.entity.User;
import com.dms.masterdata.dto.CategoryRequest;
import com.dms.masterdata.dto.CategoryResponse;
import com.dms.masterdata.entity.Category;
import com.dms.masterdata.mapper.CategoryMapper;
import com.dms.masterdata.repository.CategoryRepository;
import com.dms.masterdata.repository.DepartmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CategoryService {
    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;
    private final DepartmentRepository departmentRepository;
    private final CategoryDepartmentPermissionRepository departmentPermissionRepository;
    private final CurrentUserProvider currentUserProvider;
    private final AuditLogService auditLogService;
    private final DocumentRepository documentRepository;

    public CategoryService(
            CategoryRepository categoryRepository,
            CategoryMapper categoryMapper,
            DepartmentRepository departmentRepository,
            CategoryDepartmentPermissionRepository departmentPermissionRepository,
            CurrentUserProvider currentUserProvider,
            AuditLogService auditLogService,
            DocumentRepository documentRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.categoryMapper = categoryMapper;
        this.departmentRepository = departmentRepository;
        this.departmentPermissionRepository = departmentPermissionRepository;
        this.currentUserProvider = currentUserProvider;
        this.auditLogService = auditLogService;
        this.documentRepository = documentRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(boolean activeOnly) {
        List<Category> categories = activeOnly
                ? categoryRepository.findByIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAscNameAsc()
                : categoryRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAsc();
        List<Long> categoryIds = categories.stream().map(Category::getId).toList();
        Map<Long, List<CategoryResponse.DepartmentPermissionResponse>> departmentPermissions = departmentPermissionsByCategory(categoryIds);
        Map<Long, Long> documentCounts = getDocumentCountsByCategoryIds(categoryIds);
        return categories.stream()
                .map(category -> categoryMapper.toResponse(
                        category,
                        departmentPermissions.getOrDefault(category.getId(), List.of()),
                        documentCounts.getOrDefault(category.getId(), 0L)
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Long id) {
        Category category = getCategoryEntityById(id);
        return response(category);
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        Category category = new Category();
        applyRequest(category, request);
        String slug = resolveSlug(request.slug(), request.name());
        if (categoryRepository.existsBySlugAndDeletedAtIsNull(slug)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug danh muc da duoc su dung", HttpStatus.CONFLICT);
        }
        category.setSlug(slug);
        User actor = currentUserProvider.getRequiredUser();
        Category saved = categoryRepository.save(category);
        replacePermissions(saved.getId(), request.departmentPermissions(), actor);
        CategoryResponse response = response(saved);
        auditLogService.log(actor, "CATEGORY_CREATE", "CATEGORY", saved.getId(), null, response);
        return response;
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, CategoryRequest request) {
        Category category = getCategoryEntityById(id);
        User actor = currentUserProvider.getRequiredUser();
        CategoryResponse oldValue = response(category);
        applyRequest(category, request);
        String slug = resolveSlug(request.slug(), request.name());
        if (categoryRepository.existsBySlugAndIdNotAndDeletedAtIsNull(slug, id)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug danh muc da duoc su dung", HttpStatus.CONFLICT);
        }
        category.setSlug(slug);
        category.setUpdatedAt(OffsetDateTime.now());
        Category saved = categoryRepository.save(category);
        replacePermissions(saved.getId(), request.departmentPermissions(), actor);
        CategoryResponse response = response(saved);
        auditLogService.log(actor, "CATEGORY_UPDATE", "CATEGORY", saved.getId(), oldValue, response);
        return response;
    }

    @Transactional
    public void deleteCategory(Long id) {
        User actor = currentUserProvider.getRequiredUser();
        Category category = getCategoryEntityById(id);
        CategoryResponse oldValue = response(category);
        departmentPermissionRepository.deleteByCategoryId(id);
        category.setDeletedAt(OffsetDateTime.now());
        category.setActive(false);
        categoryRepository.save(category);
        auditLogService.log(actor, "CATEGORY_DELETE", "CATEGORY", id, oldValue, null);
    }

    private void applyRequest(Category category, CategoryRequest request) {
        Category parent = request.parentId() == null ? null : getCategoryEntityById(request.parentId());
        if (parent != null && category.getId() != null && parent.getId().equals(category.getId())) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Danh muc cha khong hop le", HttpStatus.BAD_REQUEST);
        }
        category.setParent(parent);
        category.setName(request.name());
        category.setDescription(request.description());
        category.setIcon(request.icon());
        if (request.sortOrder() != null) {
            category.setSortOrder(request.sortOrder());
        }
        if (request.isActive() != null) {
            category.setActive(request.isActive());
        }
    }

    private void replacePermissions(
            Long categoryId,
            List<CategoryRequest.DepartmentPermissionRequest> requestedDepartmentPermissions,
            User actor
    ) {
        departmentPermissionRepository.deleteByCategoryId(categoryId);
        saveDepartmentPermissions(categoryId, requestedDepartmentPermissions, actor);
    }

    private void saveDepartmentPermissions(Long categoryId, List<CategoryRequest.DepartmentPermissionRequest> requestedPermissions, User actor) {
        if (requestedPermissions == null || requestedPermissions.isEmpty()) {
            return;
        }
        Map<Long, Set<CategoryPermission>> normalized = new LinkedHashMap<>();
        for (CategoryRequest.DepartmentPermissionRequest entry : requestedPermissions) {
            if (entry == null || entry.departmentId() == null || entry.permissions() == null || entry.permissions().isEmpty()) {
                continue;
            }
            if (departmentRepository.findByIdAndDeletedAtIsNull(entry.departmentId()).isEmpty()) {
                throw new AppException(ErrorCodes.NOT_FOUND, "Phong ban khong ton tai", HttpStatus.NOT_FOUND);
            }
            Set<CategoryPermission> permissions = normalized.computeIfAbsent(entry.departmentId(), ignored -> EnumSet.noneOf(CategoryPermission.class));
            for (String permission : entry.permissions()) {
                permissions.add(parsePermission(permission));
            }
            if (!permissions.contains(CategoryPermission.VIEW)
                    && permissions.stream().anyMatch(permission -> permission == CategoryPermission.EDIT
                    || permission == CategoryPermission.DOWNLOAD
                    || permission == CategoryPermission.DELETE)) {
                throw new AppException(
                        ErrorCodes.VALIDATION_ERROR,
                        "Quyen Sua, Download va Xoa chi co hieu luc khi phong ban co quyen Xem",
                        HttpStatus.BAD_REQUEST
                );
            }
        }
        List<CategoryDepartmentPermission> rows = new ArrayList<>();
        for (Map.Entry<Long, Set<CategoryPermission>> entry : normalized.entrySet()) {
            for (CategoryPermission permission : entry.getValue()) {
                CategoryDepartmentPermission row = new CategoryDepartmentPermission();
                row.setCategoryId(categoryId);
                row.setDepartmentId(entry.getKey());
                row.setPermission(permission);
                row.setGrantedBy(actor.getId());
                rows.add(row);
            }
        }
        departmentPermissionRepository.saveAll(rows);
    }


    private CategoryPermission parsePermission(String value) {
        try {
            return CategoryPermission.valueOf(value);
        } catch (RuntimeException exception) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Quyen danh muc khong hop le", HttpStatus.BAD_REQUEST);
        }
    }

    private CategoryResponse response(Category category) {
        Long categoryId = category.getId();
        long documentCount = getDocumentCountsByCategoryIds(List.of(categoryId)).getOrDefault(categoryId, 0L);
        return categoryMapper.toResponse(category, departmentPermissionsForCategory(categoryId), documentCount);
    }

    private Map<Long, Long> getDocumentCountsByCategoryIds(List<Long> categoryIds) {
        if (categoryIds.isEmpty()) return Map.of();
        return documentRepository.countDocumentsByCategoryIds(categoryIds).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).longValue()
                ));
    }

    private List<CategoryResponse.DepartmentPermissionResponse> departmentPermissionsForCategory(Long categoryId) {
        return departmentPermissionRowsToResponse(departmentPermissionRepository.findByCategoryId(categoryId));
    }


    private Map<Long, List<CategoryResponse.DepartmentPermissionResponse>> departmentPermissionsByCategory(List<Long> categoryIds) {
        if (categoryIds.isEmpty()) {
            return Map.of();
        }
        return departmentPermissionRepository.findByCategoryIdIn(categoryIds).stream()
                .collect(Collectors.groupingBy(
                        CategoryDepartmentPermission::getCategoryId,
                        Collectors.collectingAndThen(Collectors.toList(), this::departmentPermissionRowsToResponse)
                ));
    }


    private List<CategoryResponse.DepartmentPermissionResponse> departmentPermissionRowsToResponse(List<CategoryDepartmentPermission> rows) {
        Map<Long, List<String>> byDepartment = rows.stream()
                .collect(Collectors.groupingBy(
                        CategoryDepartmentPermission::getDepartmentId,
                        LinkedHashMap::new,
                        Collectors.mapping(row -> row.getPermission().name(), Collectors.toList())
                ));
        return byDepartment.entrySet().stream()
                .map(entry -> new CategoryResponse.DepartmentPermissionResponse(entry.getKey(), entry.getValue().stream().sorted().toList()))
                .sorted(Comparator.comparing(CategoryResponse.DepartmentPermissionResponse::departmentId))
                .toList();
    }


    private Category getCategoryEntityById(Long id) {
        return categoryRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Danh muc khong ton tai", HttpStatus.NOT_FOUND));
    }

    private String resolveSlug(String slug, String name) {
        String value = slug == null || slug.isBlank() ? name : slug;
        return Normalizer.normalize(value.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }
}
