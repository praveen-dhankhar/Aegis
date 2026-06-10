package com.ratelimiter.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.ratelimiter.api.dto.RateLimitStatsResponse;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.core.KeySanitizer;
import com.ratelimiter.core.StateStore;
import com.ratelimiter.core.StoreUnavailableException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class RateLimitConfigService {

    private final StateStore store;
    private final RateLimiterProperties properties;
    private final KeySanitizer keySanitizer;
    private final Cache<String, RateLimitConfig> cache;

    public RateLimitConfigService(StateStore store, RateLimiterProperties properties, KeySanitizer keySanitizer) {
        this.store = store;
        this.properties = properties;
        this.keySanitizer = keySanitizer;
        this.cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(properties.getConfigCacheTtlSeconds()))
            .maximumSize(10_000)
            .build();
    }

    public RateLimitConfig get(String rawClientId) {
        String clientId = keySanitizer.sanitize(rawClientId);
        RateLimitConfig cached = cache.getIfPresent(clientId);
        if (cached != null) {
            return cached;
        }
        RateLimitConfig loaded = loadConfig(clientId);
        cache.put(clientId, loaded);
        return loaded;
    }

    public RateLimitConfig save(RateLimitConfig config) {
        RateLimitConfig sanitized = config.withClientId(keySanitizer.sanitize(config.clientId()));
        store.saveConfig(sanitized);
        cache.invalidate(sanitized.clientId());
        return sanitized;
    }

    public RateLimitConfig update(String rawClientId, AlgorithmType algorithm, Integer limit, Long windowMs,
                                  Integer burstCapacity, FailMode failMode) {
        String clientId = keySanitizer.sanitize(rawClientId);
        RateLimitConfig current = get(clientId);
        RateLimitConfig updated = current.withClientId(clientId)
            .withUpdates(algorithm, limit, windowMs, burstCapacity, failMode);
        return save(updated);
    }

    public Optional<RateLimitConfig> findExplicit(String rawClientId) {
        String clientId = keySanitizer.sanitize(rawClientId);
        try {
            return store.findConfig(clientId);
        } catch (StoreUnavailableException e) {
            return Optional.empty();
        }
    }

    public List<RateLimitConfig> list() {
        return store.listConfigs();
    }

    public void delete(String rawClientId) {
        String clientId = keySanitizer.sanitize(rawClientId);
        store.deleteConfig(clientId);
        cache.invalidate(clientId);
    }

    public RateLimitStatsResponse getWithStats(String rawClientId) {
        RateLimitConfig config = get(rawClientId);
        Map<String, Object> stats = store.stats(config.clientId(), config.algorithm());
        return new RateLimitStatsResponse(config.clientId(), config, stats);
    }

    private RateLimitConfig loadConfig(String clientId) {
        try {
            return store.findConfig(clientId)
                .map(config -> config.withClientId(clientId))
                .orElseGet(() -> properties.defaultConfig(clientId));
        } catch (StoreUnavailableException e) {
            return properties.defaultConfig(clientId);
        }
    }
}
