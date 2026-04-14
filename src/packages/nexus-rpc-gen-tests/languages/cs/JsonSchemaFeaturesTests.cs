using System.Text.Json;
using System.Text.Json.Nodes;
using NexusServices;
using Xunit;

public class JsonSchemaFeaturesTests
{
    private static JsonSchemaFeaturesPayload BuildPayload()
    {
        return new JsonSchemaFeaturesPayload
        {
            Id = "RPC-001",
            Count = 5,
            Price = 29.5,
            Active = true,
            Status = Status.Active,
            Tags = new[] { "urgent", "reviewed" },
            Metadata = new Dictionary<string, string>
            {
                { "source", "api" },
                { "region", "us-east-1" },
            },
            FixedKind = FixedKind.Payload,
            Timestamp = DateTimeOffset.Parse("2026-04-09T12:00:00Z"),
            ScoreMatrix = new[] { new[] { 1.0, 2.5 }, new[] { 3.0, 4.5 }, new[] { 5.0, 6.5 } },
            NullableNote = null!,
            Variant = (Actor)"beta",
            Pet = new Cat
            {
                Kind = Kind.Dog,
                Breed = Breed.Herding,
            },
            Contact = new PrimaryContact
            {
                Method = Method.Email,
                Email = "alice@example.com",
            },
            Address = new ShippingAddress
            {
                Line1 = "123 Main St",
                City = "Springfield",
                CountryCode = "US",
                PostalCode = "62704",
                Residential = true,
                Instructions = "Leave at front door",
            },
            Manager = new Manager
            {
                Name = "Bob Smith",
                Email = "bob@example.com",
                Department = "Engineering",
                Reports = 8,
            },
            History = new[]
            {
                new HistoryEvent
                {
                    At = DateTimeOffset.Parse("2026-01-15T09:30:00Z"),
                    Action = NexusServices.Action.Created,
                    Actor = (Actor)"alice",
                },
                new HistoryEvent
                {
                    At = DateTimeOffset.Parse("2026-03-22T14:15:00Z"),
                    Action = NexusServices.Action.Updated,
                    Actor = (Actor)42L,
                },
            },
        };
    }

    private static string ReadFixture()
    {
        return File.ReadAllText("../../../../../definitions/json-schema-features-payload.json");
    }

    [Fact]
    public void JsonSchemaFeaturesRoundTrip()
    {
        var payload = BuildPayload();

        // Serialize, parse both sides, normalize, compare.
        var serialized = JsonSerializer.Serialize(payload, Converter.Settings);
        var actual = JsonNode.Parse(serialized)!;
        var expected = JsonNode.Parse(ReadFixture())!;
        Normalize(actual);
        Normalize(expected);
        Assert.True(JsonEqual(actual, expected),
            $"Expected: {expected.ToJsonString()}\nActual: {actual.ToJsonString()}");
    }

    [Fact]
    public void JsonSchemaFeaturesDeserialize()
    {
        // Deserialize fixture and compare against the same payload.
        var deserialized = JsonSerializer.Deserialize<JsonSchemaFeaturesPayload>(ReadFixture(), Converter.Settings)!;
        var expected = BuildPayload();
        Assert.Equivalent(expected, deserialized, strict: true);
    }

    /// <summary>normalize date strings to YYYY-MM-DDTHH:mm:ssZ.</summary>
    private static void Normalize(JsonNode? node)
    {
        if (node == null)
        {
            return;
        }
        if (node is JsonObject obj)
        {
            foreach (var kvp in obj)
            {
                if (kvp.Value is JsonValue val && val.TryGetValue(out string? str) && str is not null
                    && DateTimeOffset.TryParse(str, out var dto))
                {
                    obj[kvp.Key] = JsonValue.Create(dto.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"));
                }
                Normalize(kvp.Value);
            }
        }
        else if (node is JsonArray arr)
        {
            foreach (var item in arr)
            {
                Normalize(item);
            }
        }
    }

    /// <summary>Recursive JSON comparison treating numeric 1 and 1.0 as equal.</summary>
    private static bool JsonEqual(JsonNode? a, JsonNode? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;

        if (a is JsonObject aObj && b is JsonObject bObj)
        {
            if (aObj.Count != bObj.Count) return false;
            foreach (var kvp in aObj)
            {
                if (!bObj.ContainsKey(kvp.Key)) return false;
                if (!JsonEqual(kvp.Value, bObj[kvp.Key])) return false;
            }
            return true;
        }
        if (a is JsonArray aArr && b is JsonArray bArr)
        {
            if (aArr.Count != bArr.Count) return false;
            for (int i = 0; i < aArr.Count; i++)
            {
                if (!JsonEqual(aArr[i], bArr[i])) return false;
            }
            return true;
        }
        if (a is JsonValue aVal && b is JsonValue bVal)
        {
            // Numeric comparison: treat 1 and 1.0 as equal
            if (aVal.TryGetValue(out double ad) && bVal.TryGetValue(out double bd))
            {
                return ad == bd;
            }
            return a.ToJsonString() == b.ToJsonString();
        }
        return false;
    }
}
