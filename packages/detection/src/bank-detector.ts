/**
 * Bank name detector — scans text content for mentions of banking
 * institutions using the comprehensive bank dataset.
 *
 * Features:
 *   - Word-boundary-aware matching to avoid false positives
 *     (e.g. "Chase" in "chased" won't match)
 *   - Case-insensitive matching
 *   - Matches both full names and aliases
 *   - Deduplicates results (same bank matched by name + alias = 1 finding)
 *   - Reports which specific term triggered the match
 *   - Pre-compiles regex patterns for performance
 *
 * Short aliases (≤ 3 characters like "GS", "DB", "TD") require stricter
 * context — they must appear as standalone uppercase tokens to avoid
 * matching common English words.
 */

import { BANKS, type BankEntry, type BankRegion } from "./data/banks";

// ─── Types ─────────────────────────────────────────────

export interface BankMatch {
  /** The full official bank name */
  bankName: string;
  /** The specific term that triggered the match (could be name or alias) */
  matchedTerm: string;
  /** Geographic region of the bank */
  region: BankRegion;
  /** Number of times this bank was mentioned */
  mentionCount: number;
  /** Character positions of first few matches (for context extraction) */
  positions: number[];
}

export interface BankDetectionResult {
  /** List of detected bank mentions */
  matches: BankMatch[];
  /** Total number of unique banks detected */
  uniqueBankCount: number;
  /** Total number of bank mentions across all banks */
  totalMentions: number;
  /** Which regions had matches */
  regionsAffected: BankRegion[];
}

// ─── Pre-compiled patterns ─────────────────────────────

/**
 * Minimum alias length for standard word-boundary matching.
 * Shorter aliases use stricter uppercase-only matching to
 * avoid false positives (e.g. "TD" matching "LTD").
 */
const SHORT_ALIAS_THRESHOLD = 4;

/**
 * Maximum number of match positions to store per bank.
 * We don't need every position — just enough for context extraction.
 */
const MAX_POSITIONS = 5;

interface CompiledBankPattern {
  bank: BankEntry;
  term: string;
  regex: RegExp;
}

/**
 * Pre-compile all bank name and alias patterns into RegExp objects.
 * This is done once at module load time for performance.
 *
 * For short aliases (≤ 3 chars), we require:
 *   - The match to be uppercase in the original text
 *   - Surrounded by word boundaries
 *
 * For longer terms, we use case-insensitive word-boundary matching.
 */
function compilePatterns(banks: BankEntry[]): CompiledBankPattern[] {
  const patterns: CompiledBankPattern[] = [];

  for (const bank of banks) {
    const allTerms = [bank.name, ...bank.aliases];

    for (const term of allTerms) {
      const escaped = escapeRegex(term);

      if (term.length < SHORT_ALIAS_THRESHOLD) {
        // Short alias: case-sensitive, must be uppercase, strict boundaries
        // Use a lookahead/lookbehind-free approach with \b for broad compat
        patterns.push({
          bank,
          term,
          regex: new RegExp(`\\b${escaped}\\b`, "g"),
        });
      } else {
        // Standard: case-insensitive word-boundary match
        patterns.push({
          bank,
          term,
          regex: new RegExp(`\\b${escaped}\\b`, "gi"),
        });
      }
    }
  }

  return patterns;
}

/**
 * Escape special regex characters in a string so it can be used
 * as a literal match inside a RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compile all patterns once at module load
const COMPILED_PATTERNS = compilePatterns(BANKS);

// ─── Detection Functions ───────────────────────────────

/**
 * Scan text content for mentions of banking institutions.
 *
 * @param content - The text to scan (typically scraped page content)
 * @returns Detection result with all bank matches and summary stats
 */
export function detectBanks(content: string): BankDetectionResult {
  if (!content || content.trim().length === 0) {
    return {
      matches: [],
      uniqueBankCount: 0,
      totalMentions: 0,
      regionsAffected: [],
    };
  }

  // Map from bank name → accumulated match data
  const bankMatches = new Map<
    string,
    {
      bank: BankEntry;
      matchedTerm: string;
      bestTermLength: number;
      positions: number[];
      mentionCount: number;
    }
  >();

  for (const pattern of COMPILED_PATTERNS) {
    // Reset regex state (global regexes are stateful)
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let count = 0;
    const positions: number[] = [];

    for (const match of content.matchAll(regex)) {
      // For short aliases, verify the matched text is actually uppercase
      // in the original content (avoid "td" in "ltd" matching "TD Bank")
      if (pattern.term.length < SHORT_ALIAS_THRESHOLD) {
        const actualText = content.slice(
          match.index,
          (match.index ?? 0) + match[0].length,
        );
        if (actualText !== pattern.term) {
          continue;
        }
      }

      count++;
      if (positions.length < MAX_POSITIONS && match.index !== undefined) {
        positions.push(match.index);
      }
    }

    if (count === 0) continue;

    const bankName = pattern.bank.name;
    const existing = bankMatches.get(bankName);

    if (existing) {
      // Accumulate mentions and positions
      existing.mentionCount += count;
      for (const pos of positions) {
        if (existing.positions.length < MAX_POSITIONS) {
          existing.positions.push(pos);
        }
      }
      // Prefer the longest matched term as the "best" match
      // (e.g. "JPMorgan Chase" is more specific than "Chase")
      if (pattern.term.length > existing.bestTermLength) {
        existing.matchedTerm = pattern.term;
        existing.bestTermLength = pattern.term.length;
      }
    } else {
      bankMatches.set(bankName, {
        bank: pattern.bank,
        matchedTerm: pattern.term,
        bestTermLength: pattern.term.length,
        positions,
        mentionCount: count,
      });
    }
  }

  // Convert map to sorted result array
  const matches: BankMatch[] = Array.from(bankMatches.values())
    .map(entry => ({
      bankName: entry.bank.name,
      matchedTerm: entry.matchedTerm,
      region: entry.bank.region,
      mentionCount: entry.mentionCount,
      positions: entry.positions.sort((a, b) => a - b),
    }))
    // Sort by mention count descending (most-mentioned banks first)
    .sort((a, b) => b.mentionCount - a.mentionCount);

  // Collect affected regions (deduplicated)
  const regionsAffected = Array.from(new Set(matches.map(m => m.region)));

  const totalMentions = matches.reduce((sum, m) => sum + m.mentionCount, 0);

  return {
    matches,
    uniqueBankCount: matches.length,
    totalMentions,
    regionsAffected,
  };
}

/**
 * Quick check: does the content mention any banks at all?
 * Faster than full detectBanks() when you only need a boolean.
 *
 * Stops at the first match found.
 */
export function containsBankMention(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  for (const pattern of COMPILED_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    const match = regex.exec(content);

    if (match) {
      // For short aliases, verify uppercase
      if (pattern.term.length < SHORT_ALIAS_THRESHOLD) {
        const actualText = content.slice(
          match.index,
          match.index + match[0].length,
        );
        if (actualText !== pattern.term) {
          continue;
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Extract a context snippet around a match position.
 * Useful for showing analysts what surrounded a bank mention.
 *
 * @param content - The full text content
 * @param position - Character offset of the match
 * @param radius - Number of characters to include before/after
 * @returns A trimmed context string with "..." markers if truncated
 */
export function extractContext(
  content: string,
  position: number,
  radius = 100,
): string {
  const start = Math.max(0, position - radius);
  const end = Math.min(content.length, position + radius);

  let snippet = content.slice(start, end).trim();

  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, " ");

  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < content.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}
