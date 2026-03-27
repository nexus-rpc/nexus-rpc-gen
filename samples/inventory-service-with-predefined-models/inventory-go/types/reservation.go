package types

type ReservationStatus string

const (
	ReservationPending   ReservationStatus = "pending"
	ReservationConfirmed ReservationStatus = "confirmed"
	ReservationExpired   ReservationStatus = "expired"
)

// ReservationRequest asks to hold inventory for an order.
type ReservationRequest struct {
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
	OrderID  string `json:"orderId"`
}

// ReservationResult returns a claim for an order reservation.
type ReservationResult struct {
	ReservationID string            `json:"reservationId"`
	Status        ReservationStatus `json:"status"`
	ExpiresAt     string            `json:"expiresAt"`
}
