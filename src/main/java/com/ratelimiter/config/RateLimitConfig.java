package com.ratelimiter.config;

import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import java.util.LinkedHashMap;
import java.util.Map;

public record RateLimitConfig(
    String clientId,
    AlgorithmType algorithm,
    int limit,
    long windowMs,
    int burstCapacity,
    FailMode failMode
) {

    public RateLimitConfig {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalArgumentException("clientId is required");
        }
        if (algorithm == null) {
            throw new IllegalArgumentException("algorithm is required");
        }
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be positive");
        }
        if (windowMs <= 0) {
            throw new IllegalArgumentException("windowMs must be positive");
        }
        if (burstCapacity <= 0) {
            throw new IllegalArgumentException("burstCapacity must be positive");
        }
        if (failMode == null) {
            failMode = FailMode.OPEN;
        }
    }

    public double refillRatePerSecond() {
        return limit / (windowMs / 1000.0d);
    }

    public Map<String, String> toRedisHash() {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("client_id", clientId);
        values.put("algorithm", algorithm.name());
        values.put("limit", Integer.toString(limit));
        values.put("window_ms", Long.toString(windowMs));
        values.put("burst_capacity", Integer.toString(burstCapacity));
        values.put("fail_mode", failMode.name());
        return values;
    }

    public static RateLimitConfig fromRedisHash(Map<Object, Object> hash) {
        return new RateLimitConfig(
            stringValue(hash, "client_id"),
            AlgorithmType.valueOf(stringValue(hash, "algorithm")),
            Integer.parseInt(stringValue(hash, "limit")),
            Long.parseLong(stringValue(hash, "window_ms")),
            Integer.parseInt(stringValue(hash, "burst_capacity")),
            FailMode.valueOf(stringValue(hash, "fail_mode"))
        );
    }

    public RateLimitConfig withClientId(String newClientId) {
        return new RateLimitConfig(newClientId, algorithm, limit, windowMs, burstCapacity, failMode);
    }

    public RateLimitConfig withUpdates(AlgorithmType newAlgorithm, Integer newLimit, Long newWindowMs,
                                       Integer newBurstCapacity, FailMode newFailMode) {
        int effectiveLimit = newLimit == null ? limit : newLimit;
        long effectiveWindow = newWindowMs == null ? windowMs : newWindowMs;
        return new RateLimitConfig(
            clientId,
            newAlgorithm == null ? algorithm : newAlgorithm,
            effectiveLimit,
            effectiveWindow,
            newBurstCapacity == null ? Math.max(burstCapacity, effectiveLimit) : newBurstCapacity,
            newFailMode == null ? failMode : newFailMode
        );
    }

    private static String stringValue(Map<Object, Object> hash, String key) {
        Object value = hash.get(key);
        if (value == null) {
            throw new IllegalArgumentException("missing config field: " + key);
        }
        return value.toString();
    }
}
