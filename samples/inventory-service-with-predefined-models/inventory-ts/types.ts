/** Details of a new item to add to the catalog. */
export interface AddItemInput {
  sku: string;
  name: string;
  initialQuantity: number;
}

/** Confirmation that an item was added. */
export interface AddItemOutput {
  itemId: string;
  createdAt: string;
}

/** Parameters for a stock-level lookup. */
export interface StockQuery {
  sku: string;
  includeReserved?: boolean;
}

/** Current stock counts for a single item. */
export interface StockLevel {
  sku: string;
  available: number;
  reserved: number;
  lastUpdated: string;
}

export type ReservationStatus = "pending" | "confirmed" | "expired";

/** A request to hold inventory for an order. */
export interface ReservationRequest {
  sku: string;
  quantity: number;
  orderId: string;
}

/** Outcome of a reservation attempt. */
export interface ReservationResult {
  reservationId: string;
  status: ReservationStatus;
  expiresAt: string;
}
