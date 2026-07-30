package com.dms.identity.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.identity.dto.AuthResult;
import com.dms.identity.dto.ClientMetadata;
import com.dms.identity.dto.LoginRequest;
import com.dms.identity.dto.LoginResponse;
import com.dms.identity.dto.RefreshResponse;
import com.dms.identity.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/auth")
public class AuthController {
    public static final String REFRESH_COOKIE = "refreshToken";
    private static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        AuthResult<LoginResponse> result = authService.login(request, metadata(servletRequest));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(), result.refreshMaxAgeSeconds()).toString())
                .body(ApiResponse.success(result.response()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<RefreshResponse>> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletRequest servletRequest
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AppException(ErrorCodes.REFRESH_TOKEN_INVALID, "Refresh token is invalid", HttpStatus.UNAUTHORIZED);
        }
        AuthResult<RefreshResponse> result = authService.refresh(refreshToken, metadata(servletRequest));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(), result.refreshMaxAgeSeconds()).toString())
                .body(ApiResponse.success(result.response()));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .body(ApiResponse.success("Logged out", null));
    }

    private ResponseCookie refreshCookie(String refreshToken, long maxAgeSeconds) {
        return ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(false)
                .sameSite("Strict")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Strict")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
    }

    private ClientMetadata metadata(HttpServletRequest request) {
        return new ClientMetadata(request.getHeader(HttpHeaders.USER_AGENT), request.getRemoteAddr());
    }
}
