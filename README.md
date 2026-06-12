# Aegis : Distributed Rate Limiting Platform

Java 21 + Spring Boot 3.x distributed rate limiter backed by Redis 7.x. It implements Token Bucket, Sliding Window Log, and Fixed Window Counter with atomic Lua scripts so concurrent requests across multiple service instances share the same limiter state.

## Architecture

```text
Client request
  |
  v
RateLimitFilter
  | resolves X-API-Key, JWT subject, IP, or global
  v
RateLimiterService
  | loads per-client config through Caffeine + Redis
  v
AlgorithmRegistry
  | TOKEN_BUCKET / SLIDING_WINDOW / FIXED_WINDOW
  v
RedisAtomicStore
  | one Lua execution per rate-limit decision
  v
Redis 7.x
```

The service exposes a protected admin API for runtime config changes, Actuator/Prometheus metrics, and Docker Compose for app + Redis + Prometheus + Grafana.

## Algorithms

| Algorithm | Redis type | Key pattern | Strength | Trade-off |
|---|---|---|---|---|
| Token Bucket | Hash | `rl:{clientId}:tb` | Smooth refill and burst handling | Slightly more math per request |
| Sliding Window Log | Sorted set | `rl:{clientId}:sw` | Accurate rolling-window limits | Stores one timestamp per request |
| Fixed Window Counter | String | `rl:{clientId}:fw:{windowStart}` | Fastest, simple `INCR` | Boundary bursts can exceed intended rate |

All state-mutating checks use Lua scripts in `src/main/resources/lua`. There is no Redis `GET` plus `SET` counter logic.

## Local Setup

Requirements:

- Java 21+
- Maven 3.9+
- Docker, for Redis/Testcontainers/Docker Compose

Run tests:

```bash
mvn test
mvn verify
```

Start the full stack:

```bash
export ADMIN_API_KEY='replace-with-local-secret'
docker compose up --build
```

Endpoints:

- App: `http://localhost:8080`
- Health: `http://localhost:8080/actuator/health`
- Prometheus metrics: `http://localhost:8080/actuator/prometheus`
- Prometheus UI: `http://localhost:9090`
- Grafana: `http://localhost:3000` (`admin` / `admin`)
- Swagger UI: `http://localhost:8080/swagger-ui.html`

Redis is only attached to the internal Docker network and is not published to the host.

## Admin API

Write endpoints require `X-Admin-Key`.

Create a rule:

```bash
curl -i -X POST http://localhost:8080/admin/rate-limits \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "client_id": "api-key-abc123",
    "algorithm": "SLIDING_WINDOW",
    "limit": 1000,
    "window_ms": 60000,
    "burst_capacity": 1000,
    "fail_mode": "OPEN"
  }'
```

List rules:

```bash
curl http://localhost:8080/admin/rate-limits
```

Get a rule with stats:

```bash
curl http://localhost:8080/admin/rate-limits/api-key-abc123
```

Update a rule:

```bash
curl -i -X PUT http://localhost:8080/admin/rate-limits/api-key-abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "algorithm": "TOKEN_BUCKET",
    "limit": 500,
    "window_ms": 60000,
    "burst_capacity": 750,
    "fail_mode": "CLOSED"
  }'
```

Delete a rule:

```bash
curl -i -X DELETE http://localhost:8080/admin/rate-limits/api-key-abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

## Protected Request Behavior

Demo protected endpoint:

```bash
curl -i http://localhost:8080/api/test -H "X-API-Key: api-key-abc123"
```

Allowed responses include:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

Rejected responses return `429`:

```json
{
  "error": "rate_limit_exceeded",
  "client_id": "api-key-abc123",
  "limit": 1000,
  "remaining": 0,
  "window_ms": 60000,
  "retry_after_ms": 1234
}
```

Fail-closed Redis outages return `503` with a sanitized error body. Fail-open is the default and allows traffic if Redis is unavailable.

## Configuration

Environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_TIMEOUT` | `200ms` | Redis command timeout |
| `ADMIN_API_KEY` | empty | Required for admin writes |
| `RATE_LIMIT_DEFAULT_LIMIT` | `100` | Default fallback limit |
| `RATE_LIMIT_DEFAULT_WINDOW_MS` | `60000` | Default fallback window |
| `RATE_LIMIT_DEFAULT_BURST_CAPACITY` | `100` | Default token bucket burst |
| `RATE_LIMIT_DEFAULT_ALGORITHM` | `SLIDING_WINDOW` | Default algorithm |
| `RATE_LIMIT_DEFAULT_FAIL_MODE` | `OPEN` | Default Redis failure behavior |

## Redis Key Schema

```text
rl:{clientId}:tb                 Hash: tokens, last_refill_ms
rl:{clientId}:sw                 ZSet: score=request timestamp ms, member=request id
rl:{clientId}:fw:{windowStart}   String counter with TTL
cfg:{clientId}                   Hash: algorithm, limit, window_ms, burst_capacity, fail_mode
cfg:__default__                  Optional global default config hash
```

Client IDs are sanitized before key construction. The `{clientId}` hash tag keeps all keys for one client in the same Redis Cluster slot if the service is later moved to Redis Cluster.

## Metrics

Prometheus metrics:

```text
rate_limit_requests_total{client,result,algorithm}
rate_limit_allowed_total
rate_limit_rejected_total
rate_limit_redis_errors_total
rate_limit_redis_latency_ms_seconds_count
rate_limit_redis_latency_ms_seconds_sum
rate_limit_redis_latency_ms_seconds_max
```

Grafana provisioning is included under `docker/grafana`. The dashboard is loaded into the `Rate Limiter` folder as `Distributed Rate Limiter` and uses a stable Prometheus datasource UID, `prometheus-rate-limiter`.

Open Grafana at `http://localhost:3000` with `admin` / `admin`, then open `Rate Limiter > Distributed Rate Limiter`.

Dashboard panels:

- Rate limit requests/sec by result.
- Rejection ratio.
- Redis errors/sec.
- Redis Lua average and max latency in milliseconds. The Prometheus queries convert Micrometer timer seconds to milliseconds with `1000 * (...)`.
- HTTP `/api/test` requests/sec by status.
- HTTP `/api/test` average and max latency in milliseconds.
- JVM heap used.
- Prometheus scrape health.
- Allowed and rejected totals/sec.

## Testing

Included tests:

- `TokenBucketAlgorithmTest`: burst capacity, refill, remaining tokens.
- `SlidingWindowAlgorithmTest`: exact rolling-window behavior.
- `FixedWindowAlgorithmTest`: fixed window limit and reset behavior.
- `ClientIdResolverTest`: API key, JWT subject, and IP fallback resolution.
- `RateLimiterServiceTest` and `FailOpenModeTest`: fail-open and fail-closed behavior.
- `AdminControllerTest`: admin auth and CRUD.
- `RateLimitFilterIntegrationTest`: response headers and HTTP 429 body.
- `DistributedConsistencyIT`: shared Redis state with Testcontainers.
- `RedisAlgorithmIT`: Redis Lua algorithm and config persistence checks.

`mvn verify` runs unit tests, packages the application, runs `*IT` integration tests, and generates a JaCoCo report. Testcontainers tests skip automatically when Docker is unavailable.

On Docker Desktop installations where Testcontainers cannot discover the daemon even though `docker` works, run:

```bash
DOCKER_HOST=unix://$HOME/.docker/run/docker.sock DOCKER_API_VERSION=1.54 mvn verify
```

### JaCoCo coverage

Latest local JaCoCo report analyzed on June 12, 2026.

Overall coverage:

| Counter | Covered | Missed | Coverage |
|---|---:|---:|---:|
| Instructions | 1,873 | 375 | 83.32% |
| Branches | 100 | 56 | 64.10% |
| Lines | 404 | 84 | 82.79% |
| Complexity | 136 | 64 | 68.00% |
| Methods | 105 | 17 | 86.07% |
| Classes | 29 | 0 | 100.00% |

Package coverage:

| Package | Line coverage | Branch coverage |
|---|---:|---:|
| `com.ratelimiter.algorithm` | 98.59% | 83.33% |
| `com.ratelimiter.api` | 86.67% | 85.71% |
| `com.ratelimiter.api.dto` | 100.00% | 50.00% |
| `com.ratelimiter.config` | 84.03% | 53.57% |
| `com.ratelimiter.core` | 91.75% | 83.33% |
| `com.ratelimiter.filter` | 100.00% | 66.67% |
| `com.ratelimiter.metrics` | 100.00% | 100.00% |
| `com.ratelimiter.redis` | 54.72% | 35.00% |
| `com.ratelimiter` | 33.33% | n/a |

The core algorithms, request filter, and metrics wiring are well covered. The main coverage gap is the Redis integration layer, especially `RedisAtomicStore` at 47.67% line coverage and 30.56% branch coverage. The low bootstrap and exception-handler percentages are small line-count classes, but Redis error paths and Lua result handling are the highest-value areas for more tests.

## Benchmarks

Measured locally on June 10, 2026. These are workstation numbers, not production guarantees.

Environment:

- macOS 26.5 on arm64, 8 logical CPUs, 8 GB memory.
- Maven 3.9.10.
- JMH run with Oracle JDK 23 while compiling the project with Java release 21.
- Docker 29.5.3 and Docker Compose v5.1.4 for the end-to-end k6 run.
- Dockerized k6 was used because the local `k6` binary was not installed.

JMH measures in-process algorithm throughput against the deterministic in-memory test store. It does not include Redis, network, servlet, or JSON overhead.

```bash
mvn -Pbenchmark -DskipTests test-compile exec:exec | tee target/benchmark-jmh.txt
```

JMH results:

| Benchmark | Mode | Threads | Score | Error |
|---|---|---:|---:|---:|
| Fixed Window Counter | `thrpt` | 50 | 3,147,577.434 ops/sec | +/- 63,543.911 |
| Sliding Window Log | `thrpt` | 50 | 126,631.897 ops/sec | +/- 93,418.982 |
| Token Bucket | `thrpt` | 50 | 2,347,091.463 ops/sec | +/- 70,796.357 |

k6 measures end-to-end HTTP behavior through Docker Compose: k6 container -> Spring Boot app -> Redis Lua scripts. The script intentionally accepts both `200` and `429` as expected because a working rate limiter should reject excess traffic.

```bash
docker run --rm \
  --network rate-limiter-service_internal \
  -e BASE_URL=http://app:8080 \
  -e CLIENT_PREFIX=bench-$(date +%s) \
  -v "$PWD/load-test:/scripts:ro" \
  grafana/k6:latest run /scripts/k6_load_test.js | tee target/benchmark-k6.txt
```

Optional k6 controls:

- `BASE_URL`: target URL, default `http://localhost:8080`.
- `CLIENT_PREFIX`: client ID prefix, default `client`.
- `CLIENT_POOL`: number of randomized clients, default `100`.

k6 results:

| VUs | Duration | Requests | Requests/sec | Avg latency | p95 latency | p99 latency | Max latency | Failed rate |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 30s | 837,048 | 27,844.075/sec | 16.81 ms | 39.98 ms | 63.2 ms | 484.41 ms | 0.00% |

Status distribution:

| Status | Count | Rate |
|---:|---:|---:|
| 200 | 10,000 | 332.646/sec |
| 429 | 827,048 | 27,511.429/sec |
| Other | 0 | 0/sec |

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

It runs Java 21 with Maven cache, executes `mvn verify`, and uploads the JaCoCo report artifact.

## Trade-offs

- Lua scripts are used instead of WATCH/MULTI/EXEC to keep each check to one Redis round trip and avoid client-side retry loops under contention.
- Sliding Window Log is exact and interview-friendly, but higher memory than an approximated sliding window counter.
- Fail-open is the default because rate limiting should usually not become the cause of downtime. Fail-closed is available per client for security-sensitive APIs.
- Redis Cluster is not required for the local implementation, but key hash tags are already used to make the key schema cluster-compatible.

## Known Limitations

- JWT subject extraction is best-effort and does not verify signatures. Production deployments should integrate issuer/JWK validation.
- Grafana is provisioned for local development. Production deployments should add alert rules, retention-aware panels, and environment-specific labels.
- Benchmark results are local-machine measurements. Treat them as a baseline for this workstation, not capacity planning data.
- Testcontainers integration tests require Docker; they skip on machines without a Docker daemon.
