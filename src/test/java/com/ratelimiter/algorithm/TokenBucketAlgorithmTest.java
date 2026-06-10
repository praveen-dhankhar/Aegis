package com.ratelimiter.algorithm;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.core.RateLimitResult;
import com.ratelimiter.support.InMemoryStateStore;
import com.ratelimiter.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class TokenBucketAlgorithmTest {

    private final InMemoryStateStore store = new InMemoryStateStore();
    private final MutableClock clock = new MutableClock(Instant.ofEpochMilli(1_000_000));
    private final TokenBucketAlgorithm algorithm = new TokenBucketAlgorithm(store, clock);

    @Test
    void burstAllowanceAndRefill() {
        RateLimitConfig config = new RateLimitConfig("client-1", AlgorithmType.TOKEN_BUCKET, 10, 1_000, 20, FailMode.OPEN);

        for (int i = 0; i < 20; i++) {
            assertThat(algorithm.evaluate("client-1", config).allowed()).isTrue();
        }
        RateLimitResult rejected = algorithm.evaluate("client-1", config);
        assertThat(rejected.allowed()).isFalse();
        assertThat(rejected.retryAfterMs()).isPositive();

        clock.advance(Duration.ofSeconds(1));

        int allowedAfterRefill = 0;
        for (int i = 0; i < 10; i++) {
            if (algorithm.evaluate("client-1", config).allowed()) {
                allowedAfterRefill++;
            }
        }
        assertThat(allowedAfterRefill).isEqualTo(10);
        assertThat(algorithm.evaluate("client-1", config).allowed()).isFalse();
    }

    @Test
    void remainingTokensDecreaseOnAllowedRequests() {
        RateLimitConfig config = new RateLimitConfig("client-2", AlgorithmType.TOKEN_BUCKET, 5, 1_000, 5, FailMode.OPEN);

        RateLimitResult first = algorithm.evaluate("client-2", config);
        RateLimitResult second = algorithm.evaluate("client-2", config);

        assertThat(first.remaining()).isEqualTo(4);
        assertThat(second.remaining()).isEqualTo(3);
    }
}
