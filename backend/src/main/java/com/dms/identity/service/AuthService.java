package com.dms.identity.service;

import com.dms.common.exception.AppException;
import com.dms.common.exception.ErrorCodes;
import com.dms.common.security.JwtProperties;
import com.dms.common.security.JwtTokenProvider;
import com.dms.identity.dto.AuthResult;
import com.dms.identity.dto.ClientMetadata;
import com.dms.identity.dto.LoginRequest;
import com.dms.identity.dto.LoginResponse;
import com.dms.identity.dto.RefreshResponse;
import com.dms.identity.entity.RefreshToken;
import com.dms.identity.entity.User;
import com.dms.identity.mapper.UserMapper;
import com.dms.identity.repository.RefreshTokenRepository;
import com.dms.identity.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;

@Service
public class AuthService {
    private static final String TOKEN_TYPE = "Bearer";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final UserMapper userMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            JwtProperties jwtProperties,
            UserMapper userMapper
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.jwtProperties = jwtProperties;
        this.userMapper = userMapper;
    }

    @Transactional
    public AuthResult<LoginResponse> login(LoginRequest request, ClientMetadata metadata) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(request.email())
                .orElseThrow(this::invalidCredentials);
        if (!user.isEnabled() || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw invalidCredentials();
        }

        user.setLastLogin(OffsetDateTime.now());
        userRepository.save(user);

        RefreshToken refreshToken = createRefreshToken(user, metadata);
        LoginResponse response = new LoginResponse(
                jwtTokenProvider.createAccessToken(user),
                TOKEN_TYPE,
                jwtTokenProvider.accessExpirationSeconds(),
                userMapper.toResponse(user)
        );
        return new AuthResult<>(response, refreshToken.getToken(), jwtProperties.refreshExpiration() / 1000);
    }

    @Transactional
    public AuthResult<RefreshResponse> refresh(String token, ClientMetadata metadata) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(this::invalidRefreshToken);
        if (refreshToken.isRevoked() || refreshToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw invalidRefreshToken();
        }

        User user = refreshToken.getUser();
        if (!user.isEnabled()) {
            throw new AppException(ErrorCodes.USER_DISABLED, "User is disabled", HttpStatus.FORBIDDEN);
        }

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        RefreshToken rotatedToken = createRefreshToken(user, metadata);
        RefreshResponse response = new RefreshResponse(
                jwtTokenProvider.createAccessToken(user),
                TOKEN_TYPE,
                jwtTokenProvider.accessExpirationSeconds()
        );
        return new AuthResult<>(response, rotatedToken.getToken(), jwtProperties.refreshExpiration() / 1000);
    }

    @Transactional
    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        refreshTokenRepository.findByToken(token).ifPresent(refreshToken -> {
            refreshToken.setRevoked(true);
            refreshTokenRepository.save(refreshToken);
        });
    }

    private RefreshToken createRefreshToken(User user, ClientMetadata metadata) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(generateRefreshToken());
        refreshToken.setUser(user);
        refreshToken.setExpiresAt(OffsetDateTime.now().plusNanos(jwtProperties.refreshExpiration() * 1_000_000));
        refreshToken.setRevoked(false);
        refreshToken.setDeviceInfo(truncate(metadata.deviceInfo(), 255));
        refreshToken.setIpAddress(truncate(metadata.ipAddress(), 45));
        return refreshTokenRepository.save(refreshToken);
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private AppException invalidCredentials() {
        return new AppException(ErrorCodes.INVALID_CREDENTIALS, "Invalid email or password", HttpStatus.UNAUTHORIZED);
    }

    private AppException invalidRefreshToken() {
        return new AppException(ErrorCodes.REFRESH_TOKEN_INVALID, "Refresh token is invalid", HttpStatus.UNAUTHORIZED);
    }
}
