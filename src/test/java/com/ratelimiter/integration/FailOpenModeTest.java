package com.ratelimiter.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.algorithm.AlgorithmRegistry;
import com.ratelimiter.algorithm.SlidingWindowLogAlgorithm;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimitConfigService;
import com.ratelimiter.config.RateLimiterProperties;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.core.KeySanitizer;
import com.ratelimiter.core.RateLimiterService;
import com.ratelimiter.metrics.RateLimitMetrics;
import com.ratelimiter.support.FailingStateStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class FailOpenModeTest {

    @Test
    void failOpenAllowsRequestWhenStoreUnavailable() {
        RateLimiterService service = service();
        RateLimitConfig config = new RateLimitConfig("fail-open-client", AlgorithmType.SLIDING_WINDOW, 1, 60_000, 1, FailMode.OPEN);

        assertThat(service.check("fail-open-client", config).result().allowed()).isTrue();
    }

    @Test
    void failClosedRejectsRequestWhenStoreUnavailable() {
        RateLimiterService service = service();
        RateLimitConfig config = new RateLimitConfig("fail-closed-client", AlgorithmType.SLIDING_WINDOW, 1, 60_000, 1, FailMode.CLOSED);

        assertThat(service.check("fail-closed-client", config).result().status()).isEqualTo(503);
    }

    private RateLimiterService service() {
        FailingStateStore store = new FailingStateStore();
        Clock clock = Clock.fixed(Instant.ofEpochMilli(1_000), ZoneOffset.UTC);
        KeySanitizer sanitizer = new KeySanitizer();
        RateLimitConfigService configService = new RateLimitConfigService(store, new RateLimiterProperties(), sanitizer);
        RateLimitMetrics metrics = new RateLimitMetrics(new SimpleMeterRegistry());
        AlgorithmRegistry registry = new AlgorithmRegistry(List.of(new SlidingWindowLogAlgorithm(store, clock)));
        return new RateLimiterService(configService, registry, store, metrics, sanitizer, clock);
    }
}
