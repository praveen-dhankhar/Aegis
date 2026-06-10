package com.ratelimiter.core;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class KeySanitizer {

    private static final int MAX_LENGTH = 96;

    public String sanitize(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return "global";
        }
        String normalized = clientId.trim().replaceAll("[^A-Za-z0-9._-]", "_");
        if (normalized.isBlank()) {
            return "global";
        }
        if (normalized.length() <= MAX_LENGTH) {
            return normalized;
        }
        String digest = sha256(normalized).substring(0, 16);
        return normalized.substring(0, MAX_LENGTH - 17) + "_" + digest;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
