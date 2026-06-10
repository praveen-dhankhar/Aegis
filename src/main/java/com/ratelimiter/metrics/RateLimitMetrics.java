package com.ratelimiter.metrics;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.RateLimitResult;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

@Component
public class RateLimitMetrics {

    private final MeterRegistry registry;
    private final Timer redisLatency;

    public RateLimitMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.redisLatency = Timer.builder("rate_limit_redis_latency_ms")
            .description("Redis Lua command latency")
            .register(registry);
    }

    public void recordDecision(String clientId, RateLimitConfig config, RateLimitResult result) {
        String outcome = result.allowed() ? "allowed" : "rejected";
        registry.counter(
            "rate_limit_requests_total",
            "client", clientId,
            "result", outcome,
            "algorithm", config.algorithm().name()
        ).increment();
        registry.counter(result.allowed() ? "rate_limit_allowed_total" : "rate_limit_rejected_total").increment();
    }

    public void recordRedisError() {
        registry.counter("rate_limit_redis_errors_total").increment();
    }

    public <T> T recordRedisLatency(Supplier<T> supplier) {
        return redisLatency.record(supplier);
    }
}
