package com.ratelimiter.support;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.StateStore;
import com.ratelimiter.core.StoreUnavailableException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class FailingStateStore implements StateStore {

    @Override
    public List<Long> executeLua(String scriptName, List<String> keys, List<String> args) {
        throw new StoreUnavailableException("forced failure");
    }

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public void saveConfig(RateLimitConfig config) {
        throw new StoreUnavailableException("forced failure");
    }

    @Override
    public Optional<RateLimitConfig> findConfig(String clientId) {
        throw new StoreUnavailableException("forced failure");
    }

    @Override
    public List<RateLimitConfig> listConfigs() {
        throw new StoreUnavailableException("forced failure");
    }

    @Override
    public void deleteConfig(String clientId) {
        throw new StoreUnavailableException("forced failure");
    }

    @Override
    public Map<String, Object> stats(String clientId, AlgorithmType algorithm) {
        return Map.of();
    }
}
