package com.ratelimiter.support;

import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.StateStore;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public class InMemoryStateStore implements StateStore {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Map<String, CopyOnWriteArrayList<Long>> windows = new ConcurrentHashMap<>();
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();
    private final Map<String, RateLimitConfig> configs = new ConcurrentHashMap<>();
    private volatile boolean available = true;

    @Override
    public synchronized List<Long> executeLua(String scriptName, List<String> keys, List<String> args) {
        if (!available) {
            throw new IllegalStateException("store unavailable");
        }
        return switch (scriptName) {
            case "token_bucket" -> tokenBucket(keys.getFirst(), args);
            case "sliding_window" -> slidingWindow(keys.getFirst(), args);
            case "fixed_window" -> fixedWindow(keys.getFirst(), args);
            default -> throw new IllegalArgumentException("Unknown script: " + scriptName);
        };
    }

    @Override
    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    @Override
    public void saveConfig(RateLimitConfig config) {
        configs.put(config.clientId(), config);
    }

    @Override
    public Optional<RateLimitConfig> findConfig(String clientId) {
        return Optional.ofNullable(configs.get(clientId));
    }

    @Override
    public List<RateLimitConfig> listConfigs() {
        return configs.values().stream()
            .sorted(Comparator.comparing(RateLimitConfig::clientId))
            .toList();
    }

    @Override
    public void deleteConfig(String clientId) {
        configs.remove(clientId);
    }

    @Override
    public Map<String, Object> stats(String clientId, AlgorithmType algorithm) {
        Map<String, Object> stats = new LinkedHashMap<>();
        if (algorithm == AlgorithmType.SLIDING_WINDOW) {
            stats.put("requests_in_window", windows.getOrDefault("rl:{" + clientId + "}:sw", new CopyOnWriteArrayList<>()).size());
        } else if (algorithm == AlgorithmType.TOKEN_BUCKET) {
            stats.put("token_bucket", buckets.get("rl:{" + clientId + "}:tb"));
        } else {
            stats.put("fixed_window_keys", counters.keySet().stream().filter(key -> key.contains("{" + clientId + "}")).toList());
        }
        return stats;
    }

    private List<Long> tokenBucket(String key, List<String> args) {
        int capacity = Integer.parseInt(args.get(0));
        double refillRate = Double.parseDouble(args.get(1));
        long nowMs = Long.parseLong(args.get(2));
        int requested = Integer.parseInt(args.get(3));
        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(capacity, nowMs));
        long elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
        double tokens = Math.min(capacity, bucket.tokens + (elapsedMs / 1000.0d) * refillRate);
        if (tokens >= requested) {
            bucket.tokens = tokens - requested;
            bucket.lastRefillMs = nowMs;
            return List.of(1L, (long) Math.floor(bucket.tokens), 0L);
        }
        bucket.tokens = tokens;
        bucket.lastRefillMs = nowMs;
        long retryAfterMs = refillRate <= 0 ? 1_000 : (long) Math.ceil(((requested - tokens) / refillRate) * 1000);
        return List.of(0L, 0L, retryAfterMs);
    }

    private List<Long> slidingWindow(String key, List<String> args) {
        long nowMs = Long.parseLong(args.get(0));
        long windowMs = Long.parseLong(args.get(1));
        int limit = Integer.parseInt(args.get(2));
        long windowStart = nowMs - windowMs;
        CopyOnWriteArrayList<Long> timestamps = windows.computeIfAbsent(key, ignored -> new CopyOnWriteArrayList<>());
        timestamps.removeIf(timestamp -> timestamp <= windowStart);
        if (timestamps.size() < limit) {
            timestamps.add(nowMs);
            return List.of(1L, (long) (limit - timestamps.size()), 0L);
        }
        List<Long> sorted = new ArrayList<>(timestamps);
        Collections.sort(sorted);
        long retryAfterMs = Math.max(1, sorted.getFirst() + windowMs - nowMs);
        return List.of(0L, 0L, retryAfterMs);
    }

    private List<Long> fixedWindow(String key, List<String> args) {
        int limit = Integer.parseInt(args.get(0));
        long ttlMs = Long.parseLong(args.get(1));
        Counter counter = counters.computeIfAbsent(key, ignored -> new Counter(ttlMs));
        int count = counter.value.incrementAndGet();
        if (count > limit) {
            return List.of(0L, 0L, counter.ttlMs);
        }
        return List.of(1L, (long) (limit - count), 0L);
    }

    private static final class Bucket {
        private double tokens;
        private long lastRefillMs;

        private Bucket(double tokens, long lastRefillMs) {
            this.tokens = tokens;
            this.lastRefillMs = lastRefillMs;
        }
    }

    private static final class Counter {
        private final AtomicInteger value = new AtomicInteger();
        private final long ttlMs;

        private Counter(long ttlMs) {
            this.ttlMs = ttlMs;
        }
    }
}
