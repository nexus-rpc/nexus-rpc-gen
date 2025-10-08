package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;

public class ComplexInput {
  private ComplexInput selfRef;
  private SharedObject someSharedObj;

  @JsonProperty("selfRef")
  public ComplexInput getSelfRef() {
    return selfRef;
  }

  @JsonProperty("selfRef")
  public void setSelfRef(ComplexInput value) {
    this.selfRef = value;
  }

  @JsonProperty("someSharedObj")
  public SharedObject getSomeSharedObj() {
    return someSharedObj;
  }

  @JsonProperty("someSharedObj")
  public void setSomeSharedObj(SharedObject value) {
    this.someSharedObj = value;
  }
}
