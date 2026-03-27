package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ReservationStatus {
    PENDING("pending"),
    CONFIRMED("confirmed"),
    EXPIRED("expired");

    private final String value;

    ReservationStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
