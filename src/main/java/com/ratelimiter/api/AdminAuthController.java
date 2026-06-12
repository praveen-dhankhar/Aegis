package com.ratelimiter.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/auth")
public class AdminAuthController {

    @GetMapping("/validate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void validate() {
        // Authentication is enforced by AdminAuthInterceptor.
    }
}
