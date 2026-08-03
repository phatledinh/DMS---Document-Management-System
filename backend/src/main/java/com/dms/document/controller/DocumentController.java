package com.dms.document.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.document.dto.DocumentDetailResponse;
import com.dms.document.dto.DocumentListItemResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.DocumentSearchResponse;
import com.dms.document.dto.PageResponse;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.SearchSuggestionResponse;
import com.dms.document.dto.UploadCompleteResponse;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.service.DocumentMetadataService;
import com.dms.document.service.DocumentPresignedUrlService;
import com.dms.document.service.DocumentSearchService;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/documents")
public class DocumentController {
    private final DocumentPresignedUrlService presignedUrlService;
    private final DocumentMetadataService metadataService;
    private final DocumentSearchService searchService;

    public DocumentController(
            DocumentPresignedUrlService presignedUrlService,
            DocumentMetadataService metadataService,
            DocumentSearchService searchService
    ) {
        this.presignedUrlService = presignedUrlService;
        this.metadataService = metadataService;
        this.searchService = searchService;
    }

    @GetMapping
    public ApiResponse<PageResponse<DocumentListItemResponse>> listDocuments(DocumentSearchRequest request) {
        return ApiResponse.success(metadataService.listDocuments(request));
    }

    @GetMapping("/search")
    public ApiResponse<DocumentSearchResponse> searchDocuments(DocumentSearchRequest request) {
        return ApiResponse.success(searchService.search(request));
    }

    @GetMapping("/search/suggestions")
    public ApiResponse<List<SearchSuggestionResponse>> searchSuggestions(String q, Integer limit) {
        return ApiResponse.success(searchService.suggestions(q, limit));
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDetailResponse> documentDetail(@PathVariable Long id) {
        return ApiResponse.success(metadataService.getDocumentDetail(id));
    }

    @PostMapping("/upload-init")
    public ResponseEntity<ApiResponse<UploadInitResponse>> initiateUpload(@Valid @RequestBody UploadInitRequest request) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Upload URL created", presignedUrlService.initiateUpload(request)));
    }

    @PostMapping("/{id}/upload-complete")
    public ApiResponse<UploadCompleteResponse> completeUpload(@PathVariable Long id) {
        return ApiResponse.success("Document upload accepted", presignedUrlService.completeUpload(id));
    }

    @GetMapping("/{id}/download-url")
    public ApiResponse<PresignedUrlResponse> downloadUrl(@PathVariable Long id, HttpServletRequest request) {
        return ApiResponse.success(presignedUrlService.createDownloadUrl(id, request));
    }

    @GetMapping("/{id}/preview-url")
    public ApiResponse<PresignedUrlResponse> previewUrl(@PathVariable Long id, HttpServletRequest request) {
        return ApiResponse.success(presignedUrlService.createPreviewUrl(id, request));
    }
}
