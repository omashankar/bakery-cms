export type RefundStatus = "requested" | "processing" | "completed" | "rejected";

export type RefundReasonCode =
  | "customer_request"
  | "duplicate_order"
  | "quality_issue"
  | "delivery_failed"
  | "payment_error"
  | "order_cancelled"
  | "other";

export interface RefundEvent {
  status: RefundStatus;
  at: string;
  note?: string;
}

export interface RefundRecord {
  status: RefundStatus;
  reason: RefundReasonCode;
  reasonDetail?: string;
  amount: number;
  reference?: string;
  notes?: string;
  requestedAt?: string;
  completedAt?: string;
  history: RefundEvent[];
}
