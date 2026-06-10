-- KEYS[1] = rl:{clientId}:fw:{windowStart}
-- ARGV[1] = limit
-- ARGV[2] = ttl_ms
local limit = tonumber(ARGV[1])
local ttl_ms = tonumber(ARGV[2])

local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ttl_ms)
end

local remaining = limit - count
local retry_after_ms = redis.call('PTTL', KEYS[1])
if retry_after_ms < 0 then
    retry_after_ms = ttl_ms
end

if count > limit then
    return {0, 0, retry_after_ms}
end

return {1, remaining, 0}
