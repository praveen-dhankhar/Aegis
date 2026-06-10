package com.ratelimiter.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
    "rate-limiter.default-limit=100"
})
@AutoConfigureMockMvc
class AdminControllerTest {

    private final MockMvc mockMvc;

    @Autowired
    AdminControllerTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void writeEndpointsRequireAdminKey() throws Exception {
        mockMvc.perform(post("/admin/rate-limits")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validCreateJson("unauthorized-client", 10)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void createsUpdatesGetsAndDeletesRateLimitRule() throws Exception {
        mockMvc.perform(post("/admin/rate-limits")
                .header("X-Admin-Key", "test-admin-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validCreateJson("admin-client", 10)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.client_id").value("admin-client"))
            .andExpect(jsonPath("$.limit").value(10));

        mockMvc.perform(get("/admin/rate-limits/admin-client"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.client_id").value("admin-client"))
            .andExpect(jsonPath("$.config.limit").value(10));

        mockMvc.perform(put("/admin/rate-limits/admin-client")
                .header("X-Admin-Key", "test-admin-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "limit": 5,
                      "window_ms": 30000,
                      "algorithm": "TOKEN_BUCKET",
                      "burst_capacity": 8,
                      "fail_mode": "CLOSED"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.limit").value(5))
            .andExpect(jsonPath("$.algorithm").value("TOKEN_BUCKET"))
            .andExpect(jsonPath("$.fail_mode").value("CLOSED"));

        mockMvc.perform(delete("/admin/rate-limits/admin-client")
                .header("X-Admin-Key", "test-admin-key"))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/admin/rate-limits/admin-client"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.config.limit").value(100));
    }

    private String validCreateJson(String clientId, int limit) {
        return """
            {
              "client_id": "%s",
              "algorithm": "SLIDING_WINDOW",
              "limit": %d,
              "window_ms": 60000,
              "burst_capacity": %d,
              "fail_mode": "OPEN"
            }
            """.formatted(clientId, limit, limit);
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
