package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;

public class DeleteUserInput {
  private String userID;

  /**
   * User ID for the user.
   */
  @JsonProperty("userId")
  public String getUserID() { return userID; }
  @JsonProperty("userId")
  public void setUserID(String value) { this.userID = value; }
}
