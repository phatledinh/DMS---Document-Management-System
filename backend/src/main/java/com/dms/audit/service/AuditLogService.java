package com.dms.audit.service;

import com.dms.identity.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

@Service
public class AuditLogService {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AuditLogService(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void log(User actor, String action, String targetType, Long targetId, Object oldValue, Object newValue) {
        jdbcTemplate.update("""
                INSERT INTO audit_logs (actor_id, action, target_type, target_id, old_value, new_value, ip_address, user_agent)
                VALUES (:actorId, :action, :targetType, :targetId, CAST(:oldValue AS jsonb), CAST(:newValue AS jsonb), :ipAddress, :userAgent)
                """, new MapSqlParameterSource()
                .addValue("actorId", actor == null ? null : actor.getId())
                .addValue("action", action)
                .addValue("targetType", targetType)
                .addValue("targetId", targetId)
                .addValue("oldValue", toJson(oldValue))
                .addValue("newValue", toJson(newValue))
                .addValue("ipAddress", ipAddress())
                .addValue("userAgent", userAgent()));
    }

    public Map<String, Object> categoryPermissionSnapshot(Object permissions) {
        return Map.of("departmentPermissions", permissions == null ? java.util.List.of() : permissions);
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private String ipAddress() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return null;
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : request.getHeader("User-Agent");
    }

    private HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }
}
