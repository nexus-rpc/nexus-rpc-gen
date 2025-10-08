package com.example;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MyExistingType {
  private String someField;

  @JsonProperty("someField")
  public String getSomeField() {
    return someField;
  }

  @JsonProperty("someField")
  public void setSomeField(String someField) {
    this.someField = someField;
  }

  public static class MyExistingNestedType {
    private Long someNestedField;

    @JsonProperty("someNestedField")
    public Long getSomeNestedField() {
      return someNestedField;
    }

    @JsonProperty("someNestedField")
    public void setSomeNestedField(Long someNestedField) {
      this.someNestedField = someNestedField;
    }
  }
}
