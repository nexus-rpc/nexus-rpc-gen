package types

// StockQuery contains the parameters for a stock-level lookup.
type StockQuery struct {
	SKU             string `json:"sku"`
	IncludeReserved bool   `json:"includeReserved,omitempty"`
}

// StockLevel holds the current counts for a single item.
type StockLevel struct {
	SKU         string `json:"sku"`
	Available   int    `json:"available"`
	Reserved    int    `json:"reserved"`
	LastUpdated string `json:"lastUpdated"`
}
