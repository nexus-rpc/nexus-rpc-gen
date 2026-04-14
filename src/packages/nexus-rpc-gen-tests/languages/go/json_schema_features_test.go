package main

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/nexus-rpc-gen/packages/nexus-rpc-gen-tests/languages/go/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func buildPayload() services.JSONSchemaFeaturesPayload {
	breed := services.Herding
	return services.JSONSchemaFeaturesPayload{
		ID:     "RPC-001",
		Count:  5,
		Price:  29.5,
		Active: true,
		Status: services.Active,
		Tags:   []string{"urgent", "reviewed"},
		Metadata: map[string]string{
			"source": "api",
			"region": "us-east-1",
		},
		Pet: services.PetClass{
			Kind:  services.Dog,
			Breed: &breed,
		},
		Contact: services.PrimaryContact{
			Email:  "alice@example.com",
			Method: services.Email,
		},
		Address: services.ShippingAddress{
			Line1:        "123 Main St",
			City:         "Springfield",
			CountryCode:  "US",
			PostalCode:   "62704",
			Residential:  true,
			Instructions: "Leave at front door",
		},
		History: []services.HistoryEvent{
			{
				At:     time.Date(2026, 1, 15, 9, 30, 0, 0, time.UTC),
				Action: services.Created,
				Actor:  &services.Actor{String: "alice"},
			},
			{
				At:     time.Date(2026, 3, 22, 14, 15, 0, 0, time.UTC),
				Action: services.Updated,
				Actor:  &services.Actor{Integer: 42},
			},
		},
		Variant:   &services.Actor{String: "beta"},
		Timestamp: time.Date(2026, 4, 9, 12, 0, 0, 0, time.UTC),
		FixedKind: services.Payload,
		ScoreMatrix: [][]float64{
			{1.0, 2.5},
			{3.0, 4.5},
			{5.0, 6.5},
		},
		Manager: services.Manager{
			Name:       "Bob Smith",
			Email:      "bob@example.com",
			Department: "Engineering",
			Reports:    8,
		},
	}
}

func TestJsonSchemaFeatures(t *testing.T) {
	payload := buildPayload()

	// Serialize, parse both sides, normalize, compare.
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	fixture, err := os.ReadFile("../../definitions/json-schema-features-payload.json")
	require.NoError(t, err)

	var actualMap, expectedMap map[string]any
	require.NoError(t, json.Unmarshal(data, &actualMap))
	require.NoError(t, json.Unmarshal(fixture, &expectedMap))

	// Go's Actor union type serializes as {"Integer":0,"String":"value"}
	// rather than a bare string/integer, so JSON won't match the fixture.
	// Remove these fields from both maps before the structural comparison,
	// then verify the Go structs hold the correct values directly.
	for _, m := range []map[string]any{actualMap, expectedMap} {
		delete(m, "variant")
		delete(m, "nullableNote")
		if history, ok := m["history"].([]any); ok {
			for _, h := range history {
				if event, ok := h.(map[string]any); ok {
					delete(event, "actor")
				}
			}
		}
	}
	assert.Equal(t, expectedMap, actualMap)

	// Verify union-type fields hold the correct values on the Go structs.
	assert.Equal(t, "beta", payload.Variant.String)
	assert.Equal(t, int64(0), payload.Variant.Integer)
	assert.Equal(t, "alice", payload.History[0].Actor.String)
	assert.Equal(t, int64(0), payload.History[0].Actor.Integer)
	assert.Equal(t, int64(42), payload.History[1].Actor.Integer)
	assert.Equal(t, "", payload.History[1].Actor.String)

	// Go represents nullableNote as a plain string; the zero value is the
	// closest equivalent to the fixture's null.
	assert.Equal(t, "", payload.NullableNote)
}

func TestJsonSchemaFeaturesDeserialize(t *testing.T) {
	fixture, err := os.ReadFile("../../definitions/json-schema-features-payload.json")
	require.NoError(t, err)

	// Parse raw fixture for verifying union-typed fields separately.
	var rawMap map[string]any
	require.NoError(t, json.Unmarshal(fixture, &rawMap))

	// Strip union-typed fields (Actor) that cannot be unmarshaled into Go
	// structs because Actor has no UnmarshalJSON and no json tags.
	var modifiable map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(fixture, &modifiable))
	delete(modifiable, "variant")

	var historyRaw []json.RawMessage
	require.NoError(t, json.Unmarshal(modifiable["history"], &historyRaw))
	for i, eventRaw := range historyRaw {
		var eventMap map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(eventRaw, &eventMap))
		delete(eventMap, "actor")
		historyRaw[i], err = json.Marshal(eventMap)
		require.NoError(t, err)
	}
	modifiable["history"], err = json.Marshal(historyRaw)
	require.NoError(t, err)

	modifiedJSON, err := json.Marshal(modifiable)
	require.NoError(t, err)

	var deserialized services.JSONSchemaFeaturesPayload
	require.NoError(t, json.Unmarshal(modifiedJSON, &deserialized))

	// Compare against the same payload used by the serialization test,
	// with Actor fields cleared since they were stripped from the JSON.
	expected := buildPayload()
	expected.Variant = nil
	for i := range expected.History {
		expected.History[i].Actor = nil
	}
	assert.Equal(t, expected, deserialized)

	// Verify union-typed fields from the raw JSON (cannot unmarshal into Actor).
	assert.Equal(t, "beta", rawMap["variant"])
	assert.Nil(t, rawMap["nullableNote"])
	history := rawMap["history"].([]any)
	assert.Equal(t, "alice", history[0].(map[string]any)["actor"])
	assert.Equal(t, float64(42), history[1].(map[string]any)["actor"])
}
