package io.nexusrpc.gen;

import static org.junit.jupiter.api.Assertions.*;

import com.example.nexusservices.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class JsonSchemaFeaturesTest {

  private static final ObjectMapper mapper =
      new ObjectMapper()
          .registerModule(new JavaTimeModule())
          .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);

  private static final DateTimeFormatter CANONICAL =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

  private static JSONSchemaFeaturesPayload buildPayload() {
    JSONSchemaFeaturesPayload payload = new JSONSchemaFeaturesPayload();
    payload.setID("RPC-001");
    payload.setCount(5);
    payload.setPrice(29.5);
    payload.setActive(true);
    payload.setStatus(Status.ACTIVE);
    payload.setTags(new String[] {"urgent", "reviewed"});
    Map<String, String> metadata = new HashMap<>();
    metadata.put("source", "api");
    metadata.put("region", "us-east-1");
    payload.setMetadata(metadata);
    payload.setFixedKind(FixedKind.PAYLOAD);
    payload.setTimestamp(OffsetDateTime.parse("2026-04-09T12:00:00Z"));
    payload.setScoreMatrix(new double[][] {{1.0, 2.5}, {3.0, 4.5}, {5.0, 6.5}});
    payload.setNullableNote(null);

    Actor variantActor = new Actor();
    variantActor.stringValue = "beta";
    payload.setVariant(variantActor);

    Cat pet = new Cat();
    pet.setKind(Kind.DOG);
    pet.setBreed(Breed.HERDING);
    payload.setPet(pet);

    PrimaryContact contact = new PrimaryContact();
    contact.setMethod(Method.EMAIL);
    contact.setEmail("alice@example.com");
    payload.setContact(contact);

    ShippingAddress address = new ShippingAddress();
    address.setLine1("123 Main St");
    address.setCity("Springfield");
    address.setCountryCode("US");
    address.setPostalCode("62704");
    address.setResidential(true);
    address.setInstructions("Leave at front door");
    payload.setAddress(address);

    Manager manager = new Manager();
    manager.setName("Bob Smith");
    manager.setEmail("bob@example.com");
    manager.setDepartment("Engineering");
    manager.setReports(8L);
    payload.setManager(manager);

    Actor actor1 = new Actor();
    actor1.stringValue = "alice";
    HistoryEvent event1 = new HistoryEvent();
    event1.setAt(OffsetDateTime.parse("2026-01-15T09:30:00Z"));
    event1.setAction(Action.CREATED);
    event1.setActor(actor1);

    Actor actor2 = new Actor();
    actor2.integerValue = 42L;
    HistoryEvent event2 = new HistoryEvent();
    event2.setAt(OffsetDateTime.parse("2026-03-22T14:15:00Z"));
    event2.setAction(Action.UPDATED);
    event2.setActor(actor2);

    payload.setHistory(new HistoryEvent[] {event1, event2});
    return payload;
  }

  private static String readFixture() throws Exception {
    return new String(
        Files.readAllBytes(Paths.get("../../definitions/json-schema-features-payload.json")));
  }

  @Test
  public void roundTrip() throws Exception {
    JSONSchemaFeaturesPayload payload = buildPayload();

    // Serialize, parse both sides, normalize, compare.
    String serialized = mapper.writeValueAsString(payload);
    JsonNode actual = mapper.readTree(serialized);
    JsonNode expected = mapper.readTree(readFixture());
    normalize(actual);
    normalize(expected);
    assertTrue(jsonEqual(expected, actual), "Expected: " + expected + "\nActual: " + actual);
  }

  @Test
  public void deserialize() throws Exception {
    // Deserialize fixture and compare against the same payload.
    JSONSchemaFeaturesPayload deserialized =
        mapper.readValue(readFixture(), JSONSchemaFeaturesPayload.class);
    JSONSchemaFeaturesPayload expected = buildPayload();
    assertEquals(mapper.valueToTree(expected), mapper.valueToTree(deserialized));
  }

  /** Strip null values */
  private static void normalize(JsonNode node) {
    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;
      Iterator<Map.Entry<String, JsonNode>> it = obj.fields();
      while (it.hasNext()) {
        Map.Entry<String, JsonNode> entry = it.next();
        if (entry.getValue().isNull()) {
          it.remove();
        } else {
          normalize(entry.getValue());
        }
      }
    }
  }

  /** Recursive JSON comparison treating numeric 1 and 1.0 as equal. */
  private static boolean jsonEqual(JsonNode a, JsonNode b) {
    if (a.isNumber() && b.isNumber()) {
      return a.decimalValue().compareTo(b.decimalValue()) == 0;
    }
    if (a.isObject() && b.isObject()) {
      if (a.size() != b.size()) return false;
      Iterator<String> fields = a.fieldNames();
      while (fields.hasNext()) {
        String field = fields.next();
        if (!b.has(field) || !jsonEqual(a.get(field), b.get(field))) return false;
      }
      return true;
    }
    if (a.isArray() && b.isArray()) {
      if (a.size() != b.size()) return false;
      for (int i = 0; i < a.size(); i++) {
        if (!jsonEqual(a.get(i), b.get(i))) return false;
      }
      return true;
    }
    return a.equals(b);
  }
}
