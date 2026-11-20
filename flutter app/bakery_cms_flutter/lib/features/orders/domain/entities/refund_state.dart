/// Where the money stands, read from the refund record the GATEWAY writes
/// to: the website's `RefundState` (features/orders/lib/cancellation-policy.ts).
/// "Processed" means the gateway said so; a refund the bank bounced is
/// [failed], never "in progress".
enum RefundState { notApplicable, pending, processing, processed, failed }
