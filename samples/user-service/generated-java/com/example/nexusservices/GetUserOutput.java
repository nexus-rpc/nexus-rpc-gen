package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;

public class GetUserOutput {
  private User user;

  @JsonProperty("user")
  public User getUser() { return user; }
  @JsonProperty("user")
  public void setUser(User value) { this.user = value; }
}
