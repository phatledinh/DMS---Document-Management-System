package com.dms.document.service;

import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.DocumentSearchResponse;
import com.dms.document.dto.SearchFacetValueResponse;
import com.dms.document.dto.SearchSuggestionResponse;
import com.dms.document.repository.DocumentSearchRepository;
import com.dms.document.repository.DocumentSearchRow;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentSearchServiceTest {
    @Mock
    private CurrentUserProvider currentUserProvider;
    @Mock
    private DocumentSearchRepository searchRepository;

    private DocumentSearchService service;

    @BeforeEach
    void setUp() {
        service = new DocumentSearchService(currentUserProvider, searchRepository);
    }

    @Test
    void search_sanitizesHighlightsAndReturnsFacets() {
        User user = user();
        DocumentSearchRequest request = request("quy chế");
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(searchRepository.search(user, request)).thenReturn(List.of(row()));
        when(searchRepository.count(user, request)).thenReturn(1L);
        when(searchRepository.facets(user, request, "categories")).thenReturn(List.of(new SearchFacetValueResponse("1", "Policy", 1)));
        when(searchRepository.facets(user, request, "departments")).thenReturn(List.of());
        when(searchRepository.facets(user, request, "fileTypes")).thenReturn(List.of());
        when(searchRepository.facets(user, request, "accessLevels")).thenReturn(List.of());
        when(searchRepository.tagFacets(user, request)).thenReturn(List.of(new SearchFacetValueResponse("2", "HR", 1)));

        DocumentSearchResponse response = service.search(request);

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().getFirst().highlight().title()).isEqualTo("<em>Quy chế</em>");
        assertThat(response.content().getFirst().highlight().content()).doesNotContain("script");
        assertThat(response.facets()).containsKeys("categories", "departments", "fileTypes", "accessLevels", "tags");
        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.query()).isEqualTo("quy chế");
        verify(searchRepository).logSearch(eq(user), eq(request), eq(1L), any(Long.class));
    }

    @Test
    void suggestions_capsLimitAndLogsResults() {
        User user = user();
        when(currentUserProvider.getRequiredUser()).thenReturn(user);
        when(searchRepository.suggestions(user, "doc", 20)).thenReturn(List.of(new SearchSuggestionResponse("DOC-001", "DOCUMENT_CODE", 1L)));

        List<SearchSuggestionResponse> response = service.suggestions("doc", 100);

        assertThat(response).hasSize(1);
        verify(searchRepository).suggestions(user, "doc", 20);
        verify(searchRepository).logSuggestion(eq(user), eq("doc"), eq(1), any(Long.class));
    }

    private DocumentSearchRequest request(String query) {
        return new DocumentSearchRequest(query, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    private DocumentSearchRow row() {
        return new DocumentSearchRow(
                1L,
                "quy-che-nhan-su",
                "Quy chế nhân sự",
                "DOC-001",
                "PDF",
                1024L,
                "INDEXED",
                "PUBLIC",
                "1.0",
                3,
                2,
                1L,
                2L,
                10L,
                11L,
                null,
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                1.5,
                "<em>Quy chế</em>",
                null,
                "<em>Quy chế</em><script>alert(1)</script>"
        );
    }

    private User user() {
        User user = new User();
        user.setId(10L);
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPassword("hash");
        user.setRole(Role.USER);
        user.setDepartmentId(20L);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
