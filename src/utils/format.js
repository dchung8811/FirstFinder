// Value formatting and coercion.
//
// toNumber is the single place a user-typed string becomes arithmetic, so every
// total in the app inherits its behaviour on blank and malformed input.

// Reference numbers are stored as plain integers and shown as FF-0001. The
// display form is what goes in the CSV, so parsing tolerates the prefix, bare
// digits, and stray whitespace alike.
export function formatReference(referenceNumber) {
  if (referenceNumber === null || referenceNumber === undefined || referenceNumber === "") return "";
  return `FF-${String(referenceNumber).padStart(4, "0")}`;
}

export function parseReference(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function toNumber(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(toNumber(value));
}

export function hasValue(value) {
  return value !== "" && value !== null && value !== undefined;
}
