package com.dms.identity.service;

import com.dms.common.exception.AppException;
import com.dms.common.security.JwtProperties;
import com.dms.common.security.JwtTokenProvider;
import com.dms.identity.dto.AuthResult;
import com.dms.identity.dto.ClientMetadata;
import com.dms.identity.dto.LoginRequest;
import com.dms.identity.dto.LoginResponse;
import com.dms.identity.dto.RefreshResponse;
import com.dms.identity.entity.RefreshToken;
import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserDepartment;
import com.dms.identity.entity.UserStatus;
import com.dms.identity.mapper.UserMapper;
import com.dms.identity.repository.RefreshTokenRepository;
import com.dms.identity.repository.UserDepartmentRepository;
import com.dms.identity.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private UserDepartmentRepository userDepartmentRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties jwtProperties = new JwtProperties("01234567890123456789012345678901", 900000, 604800000);
        authService = new AuthService(
                userRepository,
                refreshTokenRepository,
                userDepartmentRepository,
                passwordEncoder,
                jwtTokenProvider,
                jwtProperties,
                new UserMapper()
        );
    }

    @Test
    void login_validCredentials_returnsAccessTokenAndCreatesRefreshToken() {
        User user = activeUser();
        when(userRepository.findByEmailAndDeletedAtIsNull("admin@dms.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("admin", "hash")).thenReturn(true);
        when(jwtTokenProvider.createAccessToken(user)).thenReturn("access-token");
        when(jwtTokenProvider.accessExpirationSeconds()).thenReturn(900L);
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userDepartmentRepository.findByUserId(user.getId())).thenReturn(List.of(
                userDepartment(user.getId(), 10L),
                userDepartment(user.getId(), 20L)
        ));

        AuthResult<LoginResponse> result = authService.login(
                new LoginRequest("admin@dms.com", "admin"),
                new ClientMetadata("JUnit", "127.0.0.1")
        );

        assertThat(result.response().accessToken()).isEqualTo("access-token");
        assertThat(result.response().expiresIn()).isEqualTo(900L);
        assertThat(result.response().user().email()).isEqualTo("admin@dms.com");
        assertThat(result.response().user().departmentIds()).containsExactly(10L, 20L);
        assertThat(result.refreshToken()).isNotBlank();
        assertThat(result.refreshMaxAgeSeconds()).isEqualTo(604800L);
        assertThat(user.getLastLogin()).isNotNull();

        ArgumentCaptor<RefreshToken> tokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(tokenCaptor.capture());
        assertThat(tokenCaptor.getValue().getUser()).isSameAs(user);
        assertThat(tokenCaptor.getValue().isRevoked()).isFalse();
        assertThat(tokenCaptor.getValue().getDeviceInfo()).isEqualTo("JUnit");
        assertThat(tokenCaptor.getValue().getIpAddress()).isEqualTo("127.0.0.1");
    }

    @Test
    void login_invalidPassword_throwsInvalidCredentials() {
        User user = activeUser();
        when(userRepository.findByEmailAndDeletedAtIsNull("admin@dms.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("admin@dms.com", "wrong"),
                new ClientMetadata(null, null)
        )).isInstanceOf(AppException.class)
                .hasMessage("Invalid email or password");

        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void login_inactiveUser_rejectsLogin() {
        User user = activeUser();
        user.setStatus(UserStatus.INACTIVE);
        when(userRepository.findByEmailAndDeletedAtIsNull("admin@dms.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("admin@dms.com", "admin"),
                new ClientMetadata(null, null)
        )).isInstanceOf(AppException.class)
                .hasMessage("Invalid email or password");

        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void refresh_validToken_rotatesRefreshTokenAndReturnsAccessToken() {
        User user = activeUser();
        RefreshToken refreshToken = validRefreshToken(user);
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtTokenProvider.createAccessToken(user)).thenReturn("new-access-token");
        when(jwtTokenProvider.accessExpirationSeconds()).thenReturn(900L);

        AuthResult<RefreshResponse> result = authService.refresh(
                "refresh-token",
                new ClientMetadata("JUnit", "127.0.0.1")
        );

        assertThat(refreshToken.isRevoked()).isTrue();
        assertThat(result.response().accessToken()).isEqualTo("new-access-token");
        assertThat(result.refreshToken()).isNotBlank();
    }

    @Test
    void refresh_revokedToken_throwsUnauthorized() {
        RefreshToken refreshToken = validRefreshToken(activeUser());
        refreshToken.setRevoked(true);
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));

        assertThatThrownBy(() -> authService.refresh("refresh-token", new ClientMetadata(null, null)))
                .isInstanceOf(AppException.class)
                .hasMessage("Refresh token is invalid");
    }

    @Test
    void refresh_expiredToken_throwsUnauthorized() {
        RefreshToken refreshToken = validRefreshToken(activeUser());
        refreshToken.setExpiresAt(OffsetDateTime.now().minusSeconds(1));
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));

        assertThatThrownBy(() -> authService.refresh("refresh-token", new ClientMetadata(null, null)))
                .isInstanceOf(AppException.class)
                .hasMessage("Refresh token is invalid");
    }

    @Test
    void refresh_inactiveUser_rejectsRefresh() {
        User user = activeUser();
        user.setStatus(UserStatus.BANNED);
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(validRefreshToken(user)));

        assertThatThrownBy(() -> authService.refresh("refresh-token", new ClientMetadata(null, null)))
                .isInstanceOf(AppException.class)
                .hasMessage("User is disabled");
    }

    @Test
    void logout_existingToken_revokesToken() {
        RefreshToken refreshToken = validRefreshToken(activeUser());
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));

        authService.logout("refresh-token");

        assertThat(refreshToken.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(refreshToken);
    }

    @Test
    void logout_missingToken_isIdempotent() {
        authService.logout(null);

        verify(refreshTokenRepository, never()).findByToken(any());
        verify(refreshTokenRepository, never()).save(any());
    }

    private User activeUser() {
        User user = new User();
        user.setId(1L);
        user.setEmail("admin@dms.com");
        user.setName("System Admin");
        user.setPassword("hash");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private RefreshToken validRefreshToken(User user) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken("refresh-token");
        refreshToken.setUser(user);
        refreshToken.setExpiresAt(OffsetDateTime.now().plusDays(1));
        refreshToken.setRevoked(false);
        return refreshToken;
    }

    private UserDepartment userDepartment(Long userId, Long departmentId) {
        UserDepartment userDepartment = new UserDepartment();
        userDepartment.setUserId(userId);
        userDepartment.setDepartmentId(departmentId);
        return userDepartment;
    }
}
