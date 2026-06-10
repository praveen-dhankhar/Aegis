package com.ratelimiter.core;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StoreUnavailableExceptionTest {

    @Test
    void supportsMessageOnlyConstructor() {
        StoreUnavailableException exception = new StoreUnavailableException("down");

        assertThat(exception).hasMessage("down");
    }
}
