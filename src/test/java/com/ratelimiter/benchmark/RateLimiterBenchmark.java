package com.ratelimiter.benchmark;

import com.ratelimiter.algorithm.FixedWindowCounterAlgorithm;
import com.ratelimiter.algorithm.SlidingWindowLogAlgorithm;
import com.ratelimiter.algorithm.TokenBucketAlgorithm;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.core.AlgorithmType;
import com.ratelimiter.core.FailMode;
import com.ratelimiter.core.StateStore;
import com.ratelimiter.support.InMemoryStateStore;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Threads;
import org.openjdk.jmh.annotations.Warmup;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Fork;

@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@Threads(50)
public class RateLimiterBenchmark {

    @Benchmark
    public Object tokenBucket(BenchmarkState state) {
        return state.tokenBucket.evaluate(state.nextClient(), state.tokenBucketConfig);
    }

    @Benchmark
    public Object slidingWindow(BenchmarkState state) {
        return state.slidingWindow.evaluate(state.nextClient(), state.slidingWindowConfig);
    }

    @Benchmark
    public Object fixedWindow(BenchmarkState state) {
        return state.fixedWindow.evaluate(state.nextClient(), state.fixedWindowConfig);
    }

    @State(Scope.Benchmark)
    public static class BenchmarkState {
        private final AtomicInteger counter = new AtomicInteger();
        private StateStore store;
        private TokenBucketAlgorithm tokenBucket;
        private SlidingWindowLogAlgorithm slidingWindow;
        private FixedWindowCounterAlgorithm fixedWindow;
        private RateLimitConfig tokenBucketConfig;
        private RateLimitConfig slidingWindowConfig;
        private RateLimitConfig fixedWindowConfig;

        @Setup
        public void setup() {
            store = new InMemoryStateStore();
            Clock fixedClock = Clock.fixed(Instant.ofEpochMilli(1_750_000_000_000L), ZoneOffset.UTC);
            tokenBucket = new TokenBucketAlgorithm(store, fixedClock);
            slidingWindow = new SlidingWindowLogAlgorithm(store, fixedClock);
            fixedWindow = new FixedWindowCounterAlgorithm(store, fixedClock);
            tokenBucketConfig = new RateLimitConfig("benchmark", AlgorithmType.TOKEN_BUCKET, 1_000_000, 60_000, 1_000_000, FailMode.OPEN);
            slidingWindowConfig = new RateLimitConfig("benchmark", AlgorithmType.SLIDING_WINDOW, 1_000_000, 60_000, 1_000_000, FailMode.OPEN);
            fixedWindowConfig = new RateLimitConfig("benchmark", AlgorithmType.FIXED_WINDOW, 1_000_000, 60_000, 1_000_000, FailMode.OPEN);
        }

        String nextClient() {
            return "client-" + Math.floorMod(counter.incrementAndGet(), 1_000);
        }
    }
}
