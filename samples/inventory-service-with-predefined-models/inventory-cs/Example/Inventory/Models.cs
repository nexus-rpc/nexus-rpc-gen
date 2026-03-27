namespace Example.Inventory;

using System.Text.Json.Serialization;

/// <summary>Details of a new item to add to the catalog.</summary>
public record AddItemInput(
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("initialQuantity")] int InitialQuantity);

/// <summary>Confirmation that an item was added.</summary>
public record AddItemOutput(
    [property: JsonPropertyName("itemId")] string ItemId,
    [property: JsonPropertyName("createdAt")] string CreatedAt);

/// <summary>Parameters for a stock-level lookup.</summary>
public record StockQuery(
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("includeReserved")] bool IncludeReserved = false);

/// <summary>Current stock counts for a single item.</summary>
public record StockLevel(
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("available")] int Available,
    [property: JsonPropertyName("reserved")] int Reserved,
    [property: JsonPropertyName("lastUpdated")] string LastUpdated);

/// <summary>Status of a stock reservation.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReservationStatus
{
    Pending,
    Confirmed,
    Expired
}

/// <summary>A request to hold inventory for an order.</summary>
public record ReservationRequest(
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("quantity")] int Quantity,
    [property: JsonPropertyName("orderId")] string OrderId);

/// <summary>Outcome of a reservation attempt.</summary>
public record ReservationResult(
    [property: JsonPropertyName("reservationId")] string ReservationId,
    [property: JsonPropertyName("status")] ReservationStatus Status,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt);
