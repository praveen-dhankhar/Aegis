package com.ratelimiter.redis;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

@Component
public class LuaScriptRegistry {

    private static final String[] SCRIPT_NAMES = {"token_bucket", "sliding_window", "fixed_window"};

    private final ResourceLoader resourceLoader;
    private final Map<String, RedisScript<List>> scripts = new ConcurrentHashMap<>();

    public LuaScriptRegistry(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    void loadScripts() {
        for (String name : SCRIPT_NAMES) {
            scripts.put(name, loadScript(name));
        }
    }

    public RedisScript<List> get(String name) {
        RedisScript<List> script = scripts.get(name);
        if (script == null) {
            throw new IllegalArgumentException("Unknown Lua script: " + name);
        }
        return script;
    }

    private RedisScript<List> loadScript(String name) {
        Resource resource = resourceLoader.getResource("classpath:lua/" + name + ".lua");
        try {
            String source = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
            DefaultRedisScript<List> script = new DefaultRedisScript<>();
            script.setScriptText(source);
            script.setResultType(List.class);
            return script;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load Lua script: " + name, e);
        }
    }
}
