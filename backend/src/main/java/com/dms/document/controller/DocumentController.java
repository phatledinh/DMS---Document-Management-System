package com.dms.document.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.document.dto.BatchDocumentLifecycleResponse;
import com.dms.document.dto.BatchDocumentOperationRequest;
import com.dms.document.dto.BatchMoveDocumentsRequest;
import com.dms.document.dto.BatchOperationResponse;
import com.dms.document.dto.BatchUploadCompleteRequest;
import com.dms.document.dto.BatchUploadInitRequest;
import com.dms.document.dto.BatchUploadResponse;
import com.dms.document.dto.DocumentDetailResponse;
import com.dms.document.dto.DocumentIdsRequest;
import com.dms.document.dto.DocumentLifecycleResponse;
import com.dms.document.dto.DocumentListItemResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.DocumentSearchResponse;
import com.dms.document.dto.PageResponse;
import com.dms.document.dto.PresignedUrlResponse;
import com.dms.document.dto.TrashDocumentResponse;
import com.dms.document.dto.SearchSuggestionResponse;
import com.dms.document.dto.UploadCompleteResponse;
import com.dms.document.dto.UploadInitRequest;
import com.dms.document.dto.UploadInitResponse;
import com.dms.document.dto.VersionRestoreResponse;
import com.dms.document.dto.VersionUploadCompleteResponse;
import com.dms.document.dto.VersionUploadInitRequest;
import com.dms.document.dto.VersionUploadInitResponse;
import com.dms.document.dto.DocumentVersionResponse;
import com.dms.document.service.DocumentLifecycleService;
import com.dms.document.service.DocumentMetadataService;
import com.dms.document.service.DocumentMoveService;
import com.dms.document.service.DocumentPresignedUrlService;
import com.dms.document.service.DocumentSearchService;
import com.dms.document.service.DocumentVersionService;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
    private final DocumentVersionService versionService;
    private final DocumentLifecycleService lifecycleService;
    private final DocumentMoveService moveService;

    public DocumentController(
            DocumentPresignedUrlService presignedUrlService,
            DocumentMetadataService metadataService,
            DocumentSearchService searchService,
            DocumentVersionService versionService,
            DocumentLifecycleService lifecycleService,
            DocumentMoveService moveService
    ) {
        this.presignedUrlService = presignedUrlService;
        this.metadataService = metadataService;
        this.searchService = searchService;
        this.versionService = versionService;
        this.lifecycleService = lifecycleService;
        this.moveService = moveService;
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDelete(@PathVariable Long id) {
        lifecycleService.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<DocumentLifecycleResponse> archive(@PathVariable Long id) {
        return ApiResponse.success("Document archived successfully", lifecycleService.archive(id));
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<DocumentLifecycleResponse> restore(@PathVariable Long id) {
        return ApiResponse.success("Document restored successfully", lifecycleService.restore(id));
    }

    @PostMapping("/{id}/retry-indexing")
    public ApiResponse<DocumentLifecycleResponse> retryIndexing(@PathVariable Long id) {
        return ApiResponse.success("Retry search refresh started", lifecycleService.retryIndexing(id));
    }

    @GetMapping("/trash")
    public ApiResponse<PageResponse<TrashDocumentResponse>> trash(DocumentSearchRequest request) {
        return ApiResponse.success(lifecycleService.listTrash(request));
    }

    @PostMapping("/trash/restore")
    public ApiResponse<BatchDocumentLifecycleResponse> restoreTrash(@Valid @RequestBody DocumentIdsRequest request) {
        return ApiResponse.success("Documents restored successfully", lifecycleService.restoreTrash(request.documentIds()));
    }

    @DeleteMapping("/trash/permanent-delete")
    public ApiResponse<BatchDocumentLifecycleResponse> permanentDelete(@Valid @RequestBody DocumentIdsRequest request) {
        return ApiResponse.success("Documents permanently deleted successfully", lifecycleService.permanentDelete(request.documentIds()));
    }

    @PostMapping("/batch-upload-init")
    public ApiResponse<BatchUploadResponse> initiateBatchUpload(@Valid @RequestBody BatchUploadInitRequest request) {
        return ApiResponse.success("Batch upload URLs created", presignedUrlService.initiateBatchUpload(request));
    }

    @PostMapping("/batch-upload-complete")
    public ApiResponse<BatchUploadResponse> completeBatchUpload(@Valid @RequestBody BatchUploadCompleteRequest request) {
        return ApiResponse.success("Batch upload completed", presignedUrlService.completeBatchUpload(request));
    }

    @PostMapping("/batch-delete")
    public ApiResponse<BatchOperationResponse> batchDelete(@Valid @RequestBody BatchDocumentOperationRequest request) {
        return ApiResponse.success("Batch delete completed", lifecycleService.batchDelete(request.documentIds()));
    }

    @PostMapping("/batch-archive")
    public ApiResponse<BatchOperationResponse> batchArchive(@Valid @RequestBody BatchDocumentOperationRequest request) {
        return ApiResponse.success("Batch archive completed", lifecycleService.batchArchive(request.documentIds()));
    }

    @PostMapping("/batch-restore")
    public ApiResponse<BatchOperationResponse> batchRestore(@Valid @RequestBody BatchDocumentOperationRequest request) {
        return ApiResponse.success("Batch restore completed", lifecycleService.batchRestore(request.documentIds()));
    }

    @PostMapping("/batch-move")
    public ApiResponse<BatchOperationResponse> batchMove(@Valid @RequestBody BatchMoveDocumentsRequest request) {
        return ApiResponse.success("Batch move completed", moveService.batchMove(request));
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

    @GetMapping("/{id}/versions")
    public ApiResponse<List<DocumentVersionResponse>> versions(@PathVariable Long id) {
        return ApiResponse.success(versionService.history(id));
    }

    @PostMapping("/{id}/versions/init")
    public ResponseEntity<ApiResponse<VersionUploadInitResponse>> initiateVersionUpload(
            @PathVariable Long id,
            @Valid @RequestBody VersionUploadInitRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Version upload URL created", versionService.initiateVersionUpload(id, request)));
    }

    @PostMapping("/{id}/versions/{versionId}/complete")
    public ApiResponse<VersionUploadCompleteResponse> completeVersionUpload(@PathVariable Long id, @PathVariable Long versionId) {
        return ApiResponse.success("New version upload accepted", versionService.completeVersionUpload(id, versionId));
    }

    @GetMapping("/{id}/versions/{versionId}/download-url")
    public ApiResponse<PresignedUrlResponse> versionDownloadUrl(@PathVariable Long id, @PathVariable Long versionId, HttpServletRequest request) {
        return ApiResponse.success(versionService.createDownloadUrl(id, versionId, request));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ApiResponse<VersionRestoreResponse> restoreVersion(@PathVariable Long id, @PathVariable Long versionId) {
        return ApiResponse.success("Document version restored successfully", versionService.restore(id, versionId));
    }
}
