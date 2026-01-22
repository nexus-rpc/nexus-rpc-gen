using System.Text.Json;
using NexusRpc;

public class NexusJsonSerializer : ISerializer
{
    public static readonly NexusJsonSerializer Instance = new();

    public Task<object?> DeserializeAsync(ISerializer.Content content, Type type) =>
        Task.FromResult(JsonSerializer.Deserialize(content.Data, type));

    public Task<ISerializer.Content> SerializeAsync(object? value) =>
        Task.FromResult(new ISerializer.Content(JsonSerializer.SerializeToUtf8Bytes(value)));
}