package com.ratelimiter.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.core.RateLimiterService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(properties = "rate-limiter.admin-key=test-admin-key")
@Testcontainers(disabledWithoutDocker = true)
class DistributedConsistencyIT {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
        .withExposedPorts(6379);

    private final RateLimiterService rateLimiterService;

    @Autowired
    DistributedConsistencyIT(RateLimiterService rateLimiterService) {
        this.rateLimiterService = rateLimiterService;
    }

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @Test
    void sharedRedisStatePreventsLimitBypassAcrossInstances() {
        RateLimitConfig config = new RateLimitConfig("shared-client", AlgorithmType.SLIDING_WINDOW, 10, 60_000, 10, FailMode.OPEN);

        int allowed = 0;
        for (int i = 0; i < 15; i++) {
            if (rateLimiterService.check("shared-client", config).result().allowed()) {
                allowed++;
            }
        }

        assertThat(allowed).isEqualTo(10);
    }
}
