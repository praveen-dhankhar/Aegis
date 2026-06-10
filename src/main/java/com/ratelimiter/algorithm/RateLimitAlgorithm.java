package com.ratelimiter.algorithm;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.RateLimitResult;

public interface RateLimitAlgorithm {

    AlgorithmType type();

    RateLimitResult evaluate(String sanitizedClientId, RateLimitConfig config);
}
