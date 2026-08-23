package com.dms.masterdata.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.masterdata.dto.TagRequest;
import com.dms.masterdata.dto.TagResponse;
import com.dms.masterdata.entity.Tag;
import com.dms.masterdata.mapper.TagMapper;
import com.dms.masterdata.repository.TagRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.List;

@Service
public class TagService {
    private final TagRepository tagRepository;
    private final TagMapper tagMapper;

    public TagService(TagRepository tagRepository, TagMapper tagMapper) {
        this.tagRepository = tagRepository;
        this.tagMapper = tagMapper;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getTags() {
        return tagRepository.findAllWithDocumentCount().stream()
                .map(row -> new TagResponse(
                        ((Number) row[0]).longValue(),
                        (String) row[1],
                        (String) row[2],
                        toOffsetDateTime(row[3]),
                        ((Number) row[4]).longValue()
                ))
                .toList();
    }

    private OffsetDateTime toOffsetDateTime(Object value) {
        if (value instanceof OffsetDateTime odt) return odt;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (value instanceof java.time.Instant instant) return instant.atOffset(java.time.ZoneOffset.UTC);
        if (value instanceof java.time.LocalDateTime ldt) return ldt.atOffset(java.time.ZoneOffset.UTC);
        return null;
    }

    @Transactional(readOnly = true)
    public TagResponse getTagById(Long id) {
        return tagMapper.toResponse(getTagEntityById(id));
    }

    @Transactional
    public TagResponse createTag(TagRequest request) {
        String slug = resolveSlug(request.slug(), request.name());
        if (tagRepository.existsByNameAndDeletedAtIsNull(request.name())) {
            throw new AppException(ErrorCodes.CONFLICT, "Tên tag đã được sử dụng", HttpStatus.CONFLICT);
        }
        if (tagRepository.existsBySlugAndDeletedAtIsNull(slug)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug tag đã được sử dụng", HttpStatus.CONFLICT);
        }
        Tag tag = new Tag();
        tag.setName(request.name());
        tag.setSlug(slug);
        return tagMapper.toResponse(tagRepository.save(tag));
    }

    @Transactional
    public TagResponse updateTag(Long id, TagRequest request) {
        Tag tag = getTagEntityById(id);
        String slug = resolveSlug(request.slug(), request.name());
        if (tagRepository.existsByNameAndIdNotAndDeletedAtIsNull(request.name(), id)) {
            throw new AppException(ErrorCodes.CONFLICT, "Tên tag đã được sử dụng", HttpStatus.CONFLICT);
        }
        if (tagRepository.existsBySlugAndIdNotAndDeletedAtIsNull(slug, id)) {
            throw new AppException(ErrorCodes.CONFLICT, "Slug tag đã được sử dụng", HttpStatus.CONFLICT);
        }
        tag.setName(request.name());
        tag.setSlug(slug);
        tag.setUpdatedAt(OffsetDateTime.now());
        return tagMapper.toResponse(tagRepository.save(tag));
    }

    @Transactional
    public void deleteTag(Long id) {
        Tag tag = getTagEntityById(id);
        tag.setDeletedAt(OffsetDateTime.now());
        tagRepository.save(tag);
    }

    private Tag getTagEntityById(Long id) {
        return tagRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCodes.NOT_FOUND, "Tag không tồn tại", HttpStatus.NOT_FOUND));
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
