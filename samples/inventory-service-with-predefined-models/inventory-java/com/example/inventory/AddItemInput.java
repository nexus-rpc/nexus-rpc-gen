package com.example.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Details of a new item to add to the catalog. */
public class AddItemInput {
    private String sku;
    private String name;
    private int initialQuantity;

    @JsonProperty("sku")
    public String getSku() {
        return sku;
    }

    @JsonProperty("sku")
    public void setSku(String sku) {
        this.sku = sku;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    @JsonProperty("name")
    public void setName(String name) {
        this.name = name;
    }

    @JsonProperty("initialQuantity")
    public int getInitialQuantity() {
        return initialQuantity;
    }

    @JsonProperty("initialQuantity")
    public void setInitialQuantity(int initialQuantity) {
        this.initialQuantity = initialQuantity;
    }
}
