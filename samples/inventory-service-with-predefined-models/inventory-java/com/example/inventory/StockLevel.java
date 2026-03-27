package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Current stock counts for a single item. */
public class StockLevel {
    private String sku;
    private int available;
    private int reserved;
    private String lastUpdated;

    @JsonProperty("sku")
    public String getSku() {
        return sku;
    }

    @JsonProperty("sku")
    public void setSku(String sku) {
        this.sku = sku;
    }

    @JsonProperty("available")
    public int getAvailable() {
        return available;
    }

    @JsonProperty("available")
    public void setAvailable(int available) {
        this.available = available;
    }

    @JsonProperty("reserved")
    public int getReserved() {
        return reserved;
    }

    @JsonProperty("reserved")
    public void setReserved(int reserved) {
        this.reserved = reserved;
    }

    @JsonProperty("lastUpdated")
    public String getLastUpdated() {
        return lastUpdated;
    }

    @JsonProperty("lastUpdated")
    public void setLastUpdated(String lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
