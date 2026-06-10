package com.ratelimiter.core;

public class StoreUnavailableException extends RuntimeException {

    public StoreUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

    public StoreUnavailableException(String message) {
        super(message);
    }
}
