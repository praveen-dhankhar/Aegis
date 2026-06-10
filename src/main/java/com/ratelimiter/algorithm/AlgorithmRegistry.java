package com.ratelimiter.algorithm;

import com.ratelimiter.core.AlgorithmType;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class AlgorithmRegistry {

    private final Map<AlgorithmType, RateLimitAlgorithm> algorithms = new EnumMap<>(AlgorithmType.class);

    public AlgorithmRegistry(List<RateLimitAlgorithm> implementations) {
        for (RateLimitAlgorithm implementation : implementations) {
            algorithms.put(implementation.type(), implementation);
        }
    }

    public RateLimitAlgorithm get(AlgorithmType type) {
        RateLimitAlgorithm algorithm = algorithms.get(type);
        if (algorithm == null) {
            throw new IllegalArgumentException("Unsupported rate limit algorithm: " + type);
        }
        return algorithm;
    }
}
