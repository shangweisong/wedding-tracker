// ─── PAYNOW QR PAYLOAD GENERATOR ──────────────────────────────────────────────
// Builds the EMVCo / SGQR payment string that a Singapore banking app reads from
// a PayNow QR code. This is 100% client-side: the string just encodes the payee's
// PayNow mobile proxy, a fixed amount and a checksum — no API, no key, no backend.
// Spec: EMVCo "QR Code Specification for Payment Systems" (Merchant-Presented Mode)
// plus the "SG.PAYNOW" merchant-account template.

// Encode one EMV data object: 2-digit id + 2-digit length + value.
function tlv(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC-16/CCITT-FALSE (polynomial 0x1021, initial value 0xFFFF) over the ASCII
// bytes of the payload, per the EMVCo spec. Returns 4 uppercase hex chars.
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Normalise a Singapore mobile number to PayNow's "+65XXXXXXXX" proxy format.
// Accepts common inputs like "91234567", "+65 9123 4567", "6591234567".
// Returns "" if it is not a valid 8-digit SG mobile number.
export function normalizeMobile(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // Strip a leading 65 country code if the user already included it.
  const local = digits.length === 10 && digits.startsWith("65") ? digits.slice(2) : digits;
  // SG mobile numbers are 8 digits and start with 8 or 9.
  if (!/^[89]\d{7}$/.test(local)) return "";
  return `+65${local}`;
}

// Expiry defaults to ~5 years out (PayNow requires the field; far-future = no
// practical expiry for a static, reusable QR).
function defaultExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// Build the PayNow QR payload string.
//   mobile        – payee's PayNow-linked mobile (any common SG format)
//   amount        – number, SGD (> 0)
//   merchantName  – payee display name (<= 25 chars), optional
//   editable      – if true, the payer may change the amount in their banking app
//   expiry        – "YYYYMMDD"; defaults to ~5 years out
// Returns the EMV string, or "" when inputs are invalid.
export function buildPayNowPayload({ mobile, amount, merchantName = "NA", editable = false, expiry } = {}) {
  const proxy = normalizeMobile(mobile);
  const amt = Number(amount);
  if (!proxy || !Number.isFinite(amt) || amt <= 0) return "";

  // PayNow merchant-account-information template (id 26).
  const merchantAccount =
    tlv("00", "SG.PAYNOW") +
    tlv("01", "0") +                    // proxy type: 0 = mobile
    tlv("02", proxy) +                  // proxy value
    tlv("03", editable ? "1" : "0") +   // amount editable flag (0 = locked)
    tlv("04", expiry || defaultExpiry());

  const name = String(merchantName || "NA").trim().slice(0, 25) || "NA";

  const payloadNoCrc =
    tlv("00", "01") +                   // payload format indicator
    tlv("01", "12") +                   // point of initiation: 12 = dynamic (amount preset)
    tlv("26", merchantAccount) +
    tlv("52", "0000") +                 // merchant category code
    tlv("53", "702") +                  // currency: SGD
    tlv("54", amt.toFixed(2)) +         // transaction amount
    tlv("58", "SG") +                   // country
    tlv("59", name) +                   // merchant name
    tlv("60", "Singapore") +            // merchant city
    "6304";                             // CRC id + length; value appended below

  return payloadNoCrc + crc16(payloadNoCrc);
}
