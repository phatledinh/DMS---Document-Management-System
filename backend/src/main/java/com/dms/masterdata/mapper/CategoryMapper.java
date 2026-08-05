package com.dms.masterdata.mapper;

import com.dms.masterdata.dto.CategoryResponse;
import com.dms.masterdata.entity.Category;
import org.springframework.stereotype.Component;

@Component
public class CategoryMapper {
    public CategoryResponse toResponse(Category category) {
        Long parentId = category.getParent() == null ? null : category.getParent().getId();
        return new CategoryResponse(
                category.getId(),
                parentId,
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                category.getIcon(),
                category.getSortOrder(),
                category.isActive(),
                category.getCreatedAt()
        );
    }
}
