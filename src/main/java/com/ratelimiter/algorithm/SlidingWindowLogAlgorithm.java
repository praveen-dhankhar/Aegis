package com.ratelimiter.algorithm;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.RateLimitResult;
import com.ratelimiter.core.StateStore;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class SlidingWindowLogAlgorithm implements RateLimitAlgorithm {

    private static final String SCRIPT = "sliding_window";

    private final StateStore store;
    private final Clock clock;

    public SlidingWindowLogAlgorithm(StateStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public AlgorithmType type() {
        return AlgorithmType.SLIDING_WINDOW;
    }

    @Override
    public RateLimitResult evaluate(String sanitizedClientId, RateLimitConfig config) {
        long nowMs = clock.millis();
        String key = "rl:{" + sanitizedClientId + "}:sw";
        List<Long> raw = store.executeLua(
            SCRIPT,
            List.of(key),
            List.of(
                Long.toString(nowMs),
                Long.toString(config.windowMs()),
                Integer.toString(config.limit()),
                nowMs + "-" + UUID.randomUUID(),
                Long.toString(config.windowMs() + 1_000)
            )
        );
        boolean allowed = raw.get(0) == 1L;
        int remaining = raw.get(1).intValue();
        long retryAfterMs = raw.size() > 2 ? raw.get(2) : 0;
        long resetEpochMs = nowMs + (allowed ? config.windowMs() : Math.max(retryAfterMs, 1));
        return allowed
            ? RateLimitResult.allowed(config.limit(), remaining, resetEpochMs)
            : RateLimitResult.rejected(config.limit(), retryAfterMs, resetEpochMs);
    }
}
