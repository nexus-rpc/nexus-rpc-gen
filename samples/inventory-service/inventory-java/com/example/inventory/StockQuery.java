package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;

public class StockQuery {
    private String sku;
    private boolean includeReserved;

    @JsonProperty("sku")
    public String getSku() {
        return sku;
    }

    @JsonProperty("sku")
    public void setSku(String sku) {
        this.sku = sku;
    }

    @JsonProperty("includeReserved")
    public boolean isIncludeReserved() {
        return includeReserved;
    }

    @JsonProperty("includeReserved")
    public void setIncludeReserved(boolean includeReserved) {
        this.includeReserved = includeReserved;
    }
}
