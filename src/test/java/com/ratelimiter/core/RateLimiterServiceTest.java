package com.ratelimiter.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.algorithm.AlgorithmRegistry;
import com.ratelimiter.algorithm.SlidingWindowLogAlgorithm;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimitConfigService;
import com.ratelimiter.config.RateLimiterProperties;
import com.ratelimiter.metrics.RateLimitMetrics;
import com.ratelimiter.support.FailingStateStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class RateLimiterServiceTest {

    @Test
    void failOpenAllowsWhenStoreUnavailable() {
        RateLimiterService service = serviceWithFailingStore();
        RateLimitConfig config = new RateLimitConfig("client-1", AlgorithmType.SLIDING_WINDOW, 10, 60_000, 10, FailMode.OPEN);

        RateLimitDecision decision = service.check("client-1", config);

        assertThat(decision.result().allowed()).isTrue();
        assertThat(decision.result().status()).isEqualTo(200);
    }

    @Test
    void failClosedRejectsWhenStoreUnavailable() {
        RateLimiterService service = serviceWithFailingStore();
        RateLimitConfig config = new RateLimitConfig("client-1", AlgorithmType.SLIDING_WINDOW, 10, 60_000, 10, FailMode.CLOSED);

        RateLimitDecision decision = service.check("client-1", config);

        assertThat(decision.result().allowed()).isFalse();
        assertThat(decision.result().status()).isEqualTo(503);
    }

    private RateLimiterService serviceWithFailingStore() {
        FailingStateStore store = new FailingStateStore();
        Clock clock = Clock.fixed(Instant.ofEpochMilli(1_000), ZoneOffset.UTC);
        RateLimiterProperties properties = new RateLimiterProperties();
        KeySanitizer sanitizer = new KeySanitizer();
        RateLimitConfigService configService = new RateLimitConfigService(store, properties, sanitizer);
        RateLimitMetrics metrics = new RateLimitMetrics(new SimpleMeterRegistry());
        AlgorithmRegistry registry = new AlgorithmRegistry(List.of(new SlidingWindowLogAlgorithm(store, clock)));
        return new RateLimiterService(configService, registry, store, metrics, sanitizer, clock);
    }
}
