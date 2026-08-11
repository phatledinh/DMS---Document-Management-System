package com.dms.document.service;

import com.dms.category.entity.CategoryPermission;
import com.dms.category.repository.CategoryDepartmentPermissionRepository;
import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentDetailResponse;
import com.dms.document.dto.DocumentListItemResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.PageResponse;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentAccessLevel;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.repository.DocumentRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.repository.DepartmentRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DocumentMetadataService {
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final DocumentRepository documentRepository;
    private final CategoryDepartmentPermissionRepository categoryPermissionRepository;
    private final DepartmentRepository departmentRepository;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicyService accessPolicyService;

    public DocumentMetadataService(
            DocumentRepository documentRepository,
            CategoryDepartmentPermissionRepository categoryPermissionRepository,
            DepartmentRepository departmentRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService
    ) {
        this.documentRepository = documentRepository;
        this.categoryPermissionRepository = categoryPermissionRepository;
        this.departmentRepository = departmentRepository;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicyService = accessPolicyService;
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentListItemResponse> listDocuments(DocumentSearchRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Pageable pageable = pageable(request);
        Page<DocumentListItemResponse> page = documentRepository.findAll(listSpecification(user, request), pageable)
                .map(this::toListItem);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public DocumentDetailResponse getDocumentDetail(Long documentId) {
        User user = currentUserProvider.getRequiredUser();
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
        if (document.getPermanentlyDeletedAt() != null) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }
        AccessDecision decision = accessPolicyService.canViewMetadata(user, document);
        if (!decision.granted()) {
            throw detailDenied(decision);
        }
        return toDetail(document);
    }

    private Specification<Document> listSpecification(User user, DocumentSearchRequest request) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            boolean admin = user.getRole() == Role.ADMIN;
            predicates.add(builder.isNull(root.get("permanentlyDeletedAt")));
            if (admin && request.status() != null) {
                predicates.add(builder.equal(root.get("status"), request.status()));
            } else if (admin) {
                predicates.add(builder.not(root.get("status").in(DocumentStatus.ARCHIVED, DocumentStatus.DELETED)));
            } else {
                predicates.add(builder.equal(root.get("status"), DocumentStatus.INDEXED));
            }
            if (!admin) {
                List<Predicate> aclPredicates = new ArrayList<>();
                aclPredicates.add(builder.equal(root.get("accessLevel"), DocumentAccessLevel.PUBLIC));
                aclPredicates.add(builder.equal(root.get("ownerId"), user.getId()));
                if (user.getId() != null) {
                    Subquery<Long> userAccess = query.subquery(Long.class);
                    var userAccessRoot = userAccess.from(com.dms.document.entity.DocumentUserAccess.class);
                    userAccess.select(userAccessRoot.get("documentId"));
                    userAccess.where(
                            builder.equal(userAccessRoot.get("documentId"), root.get("id")),
                            builder.equal(userAccessRoot.get("userId"), user.getId())
                    );
                    aclPredicates.add(builder.exists(userAccess));
                }
                if (user.getDepartmentId() != null) {
                    Subquery<Long> departmentAccess = query.subquery(Long.class);
                    var departmentAccessRoot = departmentAccess.from(com.dms.document.entity.DocumentDepartmentAccess.class);
                    departmentAccess.select(departmentAccessRoot.get("documentId"));
                    departmentAccess.where(
                            builder.equal(departmentAccessRoot.get("documentId"), root.get("id")),
                            builder.equal(departmentAccessRoot.get("departmentId"), user.getDepartmentId())
                    );
                    aclPredicates.add(builder.exists(departmentAccess));
                }
                predicates.add(builder.or(aclPredicates.toArray(Predicate[]::new)));
            }
            applyFilters(request, root, builder, predicates, admin);
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void applyFilters(DocumentSearchRequest request, jakarta.persistence.criteria.Root<Document> root, jakarta.persistence.criteria.CriteriaBuilder builder, List<Predicate> predicates, boolean admin) {
        if (request.categoryId() != null) {
            predicates.add(builder.equal(root.get("categoryId"), request.categoryId()));
        }
        if (request.departmentId() != null) {
            predicates.add(builder.equal(root.get("departmentId"), request.departmentId()));
        }
        if (request.fileType() != null && !request.fileType().isBlank()) {
            predicates.add(builder.equal(builder.upper(root.get("fileType")), request.fileType().trim().toUpperCase()));
        }
        if (request.resolvedAccessLevel() != null) {
            predicates.add(builder.equal(root.get("accessLevel"), request.resolvedAccessLevel()));
        }
        if (request.ownerId() != null) {
            predicates.add(builder.equal(root.get("ownerId"), request.ownerId()));
        }
        if (request.uploadedBy() != null) {
            predicates.add(builder.equal(root.get("uploadedBy"), request.uploadedBy()));
        }
        if (!admin && request.status() != null && request.status() != DocumentStatus.INDEXED) {
            predicates.add(builder.disjunction());
        }
        LocalDate from = request.resolvedDateFrom();
        if (from != null) {
            predicates.add(builder.greaterThanOrEqualTo(root.get("effectiveDate"), from));
        }
        LocalDate to = request.resolvedDateTo();
        if (to != null) {
            predicates.add(builder.lessThanOrEqualTo(root.get("effectiveDate"), to));
        }
    }

    private Pageable pageable(DocumentSearchRequest request) {
        int page = request.page() == null || request.page() < 0 ? DEFAULT_PAGE : request.page();
        int size = request.size() == null || request.size() < 1 ? DEFAULT_SIZE : Math.min(request.size(), MAX_SIZE);
        return PageRequest.of(page, size, sort(request.sort()));
    }

    private Sort sort(String value) {
        return switch (value == null ? "created_at_desc" : value) {
            case "created_at_asc" -> Sort.by(Sort.Direction.ASC, "createdAt");
            case "updated_at_desc" -> Sort.by(Sort.Direction.DESC, "updatedAt");
            case "title_asc" -> Sort.by(Sort.Direction.ASC, "title");
            case "view_count_desc" -> Sort.by(Sort.Direction.DESC, "viewCount");
            case "download_count_desc" -> Sort.by(Sort.Direction.DESC, "downloadCount");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    private RuntimeException detailDenied(AccessDecision decision) {
        if ("DOCUMENT_NOT_READY".equals(decision.denialReason())) {
            return new AppException(ErrorCodes.DOCUMENT_NOT_READY, "Document is not ready", HttpStatus.CONFLICT);
        }
        return new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
    }

    private DocumentListItemResponse toListItem(Document document) {
        return new DocumentListItemResponse(
                document.getId(),
                document.getTitle(),
                document.getDocumentCode(),
                document.getFileType(),
                document.getFileSize(),
                document.getStatus().name(),
                document.getAccessLevel().name(),
                document.getVersionNumber(),
                document.getViewCount(),
                document.getDownloadCount(),
                document.getCategoryId(),
                document.getDepartmentId(),
                document.getOwnerId(),
                document.getUploadedBy(),
                document.getEffectiveDate(),
                document.getExpiryDate(),
                document.getCreatedAt(),
                document.getUpdatedAt()
        );
    }

    private List<DocumentDetailResponse.AuthorizedDepartmentResponse> authorizedDepartments(Long categoryId) {
        if (categoryId == null) {
            return List.of();
        }
        List<Long> departmentIds = categoryPermissionRepository.findByCategoryId(categoryId).stream()
                .filter(permission -> permission.getPermission() == CategoryPermission.VIEW)
                .map(permission -> permission.getDepartmentId())
                .distinct()
                .toList();
        if (departmentIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Department> departmentsById = departmentRepository.findByIdInAndDeletedAtIsNull(departmentIds).stream()
                .collect(Collectors.toMap(Department::getId, Function.identity()));
        return departmentIds.stream()
                .map(departmentId -> {
                    Department department = departmentsById.get(departmentId);
                    return new DocumentDetailResponse.AuthorizedDepartmentResponse(
                            departmentId,
                            department != null ? department.getName() : "Phòng ban #" + departmentId,
                            department != null ? department.getCode() : null
                    );
                })
                .toList();
    }

    private DocumentDetailResponse toDetail(Document document) {
        String baseEndpoint = "/documents/" + document.getId();
        return new DocumentDetailResponse(
                document.getId(),
                document.getTitle(),
                document.getSlug(),
                document.getDescription(),
                document.getDocumentCode(),
                document.getFileName(),
                document.getFileType(),
                document.getMimeType(),
                document.getFileSize(),
                document.getPageCount(),
                document.getStatus().name(),
                document.getAccessLevel().name(),
                document.getVersionNumber(),
                document.getViewCount(),
                document.getDownloadCount(),
                document.getCategoryId(),
                document.getDepartmentId(),
                document.getOwnerId(),
                document.getUploadedBy(),
                document.getEffectiveDate(),
                document.getExpiryDate(),
                baseEndpoint + "/preview-url",
                baseEndpoint + "/download-url",
                document.getCreatedAt(),
                document.getUpdatedAt(),
                authorizedDepartments(document.getCategoryId())
        );
    }
}
