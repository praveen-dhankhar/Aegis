package com.ratelimiter.api;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DemoController {

    @GetMapping("/api/test")
    public Map<String, String> test() {
        return Map.of("status", "ok");
    }
}
