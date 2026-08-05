package com.dms.masterdata.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.masterdata.dto.CategoryRequest;
import com.dms.masterdata.dto.CategoryResponse;
import com.dms.masterdata.entity.Category;
import com.dms.masterdata.mapper.CategoryMapper;
import com.dms.masterdata.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.List;

@Service
public class CategoryService {
    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;

    public CategoryService(CategoryRepository categoryRepository, CategoryMapper categoryMapper) {
        this.categoryRepository = categoryRepository;
        this.categoryMapper = categoryMapper;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(boolean activeOnly) {
        List<Category> categories = activeOnly
                ? categoryRepository.findByIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAscNameAsc()
                : categoryRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAsc();
        return categories.stream().map(categoryMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Long id) {
        return categoryMapper.toResponse(getCategoryEntityById(id));
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        Category category = new Category();
        applyRequest(category, request);
        String slug = resolveSlug(request.slug(), request.name());
        if (categoryRepository.existsBySlugAndDeletedAtIsNull(slug)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug danh mục đã được sử dụng", HttpStatus.CONFLICT);
        }
        category.setSlug(slug);
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, CategoryRequest request) {
        Category category = getCategoryEntityById(id);
        applyRequest(category, request);
        String slug = resolveSlug(request.slug(), request.name());
        if (categoryRepository.existsBySlugAndIdNotAndDeletedAtIsNull(slug, id)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug danh mục đã được sử dụng", HttpStatus.CONFLICT);
        }
        category.setSlug(slug);
        category.setUpdatedAt(OffsetDateTime.now());
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = getCategoryEntityById(id);
        category.setDeletedAt(OffsetDateTime.now());
        category.setActive(false);
        categoryRepository.save(category);
    }

    private void applyRequest(Category category, CategoryRequest request) {
        Category parent = request.parentId() == null ? null : getCategoryEntityById(request.parentId());
        if (parent != null && category.getId() != null && parent.getId().equals(category.getId())) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Danh mục cha không hợp lệ", HttpStatus.BAD_REQUEST);
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

    private Category getCategoryEntityById(Long id) {
        return categoryRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Danh mục không tồn tại", HttpStatus.NOT_FOUND));
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
