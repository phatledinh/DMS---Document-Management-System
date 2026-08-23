package com.dms.common.security;

import com.dms.identity.entity.Role;
import com.dms.identity.entity.User;
import com.dms.identity.entity.UserStatus;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {
    @Test
    void createAccessToken_containsExpectedClaims() {
        String secret = "01234567890123456789012345678901";
        JwtProperties properties = new JwtProperties(secret, 900000, 604800000);
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(secret.getBytes(StandardCharsets.UTF_8))
                .algorithm(JWSAlgorithm.HS256)
                .build();
        JwtTokenProvider provider = new JwtTokenProvider(new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk))), properties);

        String token = provider.createAccessToken(user());
        Jwt decoded = decoder(secret).decode(token);

        assertThat(decoded.getClaimAsString("iss")).isEqualTo("dms");
        assertThat(decoded.getSubject()).isEqualTo("admin@dms.com");
        assertThat(decoded.getClaimAsString("role")).isEqualTo("ADMIN");
        assertThat(decoded.getClaimAsString("userId")).isEqualTo("1");
        assertThat(decoded.getExpiresAt()).isAfter(decoded.getIssuedAt());
    }

    private JwtDecoder decoder(String secret) {
        SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    private User user() {
        User user = new User();
        user.setId(1L);
        user.setEmail("admin@dms.com");
        user.setName("System Admin");
        user.setPassword("hash");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
