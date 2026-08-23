package com.dms.masterdata.mapper;

import com.dms.masterdata.dto.TagResponse;
import com.dms.masterdata.entity.Tag;
import org.springframework.stereotype.Component;

@Component
public class TagMapper {
    public TagResponse toResponse(Tag tag) {
        return toResponse(tag, 0L);
    }

    public TagResponse toResponse(Tag tag, long documentCount) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getSlug(),
                tag.getCreatedAt(),
                documentCount
        );
    }
}
