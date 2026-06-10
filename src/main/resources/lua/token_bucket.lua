-- KEYS[1] = rl:{clientId}:tb
-- ARGV[1] = capacity
-- ARGV[2] = refill_rate_per_sec
-- ARGV[3] = now_ms
-- ARGV[4] = tokens_requested
-- ARGV[5] = ttl_ms
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'last_refill_ms')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now_ms

local elapsed_ms = math.max(0, now_ms - last_refill)
local refill = (elapsed_ms / 1000.0) * refill_rate
tokens = math.min(capacity, tokens + refill)

if tokens >= requested then
    local remaining = tokens - requested
    redis.call('HSET', KEYS[1], 'tokens', remaining, 'last_refill_ms', now_ms)
    redis.call('PEXPIRE', KEYS[1], ttl_ms)
    return {1, math.floor(remaining), 0}
end

local missing = requested - tokens
local retry_after_ms = 1000
if refill_rate > 0 then
    retry_after_ms = math.ceil((missing / refill_rate) * 1000)
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'last_refill_ms', now_ms)
redis.call('PEXPIRE', KEYS[1], ttl_ms)
return {0, 0, retry_after_ms}
