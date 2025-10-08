package com.example.nexusservices;

import com.fasterxml.jackson.annotation.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.OffsetTime;

public class DateInput {
  private LocalDate date;
  private OffsetDateTime dateTime;
  private OffsetTime time;

  @JsonProperty("date")
  public LocalDate getDate() {
    return date;
  }

  @JsonProperty("date")
  public void setDate(LocalDate value) {
    this.date = value;
  }

  @JsonProperty("dateTime")
  public OffsetDateTime getDateTime() {
    return dateTime;
  }

  @JsonProperty("dateTime")
  public void setDateTime(OffsetDateTime value) {
    this.dateTime = value;
  }

  @JsonProperty("time")
  public OffsetTime getTime() {
    return time;
  }

  @JsonProperty("time")
  public void setTime(OffsetTime value) {
    this.time = value;
  }
}
