namespace NexusServices;

using System.Text.Json.Serialization;

public record MyExistingType(
    [property: JsonPropertyName("someField")] string SomeField)
{
    public record MyExistingNestedType(
        [property: JsonPropertyName("someNestedField")] long? SomeNestedField);
}