package com.ratelimiter.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ratelimiter.config.RateLimiterProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final RateLimiterProperties properties;
    private final ObjectMapper objectMapper;

    public AdminAuthInterceptor(RateLimiterProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (!requiresAdminKey(request)) {
            return true;
        }
        String configuredKey = properties.getAdminKey();
        String providedKey = request.getHeader("X-Admin-Key");
        if (StringUtils.hasText(configuredKey) && configuredKey.equals(providedKey)) {
            return true;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Map.of("error", "unauthorized"));
        return false;
    }

    private boolean requiresAdminKey(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return false;
        }
        if (!request.getRequestURI().startsWith("/admin/rate-limits")) {
            return request.getRequestURI().startsWith("/admin/auth/");
        }
        return HttpMethod.POST.matches(request.getMethod())
            || HttpMethod.PUT.matches(request.getMethod())
            || HttpMethod.DELETE.matches(request.getMethod());
    }
}
