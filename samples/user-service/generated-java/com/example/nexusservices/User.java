package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;

/**
 * A user.
 */
public class User {
  private String email;
  private String userID;

  /**
   * Email for the user.
   */
  @JsonProperty("email")
  public String getEmail() { return email; }
  @JsonProperty("email")
  public void setEmail(String value) { this.email = value; }

  /**
   * User ID for the user.
   */
  @JsonProperty("userId")
  public String getUserID() { return userID; }
  @JsonProperty("userId")
  public void setUserID(String value) { this.userID = value; }
}
