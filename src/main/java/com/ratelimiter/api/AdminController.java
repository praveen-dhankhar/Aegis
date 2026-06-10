package com.ratelimiter.api;

import com.ratelimiter.api.dto.CreateRateLimitRequest;
import com.ratelimiter.api.dto.RateLimitStatsResponse;
import com.ratelimiter.api.dto.UpdateRateLimitRequest;
import com.ratelimiter.config.RateLimitConfig;
import com.ratelimiter.config.RateLimitConfigService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/rate-limits")
public class AdminController {

    private final RateLimitConfigService configService;

    public AdminController(RateLimitConfigService configService) {
        this.configService = configService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RateLimitConfig create(@Valid @RequestBody CreateRateLimitRequest request) {
        return configService.save(request.toConfig());
    }

    @GetMapping
    public List<RateLimitConfig> list() {
        return configService.list();
    }

    @GetMapping("/{clientId}")
    public RateLimitStatsResponse get(@PathVariable String clientId) {
        return configService.getWithStats(clientId);
    }

    @PutMapping("/{clientId}")
    public RateLimitConfig update(@PathVariable String clientId,
                                  @Valid @RequestBody UpdateRateLimitRequest request) {
        return configService.update(
            clientId,
            request.algorithm(),
            request.limit(),
            request.windowMs(),
            request.burstCapacity(),
            request.failMode()
        );
    }

    @DeleteMapping("/{clientId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String clientId) {
        configService.delete(clientId);
    }
}
