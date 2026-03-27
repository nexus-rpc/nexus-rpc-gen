package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AddItemOutput {
    private String itemId;
    private String createdAt;

    @JsonProperty("itemId")
    public String getItemId() {
        return itemId;
    }

    @JsonProperty("itemId")
    public void setItemId(String itemId) {
        this.itemId = itemId;
    }

    @JsonProperty("createdAt")
    public String getCreatedAt() {
        return createdAt;
    }

    @JsonProperty("createdAt")
    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
