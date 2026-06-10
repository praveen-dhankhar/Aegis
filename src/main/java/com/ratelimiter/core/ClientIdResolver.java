package com.ratelimiter.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ClientIdResolver {

    private final ObjectMapper objectMapper;

    public ClientIdResolver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String resolve(HttpServletRequest request) {
        String apiKey = request.getHeader("X-API-Key");
        if (StringUtils.hasText(apiKey)) {
            return apiKey;
        }
        Optional<String> subject = jwtSubject(request.getHeader("Authorization"));
        if (subject.isPresent()) {
            return subject.get();
        }
        String remoteAddress = request.getRemoteAddr();
        if (StringUtils.hasText(remoteAddress)) {
            return remoteAddress;
        }
        return "global";
    }

    private Optional<String> jwtSubject(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
            return Optional.empty();
        }
        String[] parts = authorization.substring("Bearer ".length()).split("\\.");
        if (parts.length < 2) {
            return Optional.empty();
        }
        try {
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            String subject = subjectFromPayload(payload);
            return StringUtils.hasText(subject) ? Optional.of(subject) : Optional.empty();
        } catch (IllegalArgumentException | IOException e) {
            return Optional.empty();
        }
    }

    private String subjectFromPayload(String payload) throws IOException {
        JsonNode subject = objectMapper.readTree(payload).get("sub");
        return subject == null || !subject.isTextual() ? null : subject.asText();
    }
}
