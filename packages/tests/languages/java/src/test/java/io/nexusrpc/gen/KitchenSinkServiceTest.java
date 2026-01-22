package io.nexusrpc.gen;

import static org.junit.jupiter.api.Assertions.*;

import com.example.nexusservices.*;
import io.nexusrpc.handler.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.Test;

public class KitchenSinkServiceTest {

  @ServiceImpl(service = KitchenSinkService.class)
  public static class KitchenSinkServiceImpl {
    @OperationImpl
    public OperationHandler<String, Long> scalarArgScalarResult() {
      return OperationHandler.sync(
          (ctx, details, input) -> (long) Objects.requireNonNull(input).length());
    }

    @OperationImpl
    public OperationHandler<
            KitchenSinkServiceComplexArgComplexResultInlineInput,
            KitchenSinkServiceComplexArgComplexResultInlineOutput>
        complexArgComplexResultInline() {
      return OperationHandler.sync(
          (ctx, details, input) -> {
            KitchenSinkServiceComplexArgComplexResultInlineOutput out =
                new KitchenSinkServiceComplexArgComplexResultInlineOutput();
            out.setCharacterCount((long) Objects.requireNonNull(input).getString().length());
            return out;
          });
    }

    @OperationImpl
    public OperationHandler<String, Long> scalarArgScalarResultExternal() {
      return OperationHandler.sync(
          (ctx, details, input) -> {
            throw new UnsupportedOperationException();
          });
    }

    @OperationImpl
    public OperationHandler<ComplexInput, ComplexOutput> complexArgComplexResultExternal() {
      return OperationHandler.sync(
          (ctx, details, input) -> {
            throw new UnsupportedOperationException();
          });
    }
  }

  @Test
  void kitchenSinkHandler() throws Exception {
    // Just creating the handler validates the interface and class
    ServiceHandler handler =
        ServiceHandler.newBuilder()
            .addInstance(ServiceImplInstance.fromInstance(new KitchenSinkServiceImpl()))
            .setSerializer(JacksonSerializer.INSTANCE)
            .build();

    // We'll also test two method implementations
    OperationStartResult<HandlerResultContent> startResult =
        handler.startOperation(
            OperationContext.newBuilder()
                .setService("KitchenSinkService")
                .setOperation("scalarArgScalarResult")
                .build(),
            OperationStartDetails.newBuilder().setRequestId(UUID.randomUUID().toString()).build(),
            inputFromString("\"some string\""));
    long scalarResult = Long.parseLong(stringFromResult(startResult));
    assertEquals("some string".length(), scalarResult);

    startResult =
        handler.startOperation(
            OperationContext.newBuilder()
                .setService("KitchenSinkService")
                .setOperation("complexArgComplexResultInline")
                .build(),
            OperationStartDetails.newBuilder().setRequestId(UUID.randomUUID().toString()).build(),
            inputFromString("{ \"string\": \"some other string\" }"));
    KitchenSinkServiceComplexArgComplexResultInlineOutput complexResult =
        JacksonSerializer.INSTANCE
            .getMapper()
            .readValue(
                stringFromResult(startResult),
                KitchenSinkServiceComplexArgComplexResultInlineOutput.class);
    assertEquals("some other string".length(), complexResult.getCharacterCount());
  }

  private static HandlerInputContent inputFromString(String s) {
    return HandlerInputContent.newBuilder()
        .setDataStream(new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8)))
        .build();
  }

  public static String stringFromResult(OperationStartResult<HandlerResultContent> result) {
    return new String(
        Objects.requireNonNull(Objects.requireNonNull(result.getSyncResult()).getDataBytes()),
        StandardCharsets.UTF_8);
  }
}
