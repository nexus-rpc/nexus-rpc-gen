package types

// AddItemInput describes a new item to add to the catalog.
type AddItemInput struct {
	SKU             string `json:"sku"`
	Name            string `json:"name"`
	InitialQuantity int    `json:"initialQuantity"`
}

// AddItemOutput describes the creation of the item.
type AddItemOutput struct {
	ItemID    string `json:"itemId"`
	CreatedAt string `json:"createdAt"`
}
