package com.ratelimiter.core;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class KeySanitizerTest {

    private final KeySanitizer sanitizer = new KeySanitizer();

    @Test
    void blankClientIdsUseGlobalFallback() {
        assertThat(sanitizer.sanitize(null)).isEqualTo("global");
        assertThat(sanitizer.sanitize("   ")).isEqualTo("global");
    }

    @Test
    void replacesUnsafeCharacters() {
        assertThat(sanitizer.sanitize("client:* value/{1}")).isEqualTo("client___value__1_");
    }

    @Test
    void capsLongClientIdsAndAddsDigestSuffix() {
        String raw = "client-" + "x".repeat(150);

        String sanitized = sanitizer.sanitize(raw);

        assertThat(sanitized).hasSize(96);
        assertThat(sanitized).startsWith("client-");
        assertThat(sanitized).contains("_");
    }
}
