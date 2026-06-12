package com.ratelimiter.config;

import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rate-limiter")
public class RateLimiterProperties {

    private int defaultLimit = 100;
    private long defaultWindowMs = 60_000;
    private int defaultBurstCapacity = 100;
    private AlgorithmType defaultAlgorithm = AlgorithmType.SLIDING_WINDOW;
    private FailMode defaultFailMode = FailMode.OPEN;
    private int configCacheTtlSeconds = 5;
    private int configTtlSeconds = 86_400;
    private String adminKey = "";
    private String dashboardCorsAllowedOrigins = "http://localhost:5173";

    public int getDefaultLimit() {
        return defaultLimit;
    }

    public void setDefaultLimit(int defaultLimit) {
        this.defaultLimit = defaultLimit;
    }

    public long getDefaultWindowMs() {
        return defaultWindowMs;
    }

    public void setDefaultWindowMs(long defaultWindowMs) {
        this.defaultWindowMs = defaultWindowMs;
    }

    public int getDefaultBurstCapacity() {
        return defaultBurstCapacity;
    }

    public void setDefaultBurstCapacity(int defaultBurstCapacity) {
        this.defaultBurstCapacity = defaultBurstCapacity;
    }

    public AlgorithmType getDefaultAlgorithm() {
        return defaultAlgorithm;
    }

    public void setDefaultAlgorithm(AlgorithmType defaultAlgorithm) {
        this.defaultAlgorithm = defaultAlgorithm;
    }

    public FailMode getDefaultFailMode() {
        return defaultFailMode;
    }

    public void setDefaultFailMode(FailMode defaultFailMode) {
        this.defaultFailMode = defaultFailMode;
    }

    public int getConfigCacheTtlSeconds() {
        return configCacheTtlSeconds;
    }

    public void setConfigCacheTtlSeconds(int configCacheTtlSeconds) {
        this.configCacheTtlSeconds = configCacheTtlSeconds;
    }

    public int getConfigTtlSeconds() {
        return configTtlSeconds;
    }

    public void setConfigTtlSeconds(int configTtlSeconds) {
        this.configTtlSeconds = configTtlSeconds;
    }

    public String getAdminKey() {
        return adminKey;
    }

    public void setAdminKey(String adminKey) {
        this.adminKey = adminKey;
    }

    public String getDashboardCorsAllowedOrigins() {
        return dashboardCorsAllowedOrigins;
    }

    public void setDashboardCorsAllowedOrigins(String dashboardCorsAllowedOrigins) {
        this.dashboardCorsAllowedOrigins = dashboardCorsAllowedOrigins;
    }

    public RateLimitConfig defaultConfig(String clientId) {
        return new RateLimitConfig(
            clientId,
            defaultAlgorithm,
            defaultLimit,
            defaultWindowMs,
            defaultBurstCapacity,
            defaultFailMode
        );
    }
}
