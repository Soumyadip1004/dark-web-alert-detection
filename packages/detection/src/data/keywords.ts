/**
 * Threat-intelligence keywords used by the leak detection engine
 * to identify suspicious content in scraped dark-web pages.
 *
 * Keywords are categorized by leak type and assigned a severity
 * weight (1–10) that feeds into the risk scoring algorithm.
 *
 * Higher weight = stronger signal that a real leak is present.
 */

export interface KeywordEntry {
  /** The keyword or phrase to match (case-insensitive) */
  term: string;
  /** Which leak type this keyword is associated with */
  category: KeywordCategory;
  /** Severity weight from 1 (low signal) to 10 (very high signal) */
  weight: number;
}

export type KeywordCategory =
  | "CREDIT_CARD"
  | "CREDENTIAL_DUMP"
  | "BANK_DATA"
  | "PII"
  | "GENERAL_THREAT";

// ─── Credit Card Related ───────────────────────────────

const CREDIT_CARD_KEYWORDS: KeywordEntry[] = [
  { term: "credit card", category: "CREDIT_CARD", weight: 6 },
  { term: "credit cards", category: "CREDIT_CARD", weight: 6 },
  { term: "cc dump", category: "CREDIT_CARD", weight: 9 },
  { term: "cc dumps", category: "CREDIT_CARD", weight: 9 },
  { term: "card dump", category: "CREDIT_CARD", weight: 9 },
  { term: "card dumps", category: "CREDIT_CARD", weight: 9 },
  { term: "cvv", category: "CREDIT_CARD", weight: 7 },
  { term: "cvv2", category: "CREDIT_CARD", weight: 8 },
  { term: "fullz", category: "CREDIT_CARD", weight: 10 },
  { term: "full info", category: "CREDIT_CARD", weight: 5 },
  { term: "track1", category: "CREDIT_CARD", weight: 9 },
  { term: "track2", category: "CREDIT_CARD", weight: 9 },
  { term: "track 1", category: "CREDIT_CARD", weight: 9 },
  { term: "track 2", category: "CREDIT_CARD", weight: 9 },
  { term: "magnetic stripe", category: "CREDIT_CARD", weight: 7 },
  { term: "card number", category: "CREDIT_CARD", weight: 5 },
  { term: "card numbers", category: "CREDIT_CARD", weight: 6 },
  { term: "debit card", category: "CREDIT_CARD", weight: 5 },
  { term: "debit cards", category: "CREDIT_CARD", weight: 5 },
  { term: "mastercard", category: "CREDIT_CARD", weight: 4 },
  { term: "visa card", category: "CREDIT_CARD", weight: 4 },
  { term: "amex", category: "CREDIT_CARD", weight: 4 },
  { term: "american express", category: "CREDIT_CARD", weight: 4 },
  { term: "bin list", category: "CREDIT_CARD", weight: 8 },
  { term: "bin checker", category: "CREDIT_CARD", weight: 7 },
  { term: "card checker", category: "CREDIT_CARD", weight: 7 },
  { term: "carding", category: "CREDIT_CARD", weight: 9 },
  { term: "carder", category: "CREDIT_CARD", weight: 8 },
  { term: "skimmer", category: "CREDIT_CARD", weight: 8 },
  { term: "skimmed", category: "CREDIT_CARD", weight: 7 },
  { term: "cloned card", category: "CREDIT_CARD", weight: 9 },
  { term: "cloned cards", category: "CREDIT_CARD", weight: 9 },
  { term: "card shop", category: "CREDIT_CARD", weight: 8 },
  { term: "fresh cards", category: "CREDIT_CARD", weight: 9 },
  { term: "valid cards", category: "CREDIT_CARD", weight: 8 },
  { term: "live cards", category: "CREDIT_CARD", weight: 8 },
  { term: "dead cards", category: "CREDIT_CARD", weight: 6 },
  { term: "exp date", category: "CREDIT_CARD", weight: 5 },
  { term: "expiry date", category: "CREDIT_CARD", weight: 4 },
  { term: "card holder", category: "CREDIT_CARD", weight: 5 },
  { term: "cardholder", category: "CREDIT_CARD", weight: 5 },
];

// ─── Credential Dump Related ───────────────────────────

const CREDENTIAL_DUMP_KEYWORDS: KeywordEntry[] = [
  { term: "credential dump", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "credentials dump", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "combo list", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "combolist", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "email:pass", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "email:password", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "user:pass", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "username:password", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "login dump", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "login data", category: "CREDENTIAL_DUMP", weight: 6 },
  { term: "login credentials", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "stolen credentials", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "leaked credentials", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "leaked passwords", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "password dump", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "password list", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "password leak", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "hashed passwords", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "plaintext passwords", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "brute force", category: "CREDENTIAL_DUMP", weight: 5 },
  { term: "credential stuffing", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "account checker", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "cracked accounts", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "hacked accounts", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "stealer log", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "stealer logs", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "infostealer", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "info stealer", category: "CREDENTIAL_DUMP", weight: 8 },
  { term: "redline stealer", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "raccoon stealer", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "vidar stealer", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "lumma stealer", category: "CREDENTIAL_DUMP", weight: 9 },
  { term: "keylogger", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "phishing kit", category: "CREDENTIAL_DUMP", weight: 7 },
  { term: "phishing page", category: "CREDENTIAL_DUMP", weight: 6 },
  { term: "phishing panel", category: "CREDENTIAL_DUMP", weight: 7 },
];

// ─── Bank Data / Financial ─────────────────────────────

const BANK_DATA_KEYWORDS: KeywordEntry[] = [
  { term: "bank login", category: "BANK_DATA", weight: 9 },
  { term: "bank logins", category: "BANK_DATA", weight: 9 },
  { term: "bank account", category: "BANK_DATA", weight: 6 },
  { term: "bank accounts", category: "BANK_DATA", weight: 6 },
  { term: "bank drop", category: "BANK_DATA", weight: 9 },
  { term: "bank drops", category: "BANK_DATA", weight: 9 },
  { term: "bank log", category: "BANK_DATA", weight: 8 },
  { term: "bank logs", category: "BANK_DATA", weight: 8 },
  { term: "bank leak", category: "BANK_DATA", weight: 9 },
  { term: "bank breach", category: "BANK_DATA", weight: 9 },
  { term: "bank database", category: "BANK_DATA", weight: 9 },
  { term: "bank data", category: "BANK_DATA", weight: 7 },
  { term: "banking trojan", category: "BANK_DATA", weight: 8 },
  { term: "banking malware", category: "BANK_DATA", weight: 8 },
  { term: "online banking", category: "BANK_DATA", weight: 4 },
  { term: "mobile banking", category: "BANK_DATA", weight: 4 },
  { term: "account dump", category: "BANK_DATA", weight: 8 },
  { term: "account balance", category: "BANK_DATA", weight: 5 },
  { term: "routing number", category: "BANK_DATA", weight: 7 },
  { term: "swift code", category: "BANK_DATA", weight: 5 },
  { term: "iban", category: "BANK_DATA", weight: 5 },
  { term: "wire transfer", category: "BANK_DATA", weight: 5 },
  { term: "ach transfer", category: "BANK_DATA", weight: 6 },
  { term: "money transfer", category: "BANK_DATA", weight: 4 },
  { term: "financial data", category: "BANK_DATA", weight: 5 },
  { term: "financial leak", category: "BANK_DATA", weight: 8 },
  { term: "financial breach", category: "BANK_DATA", weight: 8 },
  { term: "cashout", category: "BANK_DATA", weight: 8 },
  { term: "cash out", category: "BANK_DATA", weight: 7 },
  { term: "money mule", category: "BANK_DATA", weight: 8 },
  { term: "bank statement", category: "BANK_DATA", weight: 6 },
  { term: "bank statements", category: "BANK_DATA", weight: 6 },
  { term: "checking account", category: "BANK_DATA", weight: 5 },
  { term: "savings account", category: "BANK_DATA", weight: 5 },
  { term: "atm pin", category: "BANK_DATA", weight: 8 },
  { term: "pin code", category: "BANK_DATA", weight: 5 },
  { term: "otp bypass", category: "BANK_DATA", weight: 8 },
  { term: "2fa bypass", category: "BANK_DATA", weight: 8 },
  { term: "sim swap", category: "BANK_DATA", weight: 8 },
  { term: "sim swapping", category: "BANK_DATA", weight: 8 },
];

// ─── PII (Personally Identifiable Information) ─────────

const PII_KEYWORDS: KeywordEntry[] = [
  { term: "social security number", category: "PII", weight: 8 },
  { term: "ssn", category: "PII", weight: 7 },
  { term: "date of birth", category: "PII", weight: 4 },
  { term: "dob", category: "PII", weight: 4 },
  { term: "driver license", category: "PII", weight: 7 },
  { term: "drivers license", category: "PII", weight: 7 },
  { term: "driving licence", category: "PII", weight: 7 },
  { term: "passport number", category: "PII", weight: 8 },
  { term: "passport scan", category: "PII", weight: 8 },
  { term: "passport photo", category: "PII", weight: 7 },
  { term: "identity card", category: "PII", weight: 6 },
  { term: "national id", category: "PII", weight: 6 },
  { term: "tax id", category: "PII", weight: 6 },
  { term: "tax return", category: "PII", weight: 6 },
  { term: "personal data", category: "PII", weight: 5 },
  { term: "personal information", category: "PII", weight: 5 },
  { term: "pii leak", category: "PII", weight: 9 },
  { term: "pii dump", category: "PII", weight: 9 },
  { term: "identity theft", category: "PII", weight: 7 },
  { term: "identity fraud", category: "PII", weight: 7 },
  { term: "doxxing", category: "PII", weight: 6 },
  { term: "doxxed", category: "PII", weight: 6 },
  { term: "dox", category: "PII", weight: 5 },
  { term: "medical records", category: "PII", weight: 8 },
  { term: "health records", category: "PII", weight: 7 },
  { term: "patient data", category: "PII", weight: 8 },
  { term: "kyc data", category: "PII", weight: 8 },
  { term: "kyc documents", category: "PII", weight: 8 },
  { term: "selfie with id", category: "PII", weight: 9 },
  { term: "utility bill", category: "PII", weight: 5 },
  { term: "proof of address", category: "PII", weight: 5 },
];

// ─── General Threat / Dark Web Marketplace ─────────────

const GENERAL_THREAT_KEYWORDS: KeywordEntry[] = [
  { term: "data breach", category: "GENERAL_THREAT", weight: 7 },
  { term: "data leak", category: "GENERAL_THREAT", weight: 7 },
  { term: "database leak", category: "GENERAL_THREAT", weight: 8 },
  { term: "database dump", category: "GENERAL_THREAT", weight: 8 },
  { term: "db dump", category: "GENERAL_THREAT", weight: 7 },
  { term: "db leak", category: "GENERAL_THREAT", weight: 7 },
  { term: "leaked database", category: "GENERAL_THREAT", weight: 8 },
  { term: "hacked database", category: "GENERAL_THREAT", weight: 8 },
  { term: "sql injection", category: "GENERAL_THREAT", weight: 6 },
  { term: "sqli dump", category: "GENERAL_THREAT", weight: 8 },
  { term: "for sale", category: "GENERAL_THREAT", weight: 3 },
  { term: "selling", category: "GENERAL_THREAT", weight: 2 },
  { term: "buying", category: "GENERAL_THREAT", weight: 2 },
  { term: "free download", category: "GENERAL_THREAT", weight: 3 },
  { term: "free leak", category: "GENERAL_THREAT", weight: 5 },
  { term: "fresh dump", category: "GENERAL_THREAT", weight: 8 },
  { term: "fresh leak", category: "GENERAL_THREAT", weight: 8 },
  { term: "newly leaked", category: "GENERAL_THREAT", weight: 8 },
  { term: "just leaked", category: "GENERAL_THREAT", weight: 7 },
  { term: "exclusive leak", category: "GENERAL_THREAT", weight: 8 },
  { term: "private leak", category: "GENERAL_THREAT", weight: 7 },
  { term: "ransom", category: "GENERAL_THREAT", weight: 6 },
  { term: "ransomware", category: "GENERAL_THREAT", weight: 7 },
  { term: "ransomware victim", category: "GENERAL_THREAT", weight: 8 },
  { term: "extortion", category: "GENERAL_THREAT", weight: 6 },
  { term: "exploit", category: "GENERAL_THREAT", weight: 5 },
  { term: "zero day", category: "GENERAL_THREAT", weight: 7 },
  { term: "0day", category: "GENERAL_THREAT", weight: 7 },
  { term: "vulnerability", category: "GENERAL_THREAT", weight: 4 },
  { term: "backdoor", category: "GENERAL_THREAT", weight: 6 },
  { term: "webshell", category: "GENERAL_THREAT", weight: 7 },
  { term: "initial access", category: "GENERAL_THREAT", weight: 7 },
  { term: "rdp access", category: "GENERAL_THREAT", weight: 8 },
  { term: "vpn access", category: "GENERAL_THREAT", weight: 7 },
  { term: "corporate access", category: "GENERAL_THREAT", weight: 8 },
  { term: "network access", category: "GENERAL_THREAT", weight: 6 },
  { term: "bitcoin", category: "GENERAL_THREAT", weight: 2 },
  { term: "monero", category: "GENERAL_THREAT", weight: 3 },
  { term: "cryptocurrency", category: "GENERAL_THREAT", weight: 2 },
  { term: "escrow", category: "GENERAL_THREAT", weight: 3 },
  { term: "telegram", category: "GENERAL_THREAT", weight: 2 },
  { term: "wickr", category: "GENERAL_THREAT", weight: 3 },
  { term: "jabber", category: "GENERAL_THREAT", weight: 3 },
  { term: "tox id", category: "GENERAL_THREAT", weight: 3 },
];

// ─── Combined Exports ──────────────────────────────────

/**
 * All keywords from every category, combined into a single array.
 */
export const KEYWORDS: KeywordEntry[] = [
  ...CREDIT_CARD_KEYWORDS,
  ...CREDENTIAL_DUMP_KEYWORDS,
  ...BANK_DATA_KEYWORDS,
  ...PII_KEYWORDS,
  ...GENERAL_THREAT_KEYWORDS,
];

/**
 * Keywords organized by category for targeted analysis.
 */
export const KEYWORDS_BY_CATEGORY: Record<KeywordCategory, KeywordEntry[]> = {
  CREDIT_CARD: CREDIT_CARD_KEYWORDS,
  CREDENTIAL_DUMP: CREDENTIAL_DUMP_KEYWORDS,
  BANK_DATA: BANK_DATA_KEYWORDS,
  PII: PII_KEYWORDS,
  GENERAL_THREAT: GENERAL_THREAT_KEYWORDS,
};

/**
 * Only high-severity keywords (weight >= 7).
 * Useful for quick scanning when performance matters.
 */
export const HIGH_SEVERITY_KEYWORDS: KeywordEntry[] = KEYWORDS.filter(
  kw => kw.weight >= 7,
);

/**
 * Total count of all keywords in the dataset.
 */
export const KEYWORD_COUNT = KEYWORDS.length;
