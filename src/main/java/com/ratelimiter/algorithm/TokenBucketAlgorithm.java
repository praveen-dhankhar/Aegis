package com.ratelimiter.algorithm;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.RateLimitResult;
import com.ratelimiter.core.StateStore;
import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class TokenBucketAlgorithm implements RateLimitAlgorithm {

    private static final String SCRIPT = "token_bucket";

    private final StateStore store;
    private final Clock clock;

    public TokenBucketAlgorithm(StateStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public AlgorithmType type() {
        return AlgorithmType.TOKEN_BUCKET;
    }

    @Override
    public RateLimitResult evaluate(String sanitizedClientId, RateLimitConfig config) {
        long nowMs = clock.millis();
        String key = "rl:{" + sanitizedClientId + "}:tb";
        List<Long> raw = store.executeLua(
            SCRIPT,
            List.of(key),
            List.of(
                Integer.toString(config.burstCapacity()),
                Double.toString(config.refillRatePerSecond()),
                Long.toString(nowMs),
                "1",
                Long.toString(Math.max(config.windowMs(), 1_000))
            )
        );
        boolean allowed = raw.get(0) == 1L;
        int remaining = raw.get(1).intValue();
        long retryAfterMs = raw.size() > 2 ? raw.get(2) : 0;
        long resetEpochMs = nowMs + Math.max(retryAfterMs, config.windowMs());
        return allowed
            ? RateLimitResult.allowed(config.limit(), remaining, resetEpochMs)
            : RateLimitResult.rejected(config.limit(), retryAfterMs, resetEpochMs);
    }
}
