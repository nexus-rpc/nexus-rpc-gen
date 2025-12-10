package io.nexusrpc.gen;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.nexusrpc.Serializer;
import java.io.IOException;
import java.lang.reflect.Type;

public class JacksonSerializer implements Serializer {
  public static final JacksonSerializer INSTANCE = new JacksonSerializer();

  private final ObjectMapper mapper;

  private JacksonSerializer() {
    mapper = new ObjectMapper();
  }

  public ObjectMapper getMapper() {
    return mapper;
  }

  @Override
  public Content serialize(Object o) {
    try {
      return Content.newBuilder().setData(mapper.writeValueAsBytes(o)).build();
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public Object deserialize(Content content, Type type) {
    if (!(type instanceof Class)) {
      throw new IllegalArgumentException("Invalid type: " + type);
    }
    try {
      return mapper.readValue(content.getData(), (Class<?>) type);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }
}
