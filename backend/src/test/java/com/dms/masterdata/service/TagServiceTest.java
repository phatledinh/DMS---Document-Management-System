package com.dms.masterdata.service;

import com.dms.audit.service.AuditLogService;
import com.dms.common.security.CurrentUserProvider;
import com.dms.masterdata.dto.TagRequest;
import com.dms.masterdata.dto.TagResponse;
import com.dms.masterdata.entity.Tag;
import com.dms.masterdata.mapper.TagMapper;
import com.dms.masterdata.repository.TagRepository;
import com.dms.identity.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TagServiceTest {
    @Mock TagRepository repository;
    @Mock TagMapper mapper;
    @Mock AuditLogService audit;
    @Mock CurrentUserProvider currentUser;
    private TagService service;
    private final User actor = new User();

    @BeforeEach
    void setUp() {
        service = new TagService(repository, mapper, audit, currentUser);
        when(currentUser.getRequiredUser()).thenReturn(actor);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createTag_logsCreate() {
        Tag tag = tag(3L, "Hợp đồng", "hop-dong");
        TagResponse response = new TagResponse(3L, "Hợp đồng", "hop-dong", null, 0L);
        when(repository.save(any())).thenReturn(tag);
        when(mapper.toResponse(tag)).thenReturn(response);

        service.createTag(new TagRequest("Hợp đồng", null));

        verify(audit).log(actor, "TAG_CREATE", "TAG", 3L, null, response);
    }

    @Test
    void updateTag_logsOldAndNew() {
        Tag tag = tag(3L, "Cũ", "cu");
        TagResponse oldValue = new TagResponse(3L, "Cũ", "cu", null, 0L);
        TagResponse newValue = new TagResponse(3L, "Mới", "moi", null, 0L);
        when(repository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(tag));
        when(repository.existsByNameAndIdNotAndDeletedAtIsNull("Mới", 3L)).thenReturn(false);
        when(repository.existsBySlugAndIdNotAndDeletedAtIsNull("moi", 3L)).thenReturn(false);
        when(mapper.toResponse(tag)).thenReturn(oldValue, newValue);

        service.updateTag(3L, new TagRequest("Mới", null));

        verify(audit).log(actor, "TAG_UPDATE", "TAG", 3L, oldValue, newValue);
    }

    @Test
    void deleteTag_logsPreviousSnapshot() {
        Tag tag = tag(3L, "Hợp đồng", "hop-dong");
        TagResponse oldValue = new TagResponse(3L, "Hợp đồng", "hop-dong", null, 0L);
        when(repository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(tag));
        when(mapper.toResponse(tag)).thenReturn(oldValue);

        service.deleteTag(3L);

        verify(audit).log(actor, "TAG_DELETE", "TAG", 3L, oldValue, null);
    }

    private Tag tag(Long id, String name, String slug) {
        Tag tag = new Tag();
        tag.setName(name);
        tag.setSlug(slug);
        return tag;
    }
}
