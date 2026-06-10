package com.ratelimiter.algorithm;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.support.InMemoryStateStore;
import com.ratelimiter.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class FixedWindowAlgorithmTest {

    private final InMemoryStateStore store = new InMemoryStateStore();
    private final MutableClock clock = new MutableClock(Instant.ofEpochMilli(60_000));
    private final FixedWindowCounterAlgorithm algorithm = new FixedWindowCounterAlgorithm(store, clock);

    @Test
    void allowsOnlyLimitWithinFixedWindow() {
        RateLimitConfig config = new RateLimitConfig("client-1", AlgorithmType.FIXED_WINDOW, 2, 60_000, 2, FailMode.OPEN);

        assertThat(algorithm.evaluate("client-1", config).allowed()).isTrue();
        assertThat(algorithm.evaluate("client-1", config).allowed()).isTrue();
        assertThat(algorithm.evaluate("client-1", config).allowed()).isFalse();
    }

    @Test
    void newWindowUsesNewCounterKey() {
        RateLimitConfig config = new RateLimitConfig("client-2", AlgorithmType.FIXED_WINDOW, 1, 60_000, 1, FailMode.OPEN);

        assertThat(algorithm.evaluate("client-2", config).allowed()).isTrue();
        assertThat(algorithm.evaluate("client-2", config).allowed()).isFalse();

        clock.advance(Duration.ofMinutes(1));

        assertThat(algorithm.evaluate("client-2", config).allowed()).isTrue();
    }
}
