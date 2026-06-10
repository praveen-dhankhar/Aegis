package com.ratelimiter.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimitConfigService;
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
class RedisAlgorithmIT {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
        .withExposedPorts(6379);

    private final RateLimiterService rateLimiterService;
    private final RateLimitConfigService configService;

    @Autowired
    RedisAlgorithmIT(RateLimiterService rateLimiterService, RateLimitConfigService configService) {
        this.rateLimiterService = rateLimiterService;
        this.configService = configService;
    }

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @Test
    void tokenBucketLuaAllowsBurstAndRejectsExcess() {
        RateLimitConfig config = new RateLimitConfig("redis-token-client", AlgorithmType.TOKEN_BUCKET, 1, 60_000, 3, FailMode.OPEN);

        assertThat(rateLimiterService.check("redis-token-client", config).result().allowed()).isTrue();
        assertThat(rateLimiterService.check("redis-token-client", config).result().allowed()).isTrue();
        assertThat(rateLimiterService.check("redis-token-client", config).result().allowed()).isTrue();
        assertThat(rateLimiterService.check("redis-token-client", config).result().allowed()).isFalse();
    }

    @Test
    void configPersistsInRedisAndFallsBackToDefaultAfterDelete() {
        RateLimitConfig saved = configService.save(
            new RateLimitConfig("redis-config-client", AlgorithmType.FIXED_WINDOW, 7, 30_000, 7, FailMode.CLOSED)
        );

        assertThat(configService.get("redis-config-client")).isEqualTo(saved);

        configService.delete("redis-config-client");

        assertThat(configService.get("redis-config-client").limit()).isEqualTo(100);
        assertThat(configService.get("redis-config-client").failMode()).isEqualTo(FailMode.OPEN);
    }
}
