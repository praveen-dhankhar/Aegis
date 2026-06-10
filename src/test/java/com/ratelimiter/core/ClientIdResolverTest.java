package com.ratelimiter.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIdResolverTest {

    private final ClientIdResolver resolver = new ClientIdResolver(new ObjectMapper());

    @Test
    void resolvesApiKeyHeaderFirst() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-API-Key", "api-key-123");
        request.addHeader("Authorization", bearerWithSubject("jwt-subject"));

        assertThat(resolver.resolve(request)).isEqualTo("api-key-123");
    }

    @Test
    void resolvesJwtSubjectWhenApiKeyMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", bearerWithSubject("jwt-subject"));

        assertThat(resolver.resolve(request)).isEqualTo("jwt-subject");
    }

    @Test
    void resolvesRemoteIpFallback() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.10");

        assertThat(resolver.resolve(request)).isEqualTo("192.0.2.10");
    }

    @Test
    void malformedJwtFallsBackToRemoteIp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer not-a-jwt");
        request.setRemoteAddr("192.0.2.11");

        assertThat(resolver.resolve(request)).isEqualTo("192.0.2.11");
    }

    @Test
    void missingIdentityFallsBackToGlobal() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(null);

        assertThat(resolver.resolve(request)).isEqualTo("global");
    }

    private String bearerWithSubject(String subject) {
        String header = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(("{\"sub\":\"" + subject + "\"}").getBytes(StandardCharsets.UTF_8));
        return "Bearer " + header + "." + payload + ".";
    }
}
