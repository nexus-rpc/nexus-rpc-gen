package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;

/** Input type */
public class KitchenSinkServiceComplexArgComplexResultInlineInput {
  private String string;

  /** String to count */
  @JsonProperty("string")
  public String getString() {
    return string;
  }

  @JsonProperty("string")
  public void setString(String value) {
    this.string = value;
  }
}
