package com.ratelimiter.core;

import java.util.LinkedHashMap;
import java.util.Map;

public record RateLimitResult(
    boolean allowed,
    int status,
    int limit,
    int remaining,
    long retryAfterMs,
    long resetEpochMs,
    String error
) {

    public static RateLimitResult allowed(int limit, int remaining, long resetEpochMs) {
        return new RateLimitResult(true, 200, limit, Math.max(remaining, 0), 0, resetEpochMs, null);
    }

    public static RateLimitResult rejected(int limit, long retryAfterMs, long resetEpochMs) {
        return new RateLimitResult(
            false,
            429,
            limit,
            0,
            Math.max(retryAfterMs, 1),
            resetEpochMs,
            "rate_limit_exceeded"
        );
    }

    public static RateLimitResult failOpen(int limit, long resetEpochMs) {
        return new RateLimitResult(true, 200, limit, limit, 0, resetEpochMs, null);
    }

    public static RateLimitResult failClosed(int limit, long retryAfterMs, long resetEpochMs) {
        return new RateLimitResult(false, 503, limit, 0, Math.max(retryAfterMs, 1), resetEpochMs, "rate_limiter_unavailable");
    }

    public Map<String, Object> errorBody(String clientId, long windowMs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("client_id", clientId);
        body.put("limit", limit);
        body.put("remaining", remaining);
        body.put("window_ms", windowMs);
        body.put("retry_after_ms", retryAfterMs);
        return body;
    }
}
