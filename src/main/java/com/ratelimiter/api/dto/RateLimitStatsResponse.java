package com.ratelimiter.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ratelimiter.config.RateLimitConfig;
import java.util.Map;

public record RateLimitStatsResponse(
    @JsonProperty("client_id")
    String clientId,
    RateLimitConfig config,
    Map<String, Object> stats
) {
}
