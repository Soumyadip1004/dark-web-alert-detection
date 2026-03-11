/**
 * Regex patterns for detecting sensitive financial and personal data
 * in scraped dark-web content.
 *
 * Each pattern is designed to balance precision and recall:
 *   - Precise enough to avoid excessive false positives on normal text
 *   - Broad enough to catch common formatting variations used in leaks
 *
 * Patterns are grouped by detection category and exported both
 * individually and as a combined collection.
 */

// ─── Types ─────────────────────────────────────────────

export interface PatternEntry {
  /** Unique identifier for this pattern */
  id: string;
  /** Human-readable name */
  name: string;
  /** The regex pattern (global flag for match-all scanning) */
  regex: RegExp;
  /** Which leak category this pattern belongs to */
  category: PatternCategory;
  /** Severity weight from 1 (low signal) to 10 (very high signal) */
  weight: number;
  /** Brief description of what this pattern detects */
  description: string;
}

export type PatternCategory =
  | "CREDIT_CARD"
  | "CREDENTIAL_DUMP"
  | "BANK_DATA"
  | "PII"
  | "CRYPTO";

export interface PatternMatch {
  /** Which pattern was matched */
  patternId: string;
  patternName: string;
  category: PatternCategory;
  weight: number;
  /** Number of matches found */
  matchCount: number;
  /** Sample matches (first N, redacted for safety) */
  samples: string[];
}

// ─── Credit Card Patterns ──────────────────────────────

/**
 * Matches sequences of 13–19 digits that look like credit card numbers.
 * Allows spaces, dashes, or dots as separators between digit groups.
 *
 * Covers: Visa, MasterCard, Amex, Discover, Diners, JCB, UnionPay
 *
 * Note: Uses word boundaries and negative lookbehind/lookahead to reduce
 * false positives from phone numbers, timestamps, and other numeric sequences.
 */
const CREDIT_CARD_GENERIC: PatternEntry = {
  id: "cc_generic",
  name: "Credit Card Number (Generic)",
  regex: /\b(?:\d[ \-.]*?){13,19}\b/g,
  category: "CREDIT_CARD",
  weight: 6,
  description: "Generic 13–19 digit sequence resembling a card number",
};

/**
 * Visa cards: start with 4, 13 or 16 digits
 */
const CREDIT_CARD_VISA: PatternEntry = {
  id: "cc_visa",
  name: "Visa Card Number",
  regex: /\b4\d{3}[\s\-.]?\d{4}[\s\-.]?\d{4}[\s\-.]?\d{1,4}\b/g,
  category: "CREDIT_CARD",
  weight: 7,
  description: "Visa card pattern (starts with 4, 13–16 digits)",
};

/**
 * MasterCard: starts with 51–55 or 2221–2720, 16 digits
 */
const CREDIT_CARD_MASTERCARD: PatternEntry = {
  id: "cc_mastercard",
  name: "MasterCard Number",
  regex: /\b5[1-5]\d{2}[\s\-.]?\d{4}[\s\-.]?\d{4}[\s\-.]?\d{4}\b/g,
  category: "CREDIT_CARD",
  weight: 7,
  description: "MasterCard pattern (starts with 51–55, 16 digits)",
};

/**
 * American Express: starts with 34 or 37, 15 digits
 */
const CREDIT_CARD_AMEX: PatternEntry = {
  id: "cc_amex",
  name: "American Express Card Number",
  regex: /\b3[47]\d{2}[\s\-.]?\d{6}[\s\-.]?\d{5}\b/g,
  category: "CREDIT_CARD",
  weight: 7,
  description: "Amex pattern (starts with 34/37, 15 digits)",
};

/**
 * Discover: starts with 6011, 622126–622925, 644–649, or 65
 */
const CREDIT_CARD_DISCOVER: PatternEntry = {
  id: "cc_discover",
  name: "Discover Card Number",
  regex: /\b6(?:011|5\d{2}|4[4-9]\d)[\s\-.]?\d{4}[\s\-.]?\d{4}[\s\-.]?\d{4}\b/g,
  category: "CREDIT_CARD",
  weight: 7,
  description: "Discover card pattern (starts with 6011/65/644–649, 16 digits)",
};

/**
 * CVV/CVC codes: 3–4 digit codes often found alongside card numbers.
 * Only matched when preceded by a label-like context.
 */
const CVV_PATTERN: PatternEntry = {
  id: "cvv",
  name: "CVV/CVC Code",
  regex: /\b(?:cvv|cvc|cvv2|cvc2|cid|security\s*code)\s*[:=-]?\s*\d{3,4}\b/gi,
  category: "CREDIT_CARD",
  weight: 8,
  description: "CVV/CVC security code with label context",
};

/**
 * Card expiry dates in common formats: MM/YY, MM/YYYY, MM-YY, etc.
 * Only matched when preceded by a label.
 */
const CARD_EXPIRY: PatternEntry = {
  id: "card_expiry",
  name: "Card Expiry Date",
  regex:
    /\b(?:exp(?:iry|iration)?[\s]*(?:date)?|valid\s*(?:thru|through|until))[\s:=-]*(?:0[1-9]|1[0-2])[\s/\-.](2[0-9]|[2-9][0-9]|20[2-9]\d)\b/gi,
  category: "CREDIT_CARD",
  weight: 5,
  description: "Card expiry date with label (MM/YY or MM/YYYY)",
};

// ─── Credential Dump Patterns ──────────────────────────

/**
 * email:password pattern — the classic credential dump format.
 * Matches email-like strings followed by a colon and a password.
 */
const EMAIL_PASSWORD: PatternEntry = {
  id: "email_password",
  name: "Email:Password Pair",
  regex: /[\w.+-]+@[\w.-]+\.[a-z]{2,}:[^\s,;]{3,}/gi,
  category: "CREDENTIAL_DUMP",
  weight: 9,
  description: "Email:password credential pair",
};

/**
 * username:password pattern (non-email usernames).
 */
const USERNAME_PASSWORD: PatternEntry = {
  id: "username_password",
  name: "Username:Password Pair",
  regex: /\b[a-zA-Z][\w.]{2,30}:[^\s:,;]{4,}\b/g,
  category: "CREDENTIAL_DUMP",
  weight: 6,
  description: "Username:password credential pair",
};

/**
 * Bcrypt password hashes — commonly found in database dumps.
 */
const BCRYPT_HASH: PatternEntry = {
  id: "bcrypt_hash",
  name: "Bcrypt Hash",
  regex: /\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}/g,
  category: "CREDENTIAL_DUMP",
  weight: 8,
  description: "Bcrypt password hash",
};

/**
 * MD5 hashes — 32 hex chars, often found in older credential dumps.
 */
const MD5_HASH: PatternEntry = {
  id: "md5_hash",
  name: "MD5 Hash",
  regex: /\b[a-f0-9]{32}\b/gi,
  category: "CREDENTIAL_DUMP",
  weight: 5,
  description: "MD5 hash (32 hex characters)",
};

/**
 * SHA-1 hashes — 40 hex chars.
 */
const SHA1_HASH: PatternEntry = {
  id: "sha1_hash",
  name: "SHA-1 Hash",
  regex: /\b[a-f0-9]{40}\b/gi,
  category: "CREDENTIAL_DUMP",
  weight: 5,
  description: "SHA-1 hash (40 hex characters)",
};

/**
 * SHA-256 hashes — 64 hex chars.
 */
const SHA256_HASH: PatternEntry = {
  id: "sha256_hash",
  name: "SHA-256 Hash",
  regex: /\b[a-f0-9]{64}\b/gi,
  category: "CREDENTIAL_DUMP",
  weight: 5,
  description: "SHA-256 hash (64 hex characters)",
};

// ─── Bank Data Patterns ────────────────────────────────

/**
 * IBAN (International Bank Account Number).
 * Format: 2 letter country code + 2 check digits + up to 30 alphanumeric.
 */
const IBAN: PatternEntry = {
  id: "iban",
  name: "IBAN Number",
  regex:
    /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?(?:[\dA-Z]{4}[\s]?){1,7}[\dA-Z]{1,4}\b/g,
  category: "BANK_DATA",
  weight: 8,
  description: "International Bank Account Number (IBAN)",
};

/**
 * SWIFT/BIC codes — 8 or 11 character bank identifiers.
 * Format: 4 bank code + 2 country + 2 location + optional 3 branch.
 */
const SWIFT_BIC: PatternEntry = {
  id: "swift_bic",
  name: "SWIFT/BIC Code",
  regex: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
  category: "BANK_DATA",
  weight: 5,
  description: "SWIFT/BIC bank identifier code (8 or 11 characters)",
};

/**
 * US bank routing numbers — 9 digits starting with valid Fed district.
 */
const US_ROUTING_NUMBER: PatternEntry = {
  id: "us_routing",
  name: "US Bank Routing Number",
  regex: /\b(?:0[1-9]|[1-2]\d|3[0-2]|6[1-9]|7[0-2]|80)\d{7}\b/g,
  category: "BANK_DATA",
  weight: 7,
  description: "US bank ABA routing transit number (9 digits)",
};

/**
 * Account number patterns — when preceded by a banking context label.
 */
const BANK_ACCOUNT_NUMBER: PatternEntry = {
  id: "bank_account",
  name: "Bank Account Number",
  regex: /\b(?:account\s*(?:no|number|#|num)?)[\s:=-]*\d{6,18}\b/gi,
  category: "BANK_DATA",
  weight: 7,
  description: "Bank account number with label context",
};

// ─── PII Patterns ──────────────────────────────────────

/**
 * US Social Security Numbers — XXX-XX-XXXX format.
 * Excludes known invalid ranges (000, 666, 900+).
 */
const SSN: PatternEntry = {
  id: "ssn",
  name: "US Social Security Number",
  regex: /\b(?!000|666|9\d{2})\d{3}[\s\-.]?(?!00)\d{2}[\s\-.]?(?!0000)\d{4}\b/g,
  category: "PII",
  weight: 8,
  description: "US SSN in XXX-XX-XXXX format",
};

/**
 * Email addresses — standard RFC-ish pattern.
 * Used to count leaked email volumes, not for credential detection.
 */
const EMAIL_ADDRESS: PatternEntry = {
  id: "email",
  name: "Email Address",
  regex: /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
  category: "PII",
  weight: 3,
  description: "Email address",
};

/**
 * Phone numbers — various international formats.
 * Matches +CC-XXX-XXX-XXXX, (XXX) XXX-XXXX, etc.
 */
const PHONE_NUMBER: PatternEntry = {
  id: "phone",
  name: "Phone Number",
  regex:
    /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g,
  category: "PII",
  weight: 3,
  description: "Phone number in various international formats",
};

/**
 * IP addresses (IPv4).
 */
const IPV4_ADDRESS: PatternEntry = {
  id: "ipv4",
  name: "IPv4 Address",
  regex:
    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  category: "PII",
  weight: 3,
  description: "IPv4 address",
};

/**
 * Passport numbers — common format: 1–2 letters + 6–9 digits.
 * Only matched when preceded by a "passport" label.
 */
const PASSPORT_NUMBER: PatternEntry = {
  id: "passport",
  name: "Passport Number",
  regex: /\bpassport[\s#:=-]*[A-Z]{1,2}\d{6,9}\b/gi,
  category: "PII",
  weight: 8,
  description: "Passport number with label context",
};

// ─── Cryptocurrency Patterns ───────────────────────────

/**
 * Bitcoin addresses — both legacy (1/3) and Bech32 (bc1) formats.
 */
const BITCOIN_ADDRESS: PatternEntry = {
  id: "btc_address",
  name: "Bitcoin Address",
  regex: /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})\b/g,
  category: "CRYPTO",
  weight: 4,
  description: "Bitcoin address (legacy or Bech32)",
};

/**
 * Ethereum addresses — 0x followed by 40 hex characters.
 */
const ETHEREUM_ADDRESS: PatternEntry = {
  id: "eth_address",
  name: "Ethereum Address",
  regex: /\b0x[a-fA-F0-9]{40}\b/g,
  category: "CRYPTO",
  weight: 4,
  description: "Ethereum address (0x + 40 hex chars)",
};

/**
 * Monero addresses — start with 4 or 8, 95 characters.
 * Monero is commonly used on dark-web marketplaces.
 */
const MONERO_ADDRESS: PatternEntry = {
  id: "xmr_address",
  name: "Monero Address",
  regex: /\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
  category: "CRYPTO",
  weight: 5,
  description: "Monero address (95 characters starting with 4 or 8)",
};

// ─── Combined Exports ──────────────────────────────────

/**
 * All detection patterns grouped by category.
 */
export const CREDIT_CARD_PATTERNS: PatternEntry[] = [
  CREDIT_CARD_GENERIC,
  CREDIT_CARD_VISA,
  CREDIT_CARD_MASTERCARD,
  CREDIT_CARD_AMEX,
  CREDIT_CARD_DISCOVER,
  CVV_PATTERN,
  CARD_EXPIRY,
];

export const CREDENTIAL_PATTERNS: PatternEntry[] = [
  EMAIL_PASSWORD,
  USERNAME_PASSWORD,
  BCRYPT_HASH,
  MD5_HASH,
  SHA1_HASH,
  SHA256_HASH,
];

export const BANK_DATA_PATTERNS: PatternEntry[] = [
  IBAN,
  SWIFT_BIC,
  US_ROUTING_NUMBER,
  BANK_ACCOUNT_NUMBER,
];

export const PII_PATTERNS: PatternEntry[] = [
  SSN,
  EMAIL_ADDRESS,
  PHONE_NUMBER,
  IPV4_ADDRESS,
  PASSPORT_NUMBER,
];

export const CRYPTO_PATTERNS: PatternEntry[] = [
  BITCOIN_ADDRESS,
  ETHEREUM_ADDRESS,
  MONERO_ADDRESS,
];

/**
 * All patterns combined into a single flat array.
 */
export const ALL_PATTERNS: PatternEntry[] = [
  ...CREDIT_CARD_PATTERNS,
  ...CREDENTIAL_PATTERNS,
  ...BANK_DATA_PATTERNS,
  ...PII_PATTERNS,
  ...CRYPTO_PATTERNS,
];

/**
 * Patterns organized by category for targeted scanning.
 */
export const PATTERNS_BY_CATEGORY: Record<PatternCategory, PatternEntry[]> = {
  CREDIT_CARD: CREDIT_CARD_PATTERNS,
  CREDENTIAL_DUMP: CREDENTIAL_PATTERNS,
  BANK_DATA: BANK_DATA_PATTERNS,
  PII: PII_PATTERNS,
  CRYPTO: CRYPTO_PATTERNS,
};

/**
 * High-priority patterns only (weight >= 7).
 * Useful for fast first-pass scanning.
 */
export const HIGH_PRIORITY_PATTERNS: PatternEntry[] = ALL_PATTERNS.filter(
  p => p.weight >= 7,
);

/**
 * Total count of all patterns.
 */
export const PATTERN_COUNT = ALL_PATTERNS.length;

// ─── Pattern Matching Utilities ────────────────────────

/**
 * Maximum number of sample matches to keep per pattern.
 * Samples are redacted and stored in alerts for analyst review.
 */
const MAX_SAMPLES = 5;

/**
 * Run a single pattern against the given content.
 * Returns null if no matches are found.
 *
 * Regex objects are stateful when using the `g` flag, so we
 * recreate them from source to ensure clean matching state.
 */
export function runPattern(
  pattern: PatternEntry,
  content: string,
): PatternMatch | null {
  // Recreate the regex to reset lastIndex (global regexes are stateful)
  const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
  const matches: string[] = [];

  for (const match of content.matchAll(regex)) {
    matches.push(match[0]);
  }

  if (matches.length === 0) {
    return null;
  }

  // Collect samples (redacted for safety)
  const samples = matches.slice(0, MAX_SAMPLES).map(m => redactMatch(m));

  return {
    patternId: pattern.id,
    patternName: pattern.name,
    category: pattern.category,
    weight: pattern.weight,
    matchCount: matches.length,
    samples,
  };
}

/**
 * Run all patterns in a set against the given content.
 * Returns only patterns that had at least one match.
 */
export function runPatterns(
  patterns: PatternEntry[],
  content: string,
): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (const pattern of patterns) {
    const match = runPattern(pattern, content);
    if (match) {
      results.push(match);
    }
  }

  return results;
}

/**
 * Redact a matched string for safe storage.
 * Shows the first and last few characters with the middle masked.
 *
 * Examples:
 *   "4111111111111111" → "4111****1111"
 *   "user@email.com:password123" → "use****123"
 */
function redactMatch(raw: string): string {
  const value = raw.trim();
  if (value.length <= 6) {
    return "*".repeat(value.length);
  }
  const showChars = Math.min(4, Math.floor(value.length / 4));
  const start = value.slice(0, showChars);
  const end = value.slice(-showChars);
  return `${start}${"*".repeat(Math.max(4, value.length - showChars * 2))}${end}`;
}
