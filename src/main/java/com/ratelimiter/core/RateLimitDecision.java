package com.ratelimiter.core;

import com.ratelimiter.config.RateLimitConfig;

public record RateLimitDecision(
    String clientId,
    RateLimitConfig config,
    RateLimitResult result
) {
}
