package com.ratelimiter.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import jakarta.validation.constraints.Min;

public record UpdateRateLimitRequest(
    AlgorithmType algorithm,

    @Min(1)
    Integer limit,

    @JsonProperty("window_ms")
    @Min(1)
    Long windowMs,

    @JsonProperty("burst_capacity")
    @Min(1)
    Integer burstCapacity,

    @JsonProperty("fail_mode")
    FailMode failMode
) {
}
