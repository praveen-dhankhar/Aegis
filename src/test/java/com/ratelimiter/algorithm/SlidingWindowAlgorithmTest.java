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

class SlidingWindowAlgorithmTest {

    private final InMemoryStateStore store = new InMemoryStateStore();
    private final MutableClock clock = new MutableClock(Instant.ofEpochMilli(0));
    private final SlidingWindowLogAlgorithm algorithm = new SlidingWindowLogAlgorithm(store, clock);

    @Test
    void rollingWindowAccuracy() {
        RateLimitConfig config = new RateLimitConfig("client-1", AlgorithmType.SLIDING_WINDOW, 5, 60_000, 5, FailMode.OPEN);

        for (int i = 0; i < 5; i++) {
            assertThat(algorithm.evaluate("client-1", config).allowed()).isTrue();
        }

        clock.advance(Duration.ofSeconds(10));
        RateLimitResult rejected = algorithm.evaluate("client-1", config);
        assertThat(rejected.allowed()).isFalse();
        assertThat(rejected.retryAfterMs()).isEqualTo(50_000);

        clock.advance(Duration.ofSeconds(55));
        assertThat(algorithm.evaluate("client-1", config).allowed()).isTrue();
    }

    @Test
    void reportsRemainingWithinWindow() {
        RateLimitConfig config = new RateLimitConfig("client-2", AlgorithmType.SLIDING_WINDOW, 3, 60_000, 3, FailMode.OPEN);

        assertThat(algorithm.evaluate("client-2", config).remaining()).isEqualTo(2);
        assertThat(algorithm.evaluate("client-2", config).remaining()).isEqualTo(1);
        assertThat(algorithm.evaluate("client-2", config).remaining()).isEqualTo(0);
    }
}
