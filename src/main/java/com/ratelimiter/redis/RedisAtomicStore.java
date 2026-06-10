package com.ratelimiter.redis;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimiterProperties;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.StateStore;
import com.ratelimiter.core.StoreUnavailableException;
import com.ratelimiter.metrics.RateLimitMetrics;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisAtomicStore implements StateStore {

    private static final String CONFIG_PREFIX = "cfg:";
    private static final String DEFAULT_CONFIG_KEY = "cfg:__default__";

    private final StringRedisTemplate redisTemplate;
    private final LuaScriptRegistry scriptRegistry;
    private final RateLimiterProperties properties;
    private final RateLimitMetrics metrics;
    private final CircuitBreaker circuitBreaker;

    public RedisAtomicStore(StringRedisTemplate redisTemplate,
                            LuaScriptRegistry scriptRegistry,
                            RateLimiterProperties properties,
                            RateLimitMetrics metrics) {
        this.redisTemplate = redisTemplate;
        this.scriptRegistry = scriptRegistry;
        this.properties = properties;
        this.metrics = metrics;
        this.circuitBreaker = CircuitBreaker.of("redis-rate-limiter", CircuitBreakerConfig.custom()
            .failureRateThreshold(50)
            .slidingWindowSize(10)
            .minimumNumberOfCalls(5)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(2)
            .recordExceptions(RedisConnectionFailureException.class, RuntimeException.class, TimeoutException.class)
            .build());
    }

    @Override
    public List<Long> executeLua(String scriptName, List<String> keys, List<String> args) {
        if (!isAvailable()) {
            throw new StoreUnavailableException("Redis circuit breaker is open");
        }
        try {
            Object result = metrics.recordRedisLatency(() -> circuitBreaker.executeSupplier(() ->
                redisTemplate.execute(scriptRegistry.get(scriptName), keys, args.toArray())
            ));
            return convertResult(result);
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            throw new StoreUnavailableException("Redis Lua execution failed", e);
        }
    }

    @Override
    public boolean isAvailable() {
        return circuitBreaker.getState() != CircuitBreaker.State.OPEN;
    }

    @Override
    public void saveConfig(RateLimitConfig config) {
        try {
            String key = configKey(config.clientId());
            redisTemplate.opsForHash().putAll(key, config.toRedisHash());
            redisTemplate.expire(key, Duration.ofSeconds(properties.getConfigTtlSeconds()));
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            throw new StoreUnavailableException("Failed to save rate limit config", e);
        }
    }

    @Override
    public Optional<RateLimitConfig> findConfig(String clientId) {
        try {
            String key = configKey(clientId);
            Map<Object, Object> values = redisTemplate.opsForHash().entries(key);
            if (values.isEmpty() && !DEFAULT_CONFIG_KEY.equals(key)) {
                values = redisTemplate.opsForHash().entries(DEFAULT_CONFIG_KEY);
            }
            if (values.isEmpty()) {
                return Optional.empty();
            }
            redisTemplate.expire(key, Duration.ofSeconds(properties.getConfigTtlSeconds()));
            return Optional.of(RateLimitConfig.fromRedisHash(values));
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            throw new StoreUnavailableException("Failed to read rate limit config", e);
        }
    }

    @Override
    public List<RateLimitConfig> listConfigs() {
        try {
            Set<String> keys = redisTemplate.keys(CONFIG_PREFIX + "*");
            if (keys == null || keys.isEmpty()) {
                return List.of();
            }
            List<RateLimitConfig> configs = new ArrayList<>();
            for (String key : keys) {
                if (DEFAULT_CONFIG_KEY.equals(key)) {
                    continue;
                }
                Map<Object, Object> values = redisTemplate.opsForHash().entries(key);
                if (!values.isEmpty()) {
                    configs.add(RateLimitConfig.fromRedisHash(values));
                }
            }
            return configs;
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            throw new StoreUnavailableException("Failed to list rate limit configs", e);
        }
    }

    @Override
    public void deleteConfig(String clientId) {
        try {
            redisTemplate.delete(configKey(clientId));
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            throw new StoreUnavailableException("Failed to delete rate limit config", e);
        }
    }

    @Override
    public Map<String, Object> stats(String clientId, AlgorithmType algorithm) {
        try {
            Map<String, Object> stats = new LinkedHashMap<>();
            String baseKey = "rl:{" + clientId + "}:";
            if (algorithm == AlgorithmType.TOKEN_BUCKET) {
                stats.put("token_bucket", redisTemplate.opsForHash().entries(baseKey + "tb"));
            } else if (algorithm == AlgorithmType.SLIDING_WINDOW) {
                Long count = redisTemplate.opsForZSet().zCard(baseKey + "sw");
                stats.put("requests_in_window", count == null ? 0 : count);
            } else {
                stats.put("fixed_window_keys", redisTemplate.keys(baseKey + "fw:*"));
            }
            return stats;
        } catch (RuntimeException e) {
            metrics.recordRedisError();
            return Collections.emptyMap();
        }
    }

    private String configKey(String clientId) {
        return "__default__".equals(clientId) ? DEFAULT_CONFIG_KEY : CONFIG_PREFIX + clientId;
    }

    private List<Long> convertResult(Object result) {
        if (result == null) {
            return List.of();
        }
        if (result instanceof List<?> values) {
            return values.stream()
                .map(value -> value instanceof Number number ? number.longValue() : Long.parseLong(value.toString()))
                .toList();
        }
        if (result instanceof Number number) {
            return List.of(number.longValue());
        }
        throw new IllegalStateException("Unexpected Redis Lua result: " + result);
    }
}
