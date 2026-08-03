package com.dms.document.service;

import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentListItemResponse;
import com.dms.document.dto.DocumentSearchHighlightResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.DocumentSearchResponse;
import com.dms.document.dto.DocumentSearchResultResponse;
import com.dms.document.dto.SearchFacetValueResponse;
import com.dms.document.dto.SearchSuggestionResponse;
import com.dms.document.repository.DocumentSearchRepository;
import com.dms.document.repository.DocumentSearchRow;
import com.dms.identity.entity.User;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DocumentSearchService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final int DEFAULT_SUGGESTION_LIMIT = 10;
    private static final int MAX_SUGGESTION_LIMIT = 20;
    private static final PolicyFactory HIGHLIGHT_POLICY = new HtmlPolicyBuilder().allowElements("em").toFactory();

    private final CurrentUserProvider currentUserProvider;
    private final DocumentSearchRepository searchRepository;

    public DocumentSearchService(CurrentUserProvider currentUserProvider, DocumentSearchRepository searchRepository) {
        this.currentUserProvider = currentUserProvider;
        this.searchRepository = searchRepository;
    }

    @Transactional(readOnly = true)
    public DocumentSearchResponse search(DocumentSearchRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Instant startedAt = Instant.now();
        List<DocumentSearchRow> rows = searchRepository.search(user, request);
        long total = searchRepository.count(user, request);
        Map<String, List<SearchFacetValueResponse>> facets = facets(user, request);
        long latencyMs = Duration.between(startedAt, Instant.now()).toMillis();
        searchRepository.logSearch(user, request, total, latencyMs);
        return new DocumentSearchResponse(
                rows.stream().map(this::toResult).toList(),
                page(request),
                size(request),
                total,
                totalPages(total, size(request)),
                facets,
                normalize(request.q()),
                latencyMs
        );
    }

    @Transactional(readOnly = true)
    public List<SearchSuggestionResponse> suggestions(String prefix, Integer limit) {
        User user = currentUserProvider.getRequiredUser();
        Instant startedAt = Instant.now();
        List<SearchSuggestionResponse> suggestions = searchRepository.suggestions(user, prefix, limit(limit));
        long latencyMs = Duration.between(startedAt, Instant.now()).toMillis();
        searchRepository.logSuggestion(user, prefix, suggestions.size(), latencyMs);
        return suggestions;
    }

    private Map<String, List<SearchFacetValueResponse>> facets(User user, DocumentSearchRequest request) {
        Map<String, List<SearchFacetValueResponse>> facets = new LinkedHashMap<>();
        facets.put("categories", searchRepository.facets(user, request, "categories"));
        facets.put("departments", searchRepository.facets(user, request, "departments"));
        facets.put("fileTypes", searchRepository.facets(user, request, "fileTypes"));
        facets.put("accessLevels", searchRepository.facets(user, request, "accessLevels"));
        facets.put("tags", searchRepository.tagFacets(user, request));
        return facets;
    }

    private DocumentSearchResultResponse toResult(DocumentSearchRow row) {
        DocumentListItemResponse document = new DocumentListItemResponse(
                row.id(),
                row.title(),
                row.documentCode(),
                row.fileType(),
                row.fileSize(),
                row.status(),
                row.accessLevel(),
                row.versionNumber(),
                row.viewCount(),
                row.downloadCount(),
                row.categoryId(),
                row.departmentId(),
                row.ownerId(),
                row.uploadedBy(),
                row.effectiveDate(),
                row.expiryDate(),
                row.createdAt(),
                row.updatedAt()
        );
        return new DocumentSearchResultResponse(
                document,
                row.relevanceScore(),
                new DocumentSearchHighlightResponse(
                        sanitize(row.titleHighlight()),
                        sanitize(row.descriptionHighlight()),
                        sanitize(row.contentHighlight())
                )
        );
    }

    private String sanitize(String value) {
        return value == null || value.isBlank() ? null : HIGHLIGHT_POLICY.sanitize(value);
    }

    private int page(DocumentSearchRequest request) {
        return request.page() == null || request.page() < 0 ? DEFAULT_PAGE : request.page();
    }

    private int size(DocumentSearchRequest request) {
        return request.size() == null || request.size() < 1 ? DEFAULT_SIZE : Math.min(request.size(), MAX_SIZE);
    }

    private int limit(Integer value) {
        return value == null || value < 1 ? DEFAULT_SUGGESTION_LIMIT : Math.min(value, MAX_SUGGESTION_LIMIT);
    }

    private int totalPages(long total, int size) {
        return total == 0 ? 0 : (int) Math.ceil((double) total / size);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
