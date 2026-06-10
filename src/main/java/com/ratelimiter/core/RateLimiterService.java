package com.ratelimiter.core;

import com.ratelimiter.algorithm.AlgorithmRegistry;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimitConfigService;
import com.ratelimiter.metrics.RateLimitMetrics;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private final RateLimitConfigService configService;
    private final AlgorithmRegistry algorithmRegistry;
    private final StateStore store;
    private final RateLimitMetrics metrics;
    private final KeySanitizer keySanitizer;
    private final Clock clock;

    public RateLimiterService(RateLimitConfigService configService,
                              AlgorithmRegistry algorithmRegistry,
                              StateStore store,
                              RateLimitMetrics metrics,
                              KeySanitizer keySanitizer,
                              Clock clock) {
        this.configService = configService;
        this.algorithmRegistry = algorithmRegistry;
        this.store = store;
        this.metrics = metrics;
        this.keySanitizer = keySanitizer;
        this.clock = clock;
    }

    public RateLimitDecision check(String rawClientId) {
        RateLimitConfig config = configService.get(rawClientId);
        return check(rawClientId, config);
    }

    public RateLimitDecision check(String rawClientId, RateLimitConfig config) {
        String clientId = keySanitizer.sanitize(rawClientId);
        RateLimitConfig sanitizedConfig = config.withClientId(clientId);
        try {
            RateLimitResult result = algorithmRegistry.get(sanitizedConfig.algorithm())
                .evaluate(clientId, sanitizedConfig);
            metrics.recordDecision(clientId, sanitizedConfig, result);
            if (!result.allowed()) {
                log.info("rate limit rejected client={} algorithm={} limit={} retry_after_ms={}",
                    clientId, sanitizedConfig.algorithm(), sanitizedConfig.limit(), result.retryAfterMs());
            }
            return new RateLimitDecision(clientId, sanitizedConfig, result);
        } catch (StoreUnavailableException e) {
            metrics.recordRedisError();
            RateLimitResult fallback = fallbackResult(sanitizedConfig);
            metrics.recordDecision(clientId, sanitizedConfig, fallback);
            log.warn("Redis unavailable for rate limit check; client={} fail_mode={}",
                clientId, sanitizedConfig.failMode());
            return new RateLimitDecision(clientId, sanitizedConfig, fallback);
        }
    }

    public boolean storeAvailable() {
        return store.isAvailable();
    }

    private RateLimitResult fallbackResult(RateLimitConfig config) {
        long resetEpochMs = clock.millis() + config.windowMs();
        if (config.failMode() == FailMode.CLOSED) {
            return RateLimitResult.failClosed(config.limit(), 1_000, resetEpochMs);
        }
        return RateLimitResult.failOpen(config.limit(), resetEpochMs);
    }
}
