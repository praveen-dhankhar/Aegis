package com.ratelimiter.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateRateLimitRequest(
    @JsonProperty("client_id")
    @NotBlank
    String clientId,

    @NotNull
    AlgorithmType algorithm,

    @Min(1)
    int limit,

    @JsonProperty("window_ms")
    @Min(1)
    long windowMs,

    @JsonProperty("burst_capacity")
    @Min(1)
    Integer burstCapacity,

    @JsonProperty("fail_mode")
    FailMode failMode
) {

    public RateLimitConfig toConfig() {
        return new RateLimitConfig(
            clientId,
            algorithm,
            limit,
            windowMs,
            burstCapacity == null ? limit : burstCapacity,
            failMode == null ? FailMode.OPEN : failMode
        );
    }
}
