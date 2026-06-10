package com.ratelimiter.core;

import com.ratelimiter.config.RateLimitConfig;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface StateStore {

    List<Long> executeLua(String scriptName, List<String> keys, List<String> args);

    boolean isAvailable();

    void saveConfig(RateLimitConfig config);

    Optional<RateLimitConfig> findConfig(String clientId);

    List<RateLimitConfig> listConfigs();

    void deleteConfig(String clientId);

    Map<String, Object> stats(String clientId, AlgorithmType algorithm);
}
