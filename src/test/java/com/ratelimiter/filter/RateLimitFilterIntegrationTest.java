package com.ratelimiter.filter;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ratelimiter.core.StateStore;
import com.ratelimiter.support.InMemoryStateStore;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest(properties = {
    "rate-limiter.admin-key=test-admin-key",
    "rate-limiter.default-limit=1000"
})
@AutoConfigureMockMvc
class RateLimitFilterIntegrationTest {

    private final MockMvc mockMvc;

    @Autowired
    RateLimitFilterIntegrationTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void allowedResponseIncludesRateLimitHeaders() throws Exception {
        createLimit("headers-client", 10);

        mockMvc.perform(get("/api/test").header("X-API-Key", "headers-client"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-RateLimit-Limit"))
            .andExpect(header().exists("X-RateLimit-Remaining"))
            .andExpect(header().exists("X-RateLimit-Reset"));
    }

    @Test
    void returns429AndRetryAfterWhenLimitExceeded() throws Exception {
        createLimit("limited-client", 2);

        mockMvc.perform(get("/api/test").header("X-API-Key", "limited-client"))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/test").header("X-API-Key", "limited-client"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/test").header("X-API-Key", "limited-client"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.error").value("rate_limit_exceeded"))
            .andExpect(jsonPath("$.remaining").value(0));
    }

    private void createLimit(String clientId, int limit) throws Exception {
        mockMvc.perform(post("/admin/rate-limits")
                .header("X-Admin-Key", "test-admin-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "client_id": "%s",
                      "algorithm": "SLIDING_WINDOW",
                      "limit": %d,
                      "window_ms": 60000,
                      "burst_capacity": %d,
                      "fail_mode": "OPEN"
                    }
                    """.formatted(clientId, limit, limit)))
            .andExpect(status().isCreated());
    }

    @TestConfiguration
    static class TestStoreConfig {
        @Bean
        @Primary
        StateStore stateStore() {
            return new InMemoryStateStore();
        }
    }
}
