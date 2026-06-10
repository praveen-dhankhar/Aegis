package com.ratelimiter.algorithm;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.RateLimitResult;
import com.ratelimiter.core.StateStore;
import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class FixedWindowCounterAlgorithm implements RateLimitAlgorithm {

    private static final String SCRIPT = "fixed_window";

    private final StateStore store;
    private final Clock clock;

    public FixedWindowCounterAlgorithm(StateStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public AlgorithmType type() {
        return AlgorithmType.FIXED_WINDOW;
    }

    @Override
    public RateLimitResult evaluate(String sanitizedClientId, RateLimitConfig config) {
        long nowMs = clock.millis();
        long windowStart = (nowMs / config.windowMs()) * config.windowMs();
        String key = "rl:{" + sanitizedClientId + "}:fw:" + windowStart;
        List<Long> raw = store.executeLua(
            SCRIPT,
            List.of(key),
            List.of(Integer.toString(config.limit()), Long.toString(config.windowMs() + 1_000))
        );
        boolean allowed = raw.get(0) == 1L;
        int remaining = raw.get(1).intValue();
        long retryAfterMs = raw.size() > 2 ? raw.get(2) : Math.max(windowStart + config.windowMs() - nowMs, 1);
        long resetEpochMs = windowStart + config.windowMs();
        return allowed
            ? RateLimitResult.allowed(config.limit(), remaining, resetEpochMs)
            : RateLimitResult.rejected(config.limit(), retryAfterMs, resetEpochMs);
    }
}
