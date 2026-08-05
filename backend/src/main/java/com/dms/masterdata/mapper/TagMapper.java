package com.dms.masterdata.mapper;

import com.dms.masterdata.dto.TagResponse;
import com.dms.masterdata.entity.Tag;
import org.springframework.stereotype.Component;

@Component
public class TagMapper {
    public TagResponse toResponse(Tag tag) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getSlug(),
                tag.getCreatedAt()
        );
    }
}
