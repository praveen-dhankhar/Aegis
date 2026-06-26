# Aegis Interview Guide

This guide prepares you to explain Aegis as a portfolio-grade distributed systems project. It is written for backend, full-stack, platform, and system-design interviews.

## 1. Project Summary

### 30-second pitch

Aegis is a distributed rate limiting platform built with Java 21, Spring Boot 3.3, Redis 7, and a React control plane. It protects APIs by enforcing per-client request limits across multiple application instances. The backend supports Token Bucket, Sliding Window Log, and Fixed Window Counter algorithms, each implemented with atomic Redis Lua scripts so concurrent traffic is evaluated consistently. It also includes runtime rule management, fail-open and fail-closed behavior, Prometheus metrics, Grafana dashboards, k6/JMH benchmarks, Testcontainers integration tests, and a TypeScript dashboard for operations and demos.

### 60-second pitch

I built Aegis to show how a production-style distributed rate limiter works beyond a toy in-memory counter. The request path starts in a Spring `OncePerRequestFilter`, resolves the client identity from `X-API-Key`, JWT subject, IP address, or a global fallback, loads the client's rate limit configuration through a Caffeine-backed config service, selects the configured algorithm, and evaluates the limit in Redis through a single Lua script. Redis is the shared state store, which lets multiple app instances enforce the same limit consistently.

The project includes three algorithms: Token Bucket for burst-friendly smoothing, Sliding Window Log for precise rolling-window enforcement, and Fixed Window Counter for simplicity and high throughput. It exposes admin APIs for creating and changing rules at runtime, a React Aegis Control Plane for visualizing traffic and managing rules, and observability through Micrometer, Prometheus, and Grafana. I also added failure handling, including circuit breaker protection around Redis and per-client fail-open/fail-closed policy, then validated behavior with unit tests, integration tests, JMH microbenchmarks, and k6 end-to-end load tests.

### Strong resume bullet

Built Aegis, a Java 21/Spring Boot distributed rate limiting platform backed by Redis Lua scripts, supporting Token Bucket, Sliding Window Log, and Fixed Window Counter algorithms with runtime rule management, React control plane, Prometheus/Grafana observability, Testcontainers integration tests, and k6/JMH performance benchmarks.

## 2. What To Emphasize In Interviews

- This is not an in-memory limiter. Redis is the shared consistency layer.
- Every rate-limit decision is atomic because state mutation happens inside a Redis Lua script.
- The project intentionally compares algorithm trade-offs instead of pretending one limiter fits all traffic.
- The system supports operational needs: runtime configuration, admin API, dashboard, metrics, health checks, and Docker Compose.
- Failure behavior is explicit through fail-open and fail-closed modes.
- Tests are layered: algorithm unit tests, service tests, filter integration tests, Redis/Testcontainers tests, frontend tests, and browser smoke tests.
- Benchmarks are separated correctly: JMH for in-process algorithm throughput and k6 for end-to-end HTTP behavior.

## 3. Architecture Walkthrough

### Main request flow

```text
Client request
  -> RateLimitFilter
  -> ClientIdResolver
  -> RateLimiterService
  -> RateLimitConfigService
  -> AlgorithmRegistry
  -> RateLimitAlgorithm
  -> RedisAtomicStore
  -> Redis Lua script
  -> response headers or 429 response
```

### Main components

- `RateLimitFilter`: applies rate limiting to protected endpoints and writes standard rate-limit headers.
- `ClientIdResolver`: resolves identity from `X-API-Key`, JWT `sub`, remote IP, or `global`.
- `RateLimiterService`: orchestrates config lookup, algorithm execution, metrics, and Redis failure fallback.
- `RateLimitConfigService`: loads and caches per-client configuration using Caffeine and Redis.
- `AlgorithmRegistry`: maps algorithm enum values to concrete algorithm implementations.
- `TokenBucketAlgorithm`: supports bursts and smooth refill.
- `SlidingWindowLogAlgorithm`: provides accurate rolling-window behavior.
- `FixedWindowCounterAlgorithm`: provides a fast simple counter with window boundary trade-offs.
- `RedisAtomicStore`: executes Lua scripts, persists config, reports stats, and wraps Redis calls in a circuit breaker.
- `AdminController`: exposes CRUD for rate-limit rules.
- `AdminAuthInterceptor`: protects admin writes with `X-Admin-Key`.
- `RateLimitMetrics`: records request decisions, Redis latency, and Redis errors.
- `frontend/`: React 18 control plane for metrics, rule management, sandbox testing, and algorithm explanation.

## 4. Core Technical Questions And Answers

### Q1. What problem does this project solve?

It protects API services from excessive traffic by enforcing request limits per client. In a distributed deployment, multiple backend instances may receive requests for the same client, so local counters are not enough. Aegis uses Redis as a shared state store and Lua scripts for atomic decisions, allowing all app instances to enforce one consistent rate limit.

### Q2. Why is rate limiting important?

Rate limiting protects availability, controls abuse, prevents noisy tenants from harming others, and gives operators a way to enforce product or security policies. It is especially important for public APIs, login flows, expensive endpoints, and multi-tenant systems.

### Q3. Why did you choose Redis?

Redis is a good fit because rate limiting needs fast shared mutable state with low latency. Redis supports data structures like strings, hashes, and sorted sets, and it can execute Lua scripts atomically. That gives this project distributed consistency without adding a heavyweight database transaction path.

### Q4. Why use Lua scripts instead of GET plus SET from Java?

GET plus SET creates race conditions under concurrent traffic. Two requests can read the same old value and both decide they are allowed. Lua scripts execute atomically inside Redis, so each decision sees a consistent state and mutates it in one operation. It also reduces network round trips.

### Q5. What algorithms does Aegis support?

It supports Token Bucket, Sliding Window Log, and Fixed Window Counter. Token Bucket is good for bursty traffic with smooth refill. Sliding Window Log is the most accurate rolling-window algorithm but stores one entry per request. Fixed Window Counter is simple and fast but can allow boundary bursts near the edge of two windows.

### Q6. How does the request filter work?

`RateLimitFilter` is a Spring `OncePerRequestFilter` with high precedence. It skips actuator, admin, Swagger, API docs, and error paths. For protected paths, it resolves the client ID, calls `RateLimiterService.check`, sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`, and either continues the filter chain or returns a `429` JSON error with `Retry-After`.

### Q7. How is the client identified?

The resolver checks `X-API-Key` first, then tries to decode the JWT payload and read the `sub` claim, then falls back to remote IP address, and finally uses `global`. This makes the demo flexible while still showing how production identity resolution would work.

### Q8. Does the project fully validate JWTs?

No. JWT subject extraction is best-effort and does not verify signatures. In production, I would integrate issuer validation, audience checks, expiry validation, and JWK-based signature verification. For this project, JWT parsing exists to demonstrate identity extraction, not authentication.

### Q9. Why sanitize client IDs?

Client IDs are used in Redis keys. Sanitizing prevents malformed keys, awkward characters, and unbounded key length. Long client IDs are shortened with a SHA-256 digest suffix to preserve uniqueness while keeping Redis keys manageable.

### Q10. What Redis key schema does Aegis use?

Token Bucket uses `rl:{clientId}:tb`, Sliding Window Log uses `rl:{clientId}:sw`, Fixed Window Counter uses `rl:{clientId}:fw:{windowStart}`, and config uses `cfg:{clientId}`. The braces around `{clientId}` are Redis Cluster hash tags, so related keys for a client can stay in one cluster slot later.

### Q11. What does `X-RateLimit-Reset` mean in this project?

It is an epoch millisecond timestamp for when the limit state should reset or become favorable again. `Retry-After` is different: it is returned on rejected responses and is expressed in seconds, as expected by HTTP clients.

### Q12. What happens when a request is rejected?

The filter returns HTTP `429` with a JSON body containing `error`, `client_id`, `limit`, `remaining`, `window_ms`, and `retry_after_ms`. It also sets `Retry-After` in seconds and the rate-limit headers.

### Q13. What happens when Redis is unavailable?

`RedisAtomicStore` wraps Redis operations with a Resilience4j circuit breaker. If Redis is unavailable, the store throws `StoreUnavailableException`. `RateLimiterService` then applies the configured fail mode. Fail-open allows traffic and records metrics. Fail-closed rejects with a service-unavailable style response.

### Q14. Why is fail-open the default?

For many APIs, a rate limiter should not become the reason the entire application goes down. Fail-open preserves availability during Redis outages. For security-sensitive endpoints, fail-closed is available per client to prefer protection over availability.

### Q15. What is the role of `RateLimitConfigService`?

It loads per-client rules from Redis, falls back to default config when no explicit rule exists, caches configs with Caffeine, sanitizes client IDs, and invalidates cache entries when rules are saved, updated, or deleted.

### Q16. Why use Caffeine for config caching?

Rate-limit decisions happen on every request, so reading config from Redis every time would add unnecessary latency. Caffeine keeps recent configs in memory with TTL and a max size, reducing Redis load while still allowing runtime updates through cache invalidation.

### Q17. What is the risk of config caching?

In a multi-instance deployment, one instance invalidating its local cache after an admin update does not automatically invalidate every other instance's local cache. The TTL bounds staleness. For production, I would add Redis pub/sub, keyspace notifications, or a versioned config scheme to push invalidations across instances faster.

### Q18. How do admin APIs work?

`AdminController` exposes create, list, get, update, and delete operations under `/admin/rate-limits`. Writes require `X-Admin-Key`. The frontend validates the admin key with `/admin/auth/validate`, then sends the key only for protected mutations.

### Q19. Are all admin endpoints protected?

Writes are protected by the admin auth interceptor. The current backend leaves some read-only rule endpoints usable without an admin key, which is acceptable for a demo but would need a deliberate security decision in production.

### Q20. What would you change before production?

I would add real authentication and authorization, verify JWTs, protect or scope read-only admin endpoints, use TLS and secret management, add alerting rules, improve cross-instance config invalidation, add Redis Cluster/Sentinel deployment guidance, avoid `KEYS` for listing configs at scale, and introduce tenant-aware quotas and audit logs.

## 5. Algorithm Questions

### Q21. Explain Token Bucket.

Token Bucket maintains a bucket of tokens. Tokens refill over time at a configured rate, up to a burst capacity. Each request consumes a token. If a token is available, the request is allowed; otherwise it is rejected with a retry time. It handles bursts well while preserving average rate.

### Q22. How does Aegis implement Token Bucket?

It stores bucket state in a Redis hash with fields like current tokens and last refill time. The Java algorithm calculates arguments such as burst capacity, refill rate, current timestamp, and token cost, then executes the `token_bucket` Lua script atomically.

### Q23. When would you choose Token Bucket?

I would choose it for APIs where short bursts are acceptable but the long-term average must be controlled. Examples include general REST APIs, search endpoints, or user-facing endpoints where occasional traffic spikes should not immediately fail.

### Q24. What is a downside of Token Bucket?

It is less intuitive than a strict fixed count per window and requires careful handling of refill math, fractional rates, and timestamps. It also allows bursts up to the burst capacity, which may not be acceptable for some strict policies.

### Q25. Explain Sliding Window Log.

Sliding Window Log stores timestamps for recent requests in a sorted set. On each request, old entries outside the window are removed, the remaining count is checked, and the new request is added if allowed. It gives accurate rolling-window behavior.

### Q26. How does Aegis implement Sliding Window Log?

It uses a Redis sorted set where scores are request timestamps. The Lua script removes expired entries, counts remaining entries, and conditionally adds a unique member for the current request. The Java side passes the current timestamp, window length, limit, unique request member, and TTL.

### Q27. Why does Sliding Window Log need unique members?

Redis sorted set members must be unique. If two requests share the same timestamp, using only the timestamp as the member could overwrite an entry. Aegis includes a UUID with the timestamp to ensure each request has a unique member.

### Q28. When would you choose Sliding Window Log?

I would choose it when accuracy matters more than memory cost, such as billing-sensitive APIs, strict third-party API quotas, or critical write endpoints where boundary bursts are unacceptable.

### Q29. What is the downside of Sliding Window Log?

It stores one entry per accepted request within the window, so memory usage grows with traffic and window size. For very high throughput clients, an approximate sliding window counter or token bucket may be more efficient.

### Q30. Explain Fixed Window Counter.

Fixed Window Counter divides time into fixed windows, such as each minute. It increments a counter for the current window and rejects once the count exceeds the limit. It is simple and fast but can allow a burst at the end of one window and another burst at the start of the next.

### Q31. How does Aegis implement Fixed Window Counter?

It computes `windowStart` from the current timestamp, builds a key containing that window start, then uses a Lua script to increment the counter and set a TTL. The reset time is the end of the current window.

### Q32. When would you choose Fixed Window Counter?

I would choose it for simple quotas, low-cost endpoints, or cases where ease of reasoning and throughput matter more than exact rolling-window fairness.

### Q33. Which algorithm is fastest in this project?

Based on the local JMH benchmark in the README, Fixed Window Counter had the highest in-memory throughput, Token Bucket was also very high, and Sliding Window Log was slower because sorted set operations and per-request entries are more expensive.

### Q34. Which algorithm is most accurate?

Sliding Window Log is the most accurate because it evaluates the exact request history inside the rolling window.

### Q35. Which algorithm would you use for login attempts?

For login attempts, I would generally prefer Sliding Window Log or a strict variant because security endpoints need predictable enforcement. I would also combine it with account-level, IP-level, and device-level signals, not only a single API key.

### Q36. Which algorithm would you use for a public API plan limit?

For general API plan limits, Token Bucket is a good default because it allows reasonable bursts while preserving a sustained rate. For strict billing quotas, I would add a separate durable quota system.

## 6. Distributed Systems Questions

### Q37. Why is an in-memory rate limiter insufficient in distributed systems?

If there are multiple application instances, each instance would have its own counters. A client could exceed the intended global limit by distributing requests across instances. A shared store like Redis centralizes state so all instances enforce the same limit.

### Q38. How does Aegis avoid race conditions?

Each decision is made through a Redis Lua script. Redis runs a script atomically, so the check and mutation happen together. There is no separate read, compute, write sequence in the Java service.

### Q39. Is Redis a single point of failure?

In the local Compose setup, yes, Redis is a single instance. The application mitigates failures with a circuit breaker and fail-open/fail-closed behavior. In production, Redis should be deployed with managed HA, Sentinel, or Cluster depending on requirements.

### Q40. What consistency model does this project provide?

For rate-limit counters, it provides strong atomicity per Redis primary because each Lua script is atomic. Across Redis failover events, there can be operational edge cases depending on replication and failover semantics. For config caching, the system is eventually consistent across app instances because local Caffeine caches may be stale until TTL or explicit invalidation.

### Q41. Why are Redis Cluster hash tags used?

Keys like `rl:{clientId}:tb` place the client ID inside braces. Redis Cluster hashes the text inside braces, which keeps related keys for the same client in one slot. This matters if future scripts need multiple keys for one client because Redis Cluster requires Lua script keys to be in the same slot.

### Q42. What are the scaling bottlenecks?

The main bottlenecks are Redis throughput, network latency to Redis, script complexity, high-cardinality metrics labels, and memory usage for sliding window logs. Config listing with Redis `KEYS` is also not scalable for very large rule sets.

### Q43. How would you scale this system?

I would colocate app instances close to Redis, use connection pooling and timeouts, monitor Redis CPU and latency, shard clients across Redis Cluster if needed, keep scripts small, add backpressure for admin operations, move config listing to a separate indexed store for large installations, and use alerting based on rejection ratio, Redis latency, and circuit breaker state.

### Q44. Could rate limiting be eventually consistent instead?

Yes. Some systems use local counters with periodic sync, probabilistic limiting, or approximate algorithms. That reduces central dependency but allows temporary over-limit traffic. Aegis chooses atomic shared enforcement because correctness is a core goal.

### Q45. How would you handle multi-region deployment?

Global strong rate limiting across regions is hard because cross-region latency hurts every request. I would usually use regional limits plus a global quota reconciliation system. For strict global limits, I would centralize enforcement or use a globally replicated data store, but I would be clear about latency and availability trade-offs.

## 7. API And Backend Questions

### Q46. What endpoints are rate limited?

The filter applies to normal application paths, including the demo endpoint `/api/test`. It skips `/actuator`, `/admin`, Swagger, OpenAPI docs, and `/error` to avoid blocking health checks, admin configuration, and documentation paths.

### Q47. Why skip admin endpoints from the rate limiter?

Admin endpoints are used to configure rate limits. If they were rate limited by the same misconfigured system, operators could lock themselves out of fixing a bad rule. They still need separate authentication and security controls.

### Q48. What is the purpose of `/api/test`?

It is a protected demo endpoint used by curl, k6, and the frontend sandbox to show real rate-limit behavior and response headers without needing a separate application.

### Q49. What data is stored in a rate-limit config?

Each config stores client ID, algorithm, limit, window duration in milliseconds, burst capacity, and fail mode.

### Q50. How does update behavior work?

The update method loads the current config, applies only provided fields, keeps existing values for missing fields, and saves the new config. If burst capacity is not provided, it preserves the current capacity or ensures it is at least the effective limit.

### Q51. Why use Java records for config?

Records are concise, immutable data carriers. They fit configuration objects well and allow validation inside the compact constructor.

### Q52. Why use Spring Boot?

Spring Boot gives production-ready HTTP APIs, filters, validation, Actuator health and metrics, Redis integration, dependency injection, and testing support with less boilerplate.

### Q53. What is the purpose of Actuator?

Actuator exposes health and Prometheus metrics endpoints. In this project, it helps operators observe service health, Redis state, request decisions, and JVM behavior.

### Q54. How are validation errors handled?

DTO validation uses Jakarta Validation annotations. The API exception handler normalizes validation and application errors into consistent HTTP responses.

### Q55. Why use a circuit breaker around Redis?

If Redis starts timing out or failing, repeatedly attempting every call can amplify latency and resource pressure. The circuit breaker opens after failures and fails fast for a period, allowing the service to apply fail-open or fail-closed behavior without hanging each request.

### Q56. What are the trade-offs of fail-fast behavior?

Fail-fast protects the application from cascading latency, but it may temporarily bypass Redis even if Redis is recovering. The half-open state helps test recovery with limited calls.

## 8. Observability And Performance Questions

### Q57. What metrics does Aegis expose?

It exposes rate-limit request totals by client, result, and algorithm; allowed and rejected totals; Redis error totals; and Redis Lua latency timer metrics. The HTTP server and JVM metrics also come from Spring Boot Actuator and Micrometer.

### Q58. What does Grafana show?

The dashboard shows request rate by result, rejection ratio, Redis errors, Redis Lua latency, HTTP request rate and latency for `/api/test`, JVM heap, scrape health, and allowed/rejected rates.

### Q59. Why is `rate_limit_redis_latency_ms_seconds` named with seconds?

Micrometer timers are exported to Prometheus in seconds. Even though the logical measurement is Redis latency, Prometheus timer suffixes use `_seconds`. The Grafana queries multiply by `1000` to display milliseconds.

### Q60. How did you benchmark the system?

JMH measures in-process algorithm throughput against a deterministic in-memory test store. k6 measures end-to-end HTTP behavior through Docker Compose, Spring Boot, Redis, and Lua scripts. This split avoids mixing microbenchmark claims with real networked service behavior.

### Q61. What benchmark result should you mention?

The README records a local k6 run with 500 VUs for 30 seconds, 837,048 requests, about 27,844 requests per second, 16.81 ms average latency, 39.98 ms p95, 63.2 ms p99, and 0 failed rate where both `200` and `429` are expected outcomes.

### Q62. Why are `429` responses considered successful in k6?

The purpose of a rate limiter is to reject excess requests. A `429` means the limiter is working. The k6 script treats both `200` and `429` as expected and only fails on unexpected status codes or transport failures.

### Q63. What did JMH show?

The local JMH results showed Fixed Window Counter and Token Bucket with very high in-memory throughput, while Sliding Window Log was lower because it does more work and models exact rolling-window behavior.

### Q64. Why not rely only on JMH?

JMH does not include HTTP parsing, servlet overhead, Redis network latency, Docker networking, JSON serialization, or real Lua execution. It is useful for algorithm comparison but not for full-system capacity.

### Q65. What would you monitor in production?

I would monitor allowed/rejected rate, rejection ratio per client, Redis latency, Redis errors, circuit breaker state, HTTP latency, JVM memory and GC, Redis CPU and memory, slow Lua scripts, and admin configuration changes.

## 9. Testing Questions

### Q66. What tests are included?

The backend has unit tests for each algorithm, client ID resolution, sanitizer behavior, service failure modes, admin controller behavior, and filter integration. It also has Redis/Testcontainers integration tests for Lua execution and distributed consistency. The frontend has Vitest/RTL tests and a Playwright smoke test.

### Q67. What does `mvn verify` do?

It runs unit tests, packages the application, runs integration tests through Failsafe, and generates a JaCoCo report. Integration tests skip automatically if Docker is unavailable.

### Q68. What is the most important backend test?

The distributed consistency and Redis algorithm integration tests are especially important because they validate the core claim that multiple service instances can share Redis state and enforce limits atomically.

### Q69. Why use Testcontainers?

Testcontainers lets integration tests run against real Redis behavior instead of mocks. That matters because the correctness of Lua scripts, Redis data types, TTLs, and sorted set operations cannot be fully proven with a fake store.

### Q70. What coverage does the project have?

The README records strong coverage in algorithm, core, filter, and metrics packages, with lower coverage in Redis integration paths. That is a reasonable next testing target because Redis error handling and Lua result conversion are critical.

### Q71. What frontend tests are important?

Prometheus parsing, rate-limit header parsing, rule schema validation, auth memory behavior, and rule form behavior are important because the dashboard depends on transforming backend data correctly.

### Q72. How would you test fail-open and fail-closed?

I would use a failing `StateStore` in unit tests and real Redis outage scenarios in integration or chaos tests. For fail-open, requests should be allowed with fallback headers. For fail-closed, protected requests should be rejected or unavailable according to configured behavior.

## 10. Frontend And Product Questions

### Q73. Why build a React control plane?

It turns the backend into an operable product. Interviewers and users can see live metrics, manage rules, inspect algorithm behavior, and use the sandbox to generate real `200` and `429` responses.

### Q74. What frontend stack is used?

React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Recharts, Vitest, React Testing Library, Playwright, Tailwind CSS, and Nginx for the production container.

### Q75. Why store the admin key only in memory?

Keeping the key out of `localStorage` and `sessionStorage` reduces persistence risk in a browser demo. It is not a substitute for real auth, but it avoids leaving the admin secret behind after closing the page.

### Q76. How does the dashboard get metrics?

It fetches `/actuator/prometheus` and parses Prometheus text client-side. It does not require a PromQL server for the UI. Grafana still uses Prometheus for richer dashboard panels.

### Q77. What is the sandbox used for?

The sandbox sends real requests to `/api/test` with a selected `X-API-Key`, allowing users to generate bursts and observe live allowed/rejected behavior, response headers, and retry timing.

### Q78. Why use Nginx in the frontend container?

Nginx serves the built SPA efficiently and reverse proxies `/api`, `/admin`, and `/actuator` to the backend inside Docker Compose. That gives the dashboard a same-origin production-style setup at `localhost:8081`.

## 11. Security Questions

### Q79. How are admin writes protected?

Admin write requests require the `X-Admin-Key` header. The frontend validates the key with `/admin/auth/validate` and sends it only for protected mutations.

### Q80. What are the security limitations?

JWT signatures are not verified, admin auth is a static key, read-only admin endpoints may be public, Grafana uses default local credentials, and there is no audit log. These are acceptable for a portfolio/local demo but would need hardening for production.

### Q81. How would you harden admin auth?

I would add OIDC or SSO, role-based authorization, short-lived sessions, CSRF protection if cookie-based auth is used, audit logs for mutations, secret rotation, and network-level restrictions for admin endpoints.

### Q82. Could rate limiting be bypassed?

It depends on identity. If clients can rotate API keys or IPs freely, a single-key limiter can be bypassed. Production systems usually combine multiple identities, such as account ID, API key, IP subnet, user ID, and endpoint category.

### Q83. Why not rate limit actuator?

Health and metrics endpoints are operational. Blocking them could hide outages or break orchestration. In production, they should be protected through network policies, authentication, or separate management ports.

## 12. Deployment And DevOps Questions

### Q84. How do you run the full stack?

Set `ADMIN_API_KEY` and run `docker compose up --build`. The backend runs on `8080`, frontend on `8081`, Prometheus on `9090`, and Grafana on `3000`.

### Q85. What does Docker Compose include?

It includes the Spring Boot app, React/Nginx frontend, Redis 7 with append-only persistence, Prometheus, and Grafana with provisioned datasource and dashboard.

### Q86. Why is Redis not published to the host?

Redis is only needed by services inside the Compose network. Keeping it internal reduces accidental exposure.

### Q87. What CI exists?

The README describes a GitHub Actions workflow that runs Java 21, Maven cache, `mvn verify`, and uploads the JaCoCo report artifact.

### Q88. What environment variables are important?

Important variables include `REDIS_HOST`, `REDIS_PORT`, `REDIS_TIMEOUT`, `ADMIN_API_KEY`, default limit/window/burst/algorithm/fail mode settings, and `DASHBOARD_CORS_ALLOWED_ORIGINS`.

### Q89. What would production deployment need?

It would need managed Redis HA, secret management, proper identity provider integration, TLS, container resource limits, autoscaling, alerting, production Grafana/Prometheus retention, structured logs, and safer config storage/listing.

## 13. System Design Follow-up Questions

### Q90. Design this for 100 million requests per day.

I would estimate peak QPS, deploy stateless app instances behind a load balancer, use Redis Cluster or managed Redis with enough CPU/network capacity, keep limiter scripts O(log n) or better, minimize high-cardinality metrics, separate admin config storage from hot-path counters, and monitor Redis latency aggressively. For clients with very high QPS, I would consider token bucket or approximate sliding windows over exact logs.

### Q91. How would you support endpoint-specific limits?

I would add dimensions to the config model: client ID plus route group or policy ID. The resolver would map requests to a policy key, and Redis keys would include both client and policy, such as `rl:{clientId}:route:{routeGroup}:tb`. I would avoid raw URL paths in keys to control cardinality.

### Q92. How would you support different plans, like free and enterprise?

I would introduce plan templates and assign clients to plans. The config service would resolve explicit client override first, then plan default, then global default. The admin UI would expose plan management separately from client overrides.

### Q93. How would you support dynamic config updates across many instances?

I would add a config version to Redis and publish invalidation events over Redis pub/sub or a message broker. Each instance would evict local cache entries when it receives a change event. TTL would remain as a fallback.

### Q94. How would you avoid using Redis `KEYS` for listing configs?

I would maintain an index set like `cfg:index` when saving and deleting configs, or store configs in a primary database with pagination. Redis `SCAN` is safer than `KEYS`, but a proper index or database is better for a large admin UI.

### Q95. How would you handle rate limiting by IP and API key at the same time?

I would evaluate multiple policies per request, such as API key quota and IP abuse quota. The request is allowed only if all required policies allow it. To optimize, I would evaluate the cheapest or most restrictive checks first.

### Q96. How would you add per-endpoint costs?

I would allow each request to consume more than one token depending on route or operation cost. Token Bucket already passes a token cost argument conceptually, so the algorithm could be extended to use request cost instead of a fixed cost of one.

### Q97. How would you prevent metric cardinality problems?

I would avoid labeling metrics with raw client IDs for very large customer sets. Instead, I would aggregate by plan, endpoint group, result, algorithm, or sampled top clients, and send per-client detail to logs or a separate analytics pipeline.

### Q98. How would you make the limiter library reusable?

I would separate the core limiter into a library module with interfaces for identity resolution, config providers, and state stores. The Spring Boot app would become one adapter around the core.

### Q99. How would you make it multi-tenant?

I would include tenant ID in config and keys, add tenant-scoped admin authorization, enforce tenant-aware metrics and audit logs, and make sure one tenant cannot list or mutate another tenant's rules.

### Q100. How would you reduce Redis load?

Options include config caching, local pre-checks for obviously allowed small bursts, client-side token leases, approximate counters, batching for non-critical quotas, and sharding hot tenants. Each optimization trades off exactness, so I would apply them only where strict atomicity is not required.

## 14. Debugging Questions

### Q101. A client says they are being rate limited too early. What do you check?

I would check the effective config for that client, the resolved client ID, the selected algorithm, response headers, clock behavior, Redis key state, and whether multiple logical users are sharing one identity such as IP address. For Sliding Window Log, I would inspect sorted set entries and TTL. For Fixed Window, I would check boundary timing.

### Q102. The dashboard shows no metrics. What do you check?

I would check `/actuator/prometheus`, Prometheus scrape targets, the frontend API base URL or Nginx proxy, CORS for dev mode, and Grafana datasource provisioning. I would also verify the Micrometer metric names because timers export with `_seconds`.

### Q103. Redis latency spikes. What do you check?

I would check Redis CPU, memory, slowlog, network latency, command rates, key cardinality, Lua script runtime, sorted set sizes for sliding windows, container resource limits, and whether a hot client is causing disproportionate load.

### Q104. Admin updates do not seem to apply. What do you check?

I would verify the `X-Admin-Key`, request payload validation, Redis config hash, local Caffeine cache invalidation, whether the request uses the same sanitized client ID, and whether another app instance still has stale cache until TTL.

### Q105. k6 shows many 429 responses. Is that bad?

Not necessarily. For a rate limiter, `429` can be expected. I would check whether the script defines `200` and `429` as successful outcomes. Unexpected failures would be transport errors, 5xx responses, or status codes outside the expected set.

### Q106. Testcontainers tests skip locally. What do you check?

I would check whether Docker is running, whether Testcontainers can discover the daemon, and whether `DOCKER_HOST` needs to point to the Docker Desktop socket. The README includes a Docker Desktop command for that case.

## 15. Behavioral And Situational Questions With STAR Answers

Use these as templates. In an interview, keep each answer to about 90 seconds.

### S1. Tell me about a technically challenging project you built.

**Situation:** I wanted a portfolio project that demonstrated distributed systems behavior, not just CRUD APIs.

**Task:** I needed to build a rate limiter that worked across multiple service instances and could be explained in backend and system-design interviews.

**Action:** I designed Aegis around Spring Boot, Redis, and atomic Lua scripts. I implemented Token Bucket, Sliding Window Log, and Fixed Window Counter, added runtime config APIs, wrapped Redis calls with a circuit breaker, exposed Prometheus metrics, built a React dashboard, and validated the system with unit, integration, JMH, and k6 tests.

**Result:** The result was a full distributed rate limiting platform with measurable performance, real operational dashboards, and clear algorithm trade-offs that I can demonstrate live.

### S2. Tell me about a time you had to make a design trade-off.

**Situation:** A rate limiter can use several algorithms, each with different fairness and performance characteristics.

**Task:** I needed to support realistic use cases without overfitting the project to one algorithm.

**Action:** I implemented three algorithms behind a shared `RateLimitAlgorithm` interface. Token Bucket handles bursts, Sliding Window Log gives precise rolling-window enforcement, and Fixed Window Counter gives high throughput with simpler semantics. I exposed the choice per client through config.

**Result:** The design made algorithm trade-offs explicit and let the system adapt to different endpoint needs instead of forcing one policy everywhere.

### S3. Tell me about a time you improved reliability.

**Situation:** Redis is central to distributed rate limiting, but any central dependency can fail.

**Task:** I needed the application to behave predictably during Redis outages.

**Action:** I wrapped Redis execution with a circuit breaker and added explicit fail modes. In fail-open mode, the service allows traffic to preserve availability. In fail-closed mode, it rejects traffic for stricter security use cases. I also recorded Redis errors in metrics.

**Result:** Redis failure became an explicit operating mode rather than an unhandled exception path, and the behavior can be selected based on business risk.

### S4. Tell me about a time you used data to validate your work.

**Situation:** It is easy to claim a rate limiter is fast without measuring it properly.

**Task:** I needed credible performance evidence at both algorithm and system levels.

**Action:** I used JMH to measure in-process algorithm throughput and k6 to measure end-to-end HTTP behavior through Docker Compose, Spring Boot, Redis, and Lua scripts. I documented both sets separately to avoid overstating microbenchmark results.

**Result:** The project has concrete local benchmark numbers, including a k6 run with about 27,844 requests per second and p95 latency around 39.98 ms on the documented workstation.

### S5. Tell me about a time you handled ambiguity.

**Situation:** "Build a rate limiter" can mean anything from a simple in-memory map to a production gateway component.

**Task:** I needed to define a scope that was challenging but still buildable.

**Action:** I focused on the important production concerns: distributed shared state, atomicity, algorithm choice, runtime config, failure behavior, observability, and tests. I left some areas, like full JWT validation and production auth, as documented limitations.

**Result:** The project stayed focused and demonstrable while still showing the engineering judgment required for production systems.

### S6. Tell me about a time you had to debug a non-obvious issue.

**Situation:** Metrics and Grafana dashboards can appear broken even when the backend is emitting data.

**Task:** I needed to make the dashboard reliably show Redis latency and request metrics.

**Action:** I traced the data path from Micrometer to Prometheus to Grafana. The key detail was that Micrometer timer metrics export in seconds and include `_seconds` in the metric name, so Grafana queries needed to use the correct Prometheus names and multiply by `1000` for milliseconds.

**Result:** The dashboard became reliable and the README now documents the metric naming clearly so the issue is easier to diagnose later.

### S7. Tell me about a time you balanced security and usability.

**Situation:** The dashboard needs an admin key to mutate rules, but storing secrets in a browser is risky.

**Task:** I needed a demo-friendly admin flow without persisting the secret unnecessarily.

**Action:** I made the frontend validate `X-Admin-Key` through the backend and keep the key only in React memory. It is sent only for protected write operations and is not stored in local storage or session storage.

**Result:** The control plane remains usable for demos while reducing secret persistence risk. I also documented that real production auth would require OIDC or another proper identity system.

### S8. Tell me about a time you built something observable.

**Situation:** A rate limiter can silently become too strict, too permissive, or dependent on slow Redis calls.

**Task:** I needed operators to see what the limiter was doing.

**Action:** I added Micrometer metrics for allowed/rejected decisions, Redis errors, and Redis latency, exposed them through Actuator Prometheus, provisioned Prometheus and Grafana in Docker Compose, and built frontend overview panels.

**Result:** The system can be inspected through both Grafana and the control plane, making behavior visible during demos, tests, and debugging.

### S9. Tell me about a time you improved test coverage.

**Situation:** Rate limiting correctness depends on edge cases around windows, refill timing, and concurrency.

**Task:** I needed tests that proved more than controller wiring.

**Action:** I wrote focused tests for each algorithm, client ID resolution, key sanitization, fail-open/fail-closed behavior, filter headers, admin CRUD, and Redis-backed integration behavior with Testcontainers.

**Result:** The core algorithm and service packages have strong coverage, and the remaining coverage gaps are clearly documented around Redis integration error paths.

### S10. Tell me about a time you chose a simpler solution intentionally.

**Situation:** A production-grade config system could use a database, audit log, pub/sub invalidation, and RBAC.

**Task:** For a portfolio project, I needed runtime config without turning the whole project into an admin platform.

**Action:** I stored configs in Redis hashes, cached them with Caffeine, exposed CRUD APIs, and documented limitations around cross-instance cache invalidation and large-scale config listing.

**Result:** The project demonstrates the core runtime-config concept while leaving a clear path for production hardening.

### S11. Tell me about a time you had to explain complex technical work simply.

**Situation:** Rate limiting algorithms can be abstract and hard to compare.

**Task:** I needed the project to be understandable to interviewers and users.

**Action:** I added a React control plane with algorithm explanations, live stats, rule management, and a sandbox that fires real requests and shows `200` and `429` responses.

**Result:** Instead of only explaining algorithms verbally, I can demonstrate them in a running system and connect the UI behavior to the backend implementation.

### S12. Tell me about a time you planned for future scale.

**Situation:** The local project uses one Redis instance, but real deployments may need Redis Cluster.

**Task:** I wanted the current key design to avoid future migration problems.

**Action:** I used Redis key hash tags around client IDs, such as `rl:{clientId}:tb`, so related keys for one client can map to the same Redis Cluster slot.

**Result:** The local implementation stays simple while the key schema remains compatible with a more scalable Redis deployment model.

## 16. Questions To Ask The Interviewer

- What kind of traffic patterns does your API platform need to protect against?
- Do you prefer strict global rate limits or availability-first approximate limits?
- How do you currently handle per-tenant fairness?
- What observability signals are most important for your platform teams?
- Are rate-limit policies managed by engineers, customer success, security, or product teams?
- How do you balance fail-open versus fail-closed behavior for critical endpoints?
- Do you run Redis or similar stateful infrastructure yourselves, or use a managed service?

## 17. Common Traps And Strong Answers

### Trap: "Why not just use an API gateway?"

Strong answer: An API gateway is a valid production option. I built this project to understand and demonstrate the internals: identity resolution, shared counters, atomic Redis operations, algorithm trade-offs, failure behavior, and observability. In production, this logic could be embedded in a gateway, sidecar, or shared service.

### Trap: "Is this production ready?"

Strong answer: It is production-style, not production-complete. The core rate-limit path, tests, metrics, and Docker stack are realistic. Before production, I would harden auth, JWT validation, config storage, Redis HA, alerting, audit logs, and deployment security.

### Trap: "Why does Sliding Window Log use more memory?"

Strong answer: It keeps a timestamp entry for each request in the current window. That is what makes it exact. The trade-off is memory proportional to request volume times window length.

### Trap: "Why do you count 429s as success in load testing?"

Strong answer: Because a rate limiter is supposed to reject excess requests. For this system, `429` is a valid controlled outcome. A failed load test would be unexpected 5xx responses, transport failures, or broken latency/error thresholds.

### Trap: "What is the hardest part of this project?"

Strong answer: The hardest part is correctness under concurrency and failure. A rate limiter must make atomic decisions, avoid race conditions, handle Redis outages predictably, and still expose enough metrics to know whether it is behaving correctly.

## 18. Final Interview Narrative

If you need to tell the story from beginning to end, use this structure:

1. I built Aegis because rate limiting is a common production problem with real distributed systems trade-offs.
2. The core decision was to use Redis Lua scripts for atomic shared state across app instances.
3. I implemented three algorithms so I could discuss accuracy, burst handling, memory, and throughput trade-offs.
4. I added admin APIs and a React control plane because real systems need runtime operations, not hard-coded limits.
5. I added fail-open/fail-closed modes and a Redis circuit breaker because dependency failure behavior must be explicit.
6. I added Prometheus, Grafana, k6, JMH, and layered tests so the project has evidence, not just code.
7. I know what is not production-complete: auth, JWT verification, Redis HA, config invalidation, audit logs, and large-scale config indexing.

## 19. Quick Revision Sheet

- Main language/backend: Java 21, Spring Boot 3.3.
- Shared state: Redis 7.
- Atomicity: Redis Lua scripts.
- Algorithms: Token Bucket, Sliding Window Log, Fixed Window Counter.
- Identity order: `X-API-Key`, JWT `sub`, remote IP, `global`.
- Config: Redis hashes plus Caffeine cache.
- Failure modes: fail-open and fail-closed.
- Observability: Micrometer, Actuator, Prometheus, Grafana.
- Frontend: React 18, TypeScript, Vite, TanStack Query, Recharts, Nginx.
- Tests: JUnit, Testcontainers, JaCoCo, Vitest, Playwright.
- Benchmarks: JMH for in-process algorithms, k6 for end-to-end HTTP.
- Local stack: backend `8080`, frontend `8081`, Prometheus `9090`, Grafana `3000`.
- Biggest production gaps: real auth, JWT verification, Redis HA, audit logs, cross-instance config invalidation, scalable config listing.
