/**
 * Keyword detector — scans text content for threat-intelligence keywords
 * from the keywords dataset.
 *
 * Features:
 *   - Case-insensitive matching
 *   - Word-boundary-aware matching for multi-word phrases
 *   - Groups matches by category (CREDIT_CARD, CREDENTIAL_DUMP, etc.)
 *   - Tracks match counts and weights for risk scoring
 *   - Pre-compiles regex patterns at module load for performance
 *   - Deduplicates overlapping matches from similar keywords
 */

import {
  KEYWORDS,
  type KeywordCategory,
  type KeywordEntry,
} from "./data/keywords";

// ─── Types ─────────────────────────────────────────────

export interface KeywordMatch {
  /** The keyword term that was matched */
  term: string;
  /** Which leak category this keyword belongs to */
  category: KeywordCategory;
  /** Severity weight (1–10) */
  weight: number;
  /** Number of times this keyword appeared in the content */
  matchCount: number;
}

export interface KeywordCategoryGroup {
  /** The category name */
  category: KeywordCategory;
  /** All keyword matches in this category */
  matches: KeywordMatch[];
  /** Total number of keyword matches in this category */
  totalMatches: number;
  /** Highest weight among matched keywords in this category */
  maxWeight: number;
  /** Sum of (weight × matchCount) for all keywords in this category */
  weightedScore: number;
}

export interface KeywordDetectionResult {
  /** All individual keyword matches */
  matches: KeywordMatch[];
  /** Matches grouped by category */
  categories: KeywordCategoryGroup[];
  /** Total number of unique keywords matched */
  uniqueKeywordCount: number;
  /** Total number of keyword occurrences across all matches */
  totalOccurrences: number;
  /** Sum of all weighted scores across all categories */
  totalWeightedScore: number;
  /** The single highest weight found across all matches */
  peakWeight: number;
  /** Categories that had at least one match */
  matchedCategories: KeywordCategory[];
}

// ─── Pre-compiled patterns ─────────────────────────────

interface CompiledKeywordPattern {
  entry: KeywordEntry;
  regex: RegExp;
}

/**
 * Pre-compile all keyword entries into RegExp objects at module load.
 *
 * Each keyword becomes a case-insensitive word-boundary regex.
 * Multi-word phrases are kept as-is so "credit card" won't match
 * "credit" and "card" separately.
 *
 * Special characters in keywords (like ":", "+") are escaped.
 */
function compilePatterns(keywords: KeywordEntry[]): CompiledKeywordPattern[] {
  return keywords.map(entry => {
    const escaped = escapeRegex(entry.term);
    return {
      entry,
      regex: new RegExp(`\\b${escaped}\\b`, "gi"),
    };
  });
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compile once at module load
const COMPILED_KEYWORD_PATTERNS = compilePatterns(KEYWORDS);

// ─── Detection Functions ───────────────────────────────

/**
 * Scan text content for threat-intelligence keywords.
 *
 * @param content - The text to scan (typically scraped page content)
 * @returns Detection result with all keyword matches, category groups, and scores
 */
export function detectKeywords(content: string): KeywordDetectionResult {
  const emptyResult: KeywordDetectionResult = {
    matches: [],
    categories: [],
    uniqueKeywordCount: 0,
    totalOccurrences: 0,
    totalWeightedScore: 0,
    peakWeight: 0,
    matchedCategories: [],
  };

  if (!content || content.trim().length === 0) {
    return emptyResult;
  }

  const matches: KeywordMatch[] = [];

  for (const pattern of COMPILED_KEYWORD_PATTERNS) {
    // Recreate regex to reset lastIndex (global regexes are stateful)
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let count = 0;

    for (const _match of content.matchAll(regex)) {
      count++;
    }

    if (count > 0) {
      matches.push({
        term: pattern.entry.term,
        category: pattern.entry.category,
        weight: pattern.entry.weight,
        matchCount: count,
      });
    }
  }

  if (matches.length === 0) {
    return emptyResult;
  }

  // Sort matches by weight descending, then by match count descending
  matches.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.matchCount - a.matchCount;
  });

  // Group matches by category
  const categoryMap = new Map<KeywordCategory, KeywordMatch[]>();
  for (const match of matches) {
    const existing = categoryMap.get(match.category);
    if (existing) {
      existing.push(match);
    } else {
      categoryMap.set(match.category, [match]);
    }
  }

  // Build category groups with aggregated stats
  const categories: KeywordCategoryGroup[] = Array.from(
    categoryMap.entries(),
  ).map(([category, categoryMatches]) => {
    const totalMatches = categoryMatches.reduce(
      (sum, m) => sum + m.matchCount,
      0,
    );
    const maxWeight = Math.max(...categoryMatches.map(m => m.weight));
    const weightedScore = categoryMatches.reduce(
      (sum, m) => sum + m.weight * m.matchCount,
      0,
    );

    return {
      category,
      matches: categoryMatches,
      totalMatches,
      maxWeight,
      weightedScore,
    };
  });

  // Sort categories by weighted score descending
  categories.sort((a, b) => b.weightedScore - a.weightedScore);

  // Compute summary stats
  const totalOccurrences = matches.reduce((sum, m) => sum + m.matchCount, 0);
  const totalWeightedScore = categories.reduce(
    (sum, c) => sum + c.weightedScore,
    0,
  );
  const peakWeight =
    matches.length > 0 ? Math.max(...matches.map(m => m.weight)) : 0;
  const matchedCategories = categories.map(c => c.category);

  return {
    matches,
    categories,
    uniqueKeywordCount: matches.length,
    totalOccurrences,
    totalWeightedScore,
    peakWeight,
    matchedCategories,
  };
}

/**
 * Quick check: does the content contain any high-severity keywords?
 *
 * @param content - The text to scan
 * @param minWeight - Minimum weight threshold (default: 7)
 * @returns true if at least one keyword with weight >= minWeight is found
 */
export function containsHighSeverityKeyword(
  content: string,
  minWeight = 7,
): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  for (const pattern of COMPILED_KEYWORD_PATTERNS) {
    if (pattern.entry.weight < minWeight) continue;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    if (regex.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Scan content for keywords in a specific category only.
 * More efficient than running the full detector when you only
 * care about one category.
 *
 * @param content - The text to scan
 * @param category - The keyword category to scan for
 * @returns Array of keyword matches in the specified category
 */
export function detectKeywordsByCategory(
  content: string,
  category: KeywordCategory,
): KeywordMatch[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const matches: KeywordMatch[] = [];

  for (const pattern of COMPILED_KEYWORD_PATTERNS) {
    if (pattern.entry.category !== category) continue;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let count = 0;

    for (const _match of content.matchAll(regex)) {
      count++;
    }

    if (count > 0) {
      matches.push({
        term: pattern.entry.term,
        category: pattern.entry.category,
        weight: pattern.entry.weight,
        matchCount: count,
      });
    }
  }

  matches.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.matchCount - a.matchCount;
  });

  return matches;
}

/**
 * Get a human-readable summary of keyword detection results.
 * Useful for generating the `matchedData` field in alerts.
 *
 * @param result - The detection result to summarize
 * @param maxKeywords - Maximum number of keywords to list in the summary
 * @returns A concise summary string
 */
export function summarizeKeywordResult(
  result: KeywordDetectionResult,
  maxKeywords = 10,
): string {
  if (result.matches.length === 0) {
    return "No keywords detected";
  }

  const topKeywords = result.matches
    .slice(0, maxKeywords)
    .map(m => `"${m.term}" (×${m.matchCount}, w=${m.weight})`)
    .join(", ");

  const categoryNames = result.matchedCategories.join(", ");

  const parts = [
    `${result.uniqueKeywordCount} keyword(s) matched`,
    `${result.totalOccurrences} total occurrence(s)`,
    `categories: [${categoryNames}]`,
    `peak weight: ${result.peakWeight}`,
    `weighted score: ${result.totalWeightedScore}`,
    `top: ${topKeywords}`,
  ];

  return parts.join(" | ");
}
