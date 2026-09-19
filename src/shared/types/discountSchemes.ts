// GET /api/planning/admin/discount-schemes/ (planning/views.py admin_discount_schemes,
// added backend-side 2026-09-18) - the live "present status" of every active DC-facing
// scheme on the Discount Service (coupon-service), independent of the once-a-day
// pipeline pull that feeds pitches. Read-only; cached 1h server-side, ?refresh=true
// bypasses the cache.
export interface DiscountScheme {
  scheme_id: number | null;
  scheme_name: string | null;
  // Human label already resolved server-side (e.g. "Cash discount scheme").
  scheme_type: string | null;
  // One-paragraph plain-language summary the backend builds from the scheme's rules.
  generated_description: string | null;
  // Comma-joined names, resolved from IDs via Redshift; null when the scheme has no
  // node/state restriction at that level.
  node_names_raw: string | null;
  state_names_raw: string | null;
  // ISO date or "" when the scheme has no booking window.
  booking_end: string | null;
  // Rupee ceiling per DC, as the API returns it (a numeric string), null if unlimited.
  max_discount_per_dc: string | number | null;
}

export interface DiscountSchemeException {
  source: string;
  reason_code: string;
  detail: string;
}

export interface DiscountSchemesResponse {
  Fetched_At: string;
  Schemes: DiscountScheme[];
  Exceptions: DiscountSchemeException[];
}
