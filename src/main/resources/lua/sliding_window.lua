-- KEYS[1] = rl:{clientId}:sw
-- ARGV[1] = now_ms
-- ARGV[2] = window_ms
-- ARGV[3] = limit
-- ARGV[4] = request_member
-- ARGV[5] = ttl_ms
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttl_ms = tonumber(ARGV[5])
local window_start = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, window_start)

local count = redis.call('ZCARD', KEYS[1])
if count < limit then
    redis.call('ZADD', KEYS[1], now_ms, member)
    redis.call('PEXPIRE', KEYS[1], ttl_ms)
    return {1, limit - count - 1, 0}
end

local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local retry_after_ms = window_ms
if oldest[2] ~= nil then
    retry_after_ms = math.max(1, tonumber(oldest[2]) + window_ms - now_ms)
end
redis.call('PEXPIRE', KEYS[1], ttl_ms)
return {0, 0, retry_after_ms}
