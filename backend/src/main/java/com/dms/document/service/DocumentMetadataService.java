package com.dms.document.service;

import com.dms.category.entity.CategoryPermission;
import com.dms.category.repository.CategoryDepartmentPermissionRepository;
import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.CurrentUserProvider;
import com.dms.document.dto.DocumentDetailResponse;
import com.dms.document.dto.DocumentListItemResponse;
import com.dms.document.dto.DocumentSearchRequest;
import com.dms.document.dto.DocumentUpdateRequest;
import com.dms.document.dto.PageResponse;
import com.dms.document.entity.Document;
import com.dms.document.entity.DocumentStatus;
import com.dms.document.policy.AccessDecision;
import com.dms.document.policy.DocumentAccessPolicyService;
import com.dms.document.repository.DocumentRepository;
import com.dms.document.repository.DocumentTagRepository;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.repository.UserRepository;
import com.dms.masterdata.entity.Category;
import com.dms.masterdata.entity.Department;
import com.dms.masterdata.repository.CategoryRepository;
import com.dms.masterdata.repository.DepartmentRepository;
import com.dms.masterdata.repository.TagRepository;
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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final DocumentTagRepository documentTagRepository;
    private final TagRepository tagRepository;
    private final CurrentUserProvider currentUserProvider;
    private final DocumentAccessPolicyService accessPolicyService;

    public DocumentMetadataService(
            DocumentRepository documentRepository,
            CategoryDepartmentPermissionRepository categoryPermissionRepository,
            DepartmentRepository departmentRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            DocumentTagRepository documentTagRepository,
            TagRepository tagRepository,
            CurrentUserProvider currentUserProvider,
            DocumentAccessPolicyService accessPolicyService
    ) {
        this.documentRepository = documentRepository;
        this.categoryPermissionRepository = categoryPermissionRepository;
        this.departmentRepository = departmentRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.documentTagRepository = documentTagRepository;
        this.tagRepository = tagRepository;
        this.currentUserProvider = currentUserProvider;
        this.accessPolicyService = accessPolicyService;
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentListItemResponse> listDocuments(DocumentSearchRequest request) {
        User user = currentUserProvider.getRequiredUser();
        Pageable pageable = pageable(request);
        Page<Document> documentPage = documentRepository.findAll(listSpecification(user, request), pageable);

        Set<Long> categoryIds = documentPage.stream().map(Document::getCategoryId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> departmentIds = documentPage.stream().map(Document::getDepartmentId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> userIds = documentPage.stream().map(Document::getUploadedBy).filter(Objects::nonNull).collect(Collectors.toSet());

        Map<Long, String> categoryNames = categoryRepository.findAllById(categoryIds).stream().collect(Collectors.toMap(Category::getId, Category::getName));
        Map<Long, String> departmentNames = departmentRepository.findAllById(departmentIds).stream().collect(Collectors.toMap(Department::getId, Department::getName));
        Map<Long, String> userNames = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getName));

        List<DocumentListItemResponse> items = documentPage.stream()
                .map(doc -> toListItem(doc, categoryNames.get(doc.getCategoryId()), departmentNames.get(doc.getDepartmentId()), userNames.get(doc.getUploadedBy())))
                .toList();

        return new PageResponse<>(items, documentPage.getNumber(), documentPage.getSize(), documentPage.getTotalElements(), documentPage.getTotalPages());
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
        
        String categoryName = document.getCategoryId() != null ? categoryRepository.findById(document.getCategoryId()).map(Category::getName).orElse(null) : null;
        String departmentName = document.getDepartmentId() != null ? departmentRepository.findById(document.getDepartmentId()).map(Department::getName).orElse(null) : null;
        String uploadedByName = document.getUploadedBy() != null ? userRepository.findById(document.getUploadedBy()).map(User::getName).orElse(null) : null;

        return toDetail(document, categoryName, departmentName, uploadedByName);
    }

    @Transactional(readOnly = true)
    public Long getDocumentIdBySlug(String slug) {
        return documentRepository.findBySlug(slug)
                .map(Document::getId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found by slug", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public DocumentDetailResponse updateDocument(Long documentId, DocumentUpdateRequest request) {
        User user = currentUserProvider.getRequiredUser();
        if (user.getRole() != Role.ADMIN) {
            throw new AppException(ErrorCodes.ACCESS_DENIED, "Admin role is required", HttpStatus.FORBIDDEN);
        }

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND));
        if (document.getPermanentlyDeletedAt() != null || document.getStatus() == DocumentStatus.DELETED) {
            throw new AppException(ErrorCodes.DOCUMENT_NOT_FOUND, "Document not found", HttpStatus.NOT_FOUND);
        }

        Category category = categoryRepository.findByIdAndDeletedAtIsNull(request.categoryId())
                .filter(Category::isActive)
                .orElseThrow(() -> new AppException(ErrorCodes.VALIDATION_ERROR, "Danh mục không tồn tại hoặc đã ngừng hoạt động", HttpStatus.BAD_REQUEST));
        if (request.effectiveDate() != null && request.expiryDate() != null
                && !request.expiryDate().isAfter(request.effectiveDate())) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Ngày hết hạn phải sau ngày hiệu lực", HttpStatus.BAD_REQUEST);
        }

        List<Long> tagIds = request.tagIds() == null
                ? List.of()
                : request.tagIds().stream().filter(Objects::nonNull).distinct().toList();
        long validTagCount = tagRepository.findAllById(tagIds).stream()
                .filter(tag -> tag.getDeletedAt() == null)
                .count();
        if (validTagCount != tagIds.size()) {
            throw new AppException(ErrorCodes.VALIDATION_ERROR, "Một hoặc nhiều tag không tồn tại", HttpStatus.BAD_REQUEST);
        }

        document.setTitle(request.title().trim());
        document.setDescription(request.description() == null || request.description().isBlank() ? null : request.description().trim());
        document.setCategoryId(category.getId());
        document.setEffectiveDate(request.effectiveDate());
        document.setExpiryDate(request.expiryDate());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        documentTagRepository.deleteByDocumentId(documentId);
        if (!tagIds.isEmpty()) {
            documentTagRepository.saveAll(tagIds.stream().map(tagId -> {
                com.dms.document.entity.DocumentTag link = new com.dms.document.entity.DocumentTag();
                link.setDocumentId(documentId);
                link.setTagId(tagId);
                return link;
            }).toList());
        }

        String departmentName = document.getDepartmentId() != null
                ? departmentRepository.findById(document.getDepartmentId()).map(Department::getName).orElse(null)
                : null;
        String uploadedByName = document.getUploadedBy() != null
                ? userRepository.findById(document.getUploadedBy()).map(User::getName).orElse(null)
                : null;
        return toDetail(document, category.getName(), departmentName, uploadedByName);
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
                predicates.add(categoryViewPermissionPredicate(user, root, query, builder));
            }
            applyFilters(user, request, root, builder, predicates, admin);
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Predicate categoryViewPermissionPredicate(
            User user,
            jakarta.persistence.criteria.Root<Document> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query,
            jakarta.persistence.criteria.CriteriaBuilder builder
    ) {
        Subquery<Long> departmentPermission = query.subquery(Long.class);
        var departmentPermissionRoot = departmentPermission.from(com.dms.category.entity.CategoryDepartmentPermission.class);
        departmentPermission.select(departmentPermissionRoot.get("categoryId"));

        Subquery<Long> userDeptSubquery = query.subquery(Long.class);
        var userDeptRoot = userDeptSubquery.from(com.dms.identity.entity.UserDepartment.class);
        userDeptSubquery.select(userDeptRoot.get("departmentId"));
        userDeptSubquery.where(builder.equal(userDeptRoot.get("userId"), user.getId()));

        Predicate departmentIdMatches = builder.or(
                builder.in(departmentPermissionRoot.get("departmentId")).value(userDeptSubquery),
                user.getDepartmentId() != null ? builder.equal(departmentPermissionRoot.get("departmentId"), user.getDepartmentId()) : builder.disjunction()
        );

        departmentPermission.where(
                departmentIdMatches,
                builder.equal(departmentPermissionRoot.get("categoryId"), root.get("categoryId")),
                builder.equal(departmentPermissionRoot.get("permission"), CategoryPermission.VIEW)
        );

        return builder.exists(departmentPermission);
    }

    private void applyFilters(User user, DocumentSearchRequest request, jakarta.persistence.criteria.Root<Document> root, jakarta.persistence.criteria.CriteriaBuilder builder, List<Predicate> predicates, boolean admin) {
        if (request.categoryId() != null) {
            predicates.add(builder.equal(root.get("categoryId"), request.categoryId()));
        }
        if (request.departmentId() != null) {
            predicates.add(builder.equal(root.get("departmentId"), request.departmentId()));
        }
        if (request.fileType() != null && !request.fileType().isBlank()) {
            predicates.add(builder.equal(builder.upper(root.get("fileType")), request.fileType().trim().toUpperCase()));
        }
        if (request.ownerId() != null) {
            predicates.add(builder.equal(root.get("ownerId"), request.ownerId()));
        }
        if (request.uploadedBy() != null) {
            predicates.add(builder.equal(root.get("uploadedBy"), request.uploadedBy()));
        }
        if (request.status() != null) {
            boolean isMyDocuments = (request.ownerId() != null && request.ownerId().equals(user.getId())) ||
                                    (request.uploadedBy() != null && request.uploadedBy().equals(user.getId()));
            if (admin || isMyDocuments || request.status() == DocumentStatus.INDEXED) {
                predicates.add(builder.equal(root.get("status"), request.status()));
            } else {
                predicates.add(builder.disjunction());
            }
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

    private DocumentListItemResponse toListItem(Document document, String categoryName, String departmentName, String uploadedByName) {
        return new DocumentListItemResponse(
                document.getId(),
                document.getSlug(),
                document.getTitle(),
                document.getDocumentCode(),
                document.getFileType(),
                document.getFileSize(),
                document.getStatus().name(),
                document.getVersionNumber(),
                document.getViewCount(),
                document.getDownloadCount(),
                document.getCategoryId(),
                document.getDepartmentId(),
                document.getOwnerId(),
                document.getUploadedBy(),
                categoryName,
                departmentName,
                uploadedByName,
                document.getEffectiveDate(),
                document.getExpiryDate(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                java.util.List.of()
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

    private DocumentDetailResponse toDetail(Document document, String categoryName, String departmentName, String uploadedByName) {
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
                document.getVersionNumber(),
                document.getViewCount(),
                document.getDownloadCount(),
                document.getCategoryId(),
                document.getDepartmentId(),
                document.getOwnerId(),
                document.getUploadedBy(),
                categoryName,
                departmentName,
                uploadedByName,
                document.getEffectiveDate(),
                document.getExpiryDate(),
                baseEndpoint + "/preview-url",
                baseEndpoint + "/download-url",
                document.getCreatedAt(),
                document.getUpdatedAt(),
                documentTags(document.getId()),
                authorizedDepartments(document.getCategoryId())
        );
    }

    private List<DocumentDetailResponse.TagResponse> documentTags(Long documentId) {
        List<Long> tagIds = documentTagRepository.findByDocumentId(documentId).stream()
                .map(com.dms.document.entity.DocumentTag::getTagId)
                .distinct()
                .toList();
        if (tagIds.isEmpty()) {
            return List.of();
        }
        Map<Long, com.dms.masterdata.entity.Tag> tagsById = tagRepository.findAllById(tagIds).stream()
                .filter(tag -> tag.getDeletedAt() == null)
                .collect(Collectors.toMap(com.dms.masterdata.entity.Tag::getId, Function.identity()));
        return tagIds.stream()
                .map(tagsById::get)
                .filter(Objects::nonNull)
                .map(tag -> new DocumentDetailResponse.TagResponse(tag.getId(), tag.getName()))
                .toList();
    }
}
