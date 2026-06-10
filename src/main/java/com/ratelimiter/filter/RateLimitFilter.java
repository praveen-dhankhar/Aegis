package com.ratelimiter.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ratelimiter.core.ClientIdResolver;
import com.ratelimiter.core.RateLimitDecision;
import com.ratelimiter.core.RateLimitResult;
import com.ratelimiter.core.RateLimiterService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private final ClientIdResolver clientIdResolver;
    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(ClientIdResolver clientIdResolver,
                           RateLimiterService rateLimiterService,
                           ObjectMapper objectMapper) {
        this.clientIdResolver = clientIdResolver;
        this.rateLimiterService = rateLimiterService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator/")
            || path.startsWith("/admin/")
            || path.startsWith("/swagger-ui")
            || path.startsWith("/v3/api-docs")
            || path.equals("/error");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        RateLimitDecision decision = rateLimiterService.check(clientIdResolver.resolve(request));
        RateLimitResult result = decision.result();

        response.setHeader("X-RateLimit-Limit", Integer.toString(result.limit()));
        response.setHeader("X-RateLimit-Remaining", Integer.toString(result.remaining()));
        response.setHeader("X-RateLimit-Reset", Long.toString(result.resetEpochMs()));

        if (result.allowed()) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(result.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", Long.toString(Math.max(1, (long) Math.ceil(result.retryAfterMs() / 1000.0d))));
        objectMapper.writeValue(
            response.getWriter(),
            result.errorBody(decision.clientId(), decision.config().windowMs())
        );
    }
}
