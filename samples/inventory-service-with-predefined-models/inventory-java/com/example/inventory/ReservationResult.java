package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ReservationResult {
    private String reservationId;
    private ReservationStatus status;
    private String expiresAt;

    @JsonProperty("reservationId")
    public String getReservationId() {
        return reservationId;
    }

    @JsonProperty("reservationId")
    public void setReservationId(String reservationId) {
        this.reservationId = reservationId;
    }

    @JsonProperty("status")
    public ReservationStatus getStatus() {
        return status;
    }

    @JsonProperty("status")
    public void setStatus(ReservationStatus status) {
        this.status = status;
    }

    @JsonProperty("expiresAt")
    public String getExpiresAt() {
        return expiresAt;
    }

    @JsonProperty("expiresAt")
    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }
}
