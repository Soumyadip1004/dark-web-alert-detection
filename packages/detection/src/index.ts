/**
 * @dark-web-alert-detection/detection
 *
 * Main entry point for the leak detection engine.
 *
 * This module orchestrates the full analysis pipeline:
 *
 *   1. **Bank Detection** — Identifies mentions of banking institutions
 *   2. **Keyword Scanning** — Finds threat-intelligence keywords
 *   3. **Pattern Matching** — Detects credit cards, credentials, IBANs, SSNs, etc.
 *   4. **Risk Scoring** — Combines all findings into a composite risk score
 *
 * Usage:
 *
 *   import { analyzeContent } from "@dark-web-alert-detection/detection";
 *
 *   const result = analyzeContent("50k credit card records from HSBC leaked...");
 *
 *   if (result.shouldAlert) {
 *     console.log(result.riskLevel);  // "CRITICAL"
 *     console.log(result.summary);    // human-readable summary
 *     console.log(result.alerts);     // alert records ready for DB insertion
 *   }
 */

import {
  type BankDetectionResult,
  type BankMatch,
  containsBankMention,
  detectBanks,
  extractContext,
} from "./bank-detector";

import {
  containsHighSeverityKeyword,
  detectKeywords,
  type KeywordDetectionResult,
} from "./keyword-detector";

import {
  ALL_PATTERNS,
  HIGH_PRIORITY_PATTERNS,
  type PatternMatch,
  runPatterns,
} from "./patterns";

import {
  calculateRiskScore,
  quickRiskCheck,
  type RiskLevel,
  type RiskScoreResult,
  type RiskScorerConfig,
} from "./risk-scorer";

// ─── Public Types ──────────────────────────────────────

/**
 * A single alert record ready for database insertion.
 * Each alert corresponds to one leak-type finding from the analysis.
 */
export interface AlertRecord {
  /** Detected bank name (null if the finding isn't bank-specific) */
  bankName: string | null;
  /** Type of leak detected */
  leakType: LeakType;
  /** Risk level for this specific alert */
  riskLevel: RiskLevel;
  /** Human-readable summary of what triggered this alert */
  matchedData: string;
}

export type LeakType =
  | "CREDIT_CARD"
  | "CREDENTIAL_DUMP"
  | "BANK_DATA"
  | "PII"
  | "OTHER";

/**
 * Complete result of analyzing a piece of content.
 */
export interface AnalysisResult {
  /** Whether this content warrants generating alerts */
  shouldAlert: boolean;
  /** Overall risk level (the highest across all findings) */
  riskLevel: RiskLevel;
  /** Composite risk score (0–100) */
  compositeScore: number;
  /** Human-readable summary of the full analysis */
  summary: string;
  /** Alert records ready for database insertion */
  alerts: AlertRecord[];
  /** Detailed results from each detection stage */
  details: {
    banks: BankDetectionResult;
    keywords: KeywordDetectionResult;
    patterns: PatternMatch[];
    riskScore: RiskScoreResult;
  };
  /** Performance: how long the analysis took in milliseconds */
  analysisTimeMs: number;
}

/**
 * Options for the analysis pipeline.
 */
export interface AnalysisOptions {
  /**
   * Minimum risk level required to generate alerts.
   * Content scoring below this level will have `shouldAlert: false`.
   * Default: "LOW" (all findings generate alerts)
   */
  minAlertLevel: RiskLevel;

  /**
   * Whether to run the quick pre-filter before full analysis.
   * When true, content that fails the quick check is skipped entirely.
   * Improves performance on high-volume pipelines but may miss edge cases.
   * Default: false
   */
  useQuickFilter: boolean;

  /**
   * Whether to use only high-priority patterns (weight >= 7) instead
   * of the full pattern set. Faster but less comprehensive.
   * Default: false
   */
  highPriorityPatternsOnly: boolean;

  /**
   * Custom risk scorer configuration overrides.
   */
  riskScorerConfig: Partial<RiskScorerConfig>;

  /**
   * Maximum number of alert records to generate per analysis.
   * Prevents alert storms from very noisy content.
   * Default: 20
   */
  maxAlertsPerAnalysis: number;
}

const DEFAULT_OPTIONS: AnalysisOptions = {
  minAlertLevel: "LOW",
  useQuickFilter: false,
  highPriorityPatternsOnly: false,
  riskScorerConfig: {},
  maxAlertsPerAnalysis: 20,
};

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// ─── Main Analysis Function ────────────────────────────

/**
 * Analyze text content for leaked banking data and generate alerts.
 *
 * This is the primary entry point for the detection engine. It runs the
 * full analysis pipeline and returns a complete result with alerts
 * ready for database insertion.
 *
 * @param content - The text content to analyze (typically from a scraped post)
 * @param options - Optional configuration overrides
 * @returns Complete analysis result with alerts, scores, and details
 *
 * @example
 * ```ts
 * const result = analyzeContent(post.content);
 *
 * if (result.shouldAlert) {
 *   for (const alert of result.alerts) {
 *     await prisma.alert.create({
 *       data: {
 *         postId: post.id,
 *         bankName: alert.bankName,
 *         leakType: alert.leakType,
 *         riskLevel: alert.riskLevel,
 *         matchedData: alert.matchedData,
 *       },
 *     });
 *   }
 * }
 * ```
 */
export function analyzeContent(
  content: string,
  options: Partial<AnalysisOptions> = {},
): AnalysisResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Empty / very short content — nothing to analyze
  if (!content || content.trim().length < 10) {
    return createEmptyResult(startTime);
  }

  // ── Stage 1: Bank Detection ────────────────────────────
  const bankResult = detectBanks(content);

  // ── Stage 2: Keyword Detection ─────────────────────────
  const keywordResult = detectKeywords(content);

  // ── Stage 3: Pattern Matching ──────────────────────────
  const patterns = opts.highPriorityPatternsOnly
    ? HIGH_PRIORITY_PATTERNS
    : ALL_PATTERNS;
  const patternMatches = runPatterns(patterns, content);

  // ── Optional Quick Filter ──────────────────────────────
  if (opts.useQuickFilter) {
    const passesQuickCheck = quickRiskCheck(
      bankResult,
      keywordResult,
      patternMatches,
    );

    if (!passesQuickCheck) {
      return createFilteredResult(
        bankResult,
        keywordResult,
        patternMatches,
        startTime,
      );
    }
  }

  // ── Stage 4: Risk Scoring ──────────────────────────────
  const riskScore = calculateRiskScore(
    bankResult,
    keywordResult,
    patternMatches,
    opts.riskScorerConfig,
  );

  // ── Stage 5: Alert Generation ──────────────────────────
  const alerts = generateAlerts(
    bankResult,
    keywordResult,
    patternMatches,
    riskScore,
    content,
    opts.maxAlertsPerAnalysis,
  );

  // ── Determine if we should alert ───────────────────────
  const meetsThreshold =
    RISK_LEVEL_ORDER[riskScore.riskLevel] >=
    RISK_LEVEL_ORDER[opts.minAlertLevel];

  const shouldAlert = meetsThreshold && alerts.length > 0;

  const analysisTimeMs =
    Math.round((performance.now() - startTime) * 100) / 100;

  return {
    shouldAlert,
    riskLevel: riskScore.riskLevel,
    compositeScore: riskScore.compositeScore,
    summary: riskScore.summary,
    alerts: shouldAlert ? alerts : [],
    details: {
      banks: bankResult,
      keywords: keywordResult,
      patterns: patternMatches,
      riskScore,
    },
    analysisTimeMs,
  };
}

// ─── Quick Analysis ────────────────────────────────────

/**
 * Perform a fast pre-screening of content without generating full alerts.
 * Useful for deciding whether to run the full pipeline.
 *
 * @param content - The text to screen
 * @returns true if the content likely contains leaked banking data
 */
export function quickScreen(content: string): boolean {
  if (!content || content.trim().length < 10) {
    return false;
  }

  // Fast checks — bail early if any pass
  if (containsHighSeverityKeyword(content, 8)) {
    return true;
  }

  if (containsBankMention(content)) {
    // Bank mentioned — check if there's also something suspicious
    if (containsHighSeverityKeyword(content, 6)) {
      return true;
    }
  }

  // Check for high-priority patterns (credit cards, credentials)
  const highPriorityMatches = runPatterns(HIGH_PRIORITY_PATTERNS, content);
  if (highPriorityMatches.length > 0) {
    return true;
  }

  return false;
}

// ─── Alert Generation ──────────────────────────────────

/**
 * Generate alert records from the combined detection results.
 *
 * Alert generation strategy:
 *   1. If specific banks are detected, create per-bank alerts with the
 *      most relevant leak type for each bank
 *   2. For non-bank-specific findings (e.g. generic credential dump),
 *      create standalone alerts per leak type
 *   3. Deduplicate and cap the total number of alerts
 */
function generateAlerts(
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
  riskScore: RiskScoreResult,
  content: string,
  maxAlerts: number,
): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const overallRiskLevel = riskScore.riskLevel;

  // ── Bank-specific alerts ───────────────────────────────
  // For each detected bank, determine the most relevant leak type
  // and create an alert that ties the bank to the finding.
  if (bankResult.uniqueBankCount > 0) {
    const primaryLeakType = determinePrimaryLeakType(
      keywordResult,
      patternMatches,
    );

    for (const bankMatch of bankResult.matches) {
      if (alerts.length >= maxAlerts) break;

      // Build context from the bank mention's position
      const contextSnippet =
        bankMatch.positions.length > 0
          ? extractContext(content, bankMatch.positions[0] ?? 0, 120)
          : "";

      const matchedData = buildBankAlertSummary(
        bankMatch,
        primaryLeakType,
        keywordResult,
        patternMatches,
        contextSnippet,
      );

      alerts.push({
        bankName: bankMatch.bankName,
        leakType: primaryLeakType,
        riskLevel: overallRiskLevel,
        matchedData,
      });
    }
  }

  // ── Pattern-based alerts (non-bank-specific) ───────────
  // Group patterns by category and create one alert per category
  const patternCategories = groupPatternsByCategory(patternMatches);

  for (const [category, categoryPatterns] of patternCategories) {
    if (alerts.length >= maxAlerts) break;

    // Skip if we already have a bank alert covering this category
    const leakType = mapPatternCategoryToLeakType(category);
    const alreadyCovered = alerts.some(
      a => a.leakType === leakType && a.bankName !== null,
    );
    if (alreadyCovered) continue;

    const totalMatches = categoryPatterns.reduce(
      (sum, p) => sum + p.matchCount,
      0,
    );
    const topPattern = categoryPatterns.sort(
      (a, b) => b.weight * b.matchCount - a.weight * a.matchCount,
    )[0];

    if (!topPattern) continue;

    const matchedData =
      `Pattern: ${topPattern.patternName} (${totalMatches} match${totalMatches === 1 ? "" : "es"})` +
      (topPattern.samples.length > 0
        ? ` | Samples: ${topPattern.samples.slice(0, 3).join(", ")}`
        : "") +
      ` | Category: ${category}`;

    alerts.push({
      bankName: null,
      leakType,
      riskLevel: overallRiskLevel,
      matchedData,
    });
  }

  // ── Keyword-only alerts ────────────────────────────────
  // If no patterns or banks were found, but high-severity keywords exist,
  // create alerts for the top keyword categories
  if (alerts.length === 0 && keywordResult.peakWeight >= 7) {
    for (const categoryGroup of keywordResult.categories) {
      if (alerts.length >= maxAlerts) break;
      if (categoryGroup.maxWeight < 7) continue;

      const leakType = mapKeywordCategoryToLeakType(categoryGroup.category);
      const topKeywords = categoryGroup.matches
        .slice(0, 5)
        .map(m => `"${m.term}" (w=${m.weight}, ×${m.matchCount})`)
        .join(", ");

      alerts.push({
        bankName: null,
        leakType,
        riskLevel: overallRiskLevel,
        matchedData:
          `Keywords: ${topKeywords}` +
          ` | Category: ${categoryGroup.category}` +
          ` | Weighted score: ${categoryGroup.weightedScore}`,
      });
    }
  }

  // Sort alerts by risk level descending, then by specificity (bank alerts first)
  alerts.sort((a, b) => {
    const levelDiff =
      RISK_LEVEL_ORDER[b.riskLevel] - RISK_LEVEL_ORDER[a.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    // Prefer bank-specific alerts
    if (a.bankName && !b.bankName) return -1;
    if (!a.bankName && b.bankName) return 1;
    return 0;
  });

  return alerts.slice(0, maxAlerts);
}

// ─── Helper Functions ──────────────────────────────────

/**
 * Determine the primary leak type based on keyword and pattern findings.
 * Used when creating bank-specific alerts to pick the most relevant type.
 */
function determinePrimaryLeakType(
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
): LeakType {
  // Score each leak type based on findings
  const scores: Record<LeakType, number> = {
    CREDIT_CARD: 0,
    CREDENTIAL_DUMP: 0,
    BANK_DATA: 0,
    PII: 0,
    OTHER: 0,
  };

  // Contribution from patterns
  for (const match of patternMatches) {
    const leakType = mapPatternCategoryToLeakType(match.category);
    scores[leakType] += match.weight * Math.log2(match.matchCount + 1);
  }

  // Contribution from keywords
  for (const match of keywordResult.matches) {
    const leakType = mapKeywordCategoryToLeakType(match.category);
    scores[leakType] += match.weight * Math.log2(match.matchCount + 1) * 0.5;
  }

  // Find the highest-scoring leak type
  let bestType: LeakType = "OTHER";
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores) as [LeakType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Default to BANK_DATA if nothing else stands out but banks were mentioned
  if (bestScore === 0) {
    return "BANK_DATA";
  }

  return bestType;
}

/**
 * Build a human-readable summary for a bank-specific alert.
 */
function buildBankAlertSummary(
  bankMatch: BankMatch,
  leakType: LeakType,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
  contextSnippet: string,
): string {
  const parts: string[] = [];

  parts.push(
    `Bank: ${bankMatch.bankName} (matched via "${bankMatch.matchedTerm}", ${bankMatch.mentionCount} mention${bankMatch.mentionCount === 1 ? "" : "s"})`,
  );

  parts.push(`Leak type: ${leakType}`);

  // Top keywords relevant to this leak type
  const relevantKeywords = keywordResult.matches
    .filter(m => {
      const kwLeakType = mapKeywordCategoryToLeakType(m.category);
      return kwLeakType === leakType || m.weight >= 8;
    })
    .slice(0, 3);

  if (relevantKeywords.length > 0) {
    const kwStr = relevantKeywords
      .map(m => `"${m.term}" (w=${m.weight})`)
      .join(", ");
    parts.push(`Keywords: ${kwStr}`);
  }

  // Top patterns relevant to this leak type
  const relevantPatterns = patternMatches
    .filter(m => mapPatternCategoryToLeakType(m.category) === leakType)
    .slice(0, 2);

  if (relevantPatterns.length > 0) {
    const patStr = relevantPatterns
      .map(m => `${m.patternName}: ${m.matchCount}`)
      .join(", ");
    parts.push(`Patterns: ${patStr}`);
  }

  if (contextSnippet.length > 0) {
    // Truncate context to keep alert data manageable
    const truncated =
      contextSnippet.length > 200
        ? `${contextSnippet.slice(0, 200)}...`
        : contextSnippet;
    parts.push(`Context: "${truncated}"`);
  }

  return parts.join(" | ");
}

/**
 * Group pattern matches by their category.
 */
function groupPatternsByCategory(
  matches: PatternMatch[],
): Map<string, PatternMatch[]> {
  const groups = new Map<string, PatternMatch[]>();

  for (const match of matches) {
    const existing = groups.get(match.category);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(match.category, [match]);
    }
  }

  return groups;
}

/**
 * Map a regex pattern category to a LeakType for alert generation.
 */
function mapPatternCategoryToLeakType(category: string): LeakType {
  switch (category) {
    case "CREDIT_CARD":
      return "CREDIT_CARD";
    case "CREDENTIAL_DUMP":
      return "CREDENTIAL_DUMP";
    case "BANK_DATA":
      return "BANK_DATA";
    case "PII":
      return "PII";
    default:
      return "OTHER";
  }
}

/**
 * Map a keyword category to a LeakType for alert generation.
 */
function mapKeywordCategoryToLeakType(category: string): LeakType {
  switch (category) {
    case "CREDIT_CARD":
      return "CREDIT_CARD";
    case "CREDENTIAL_DUMP":
      return "CREDENTIAL_DUMP";
    case "BANK_DATA":
      return "BANK_DATA";
    case "PII":
      return "PII";
    case "GENERAL_THREAT":
      return "OTHER";
    default:
      return "OTHER";
  }
}

/**
 * Create an empty result for content that's too short to analyze.
 */
function createEmptyResult(startTime: number): AnalysisResult {
  const analysisTimeMs =
    Math.round((performance.now() - startTime) * 100) / 100;

  return {
    shouldAlert: false,
    riskLevel: "LOW",
    compositeScore: 0,
    summary: "Content too short for analysis",
    alerts: [],
    details: {
      banks: {
        matches: [],
        uniqueBankCount: 0,
        totalMentions: 0,
        regionsAffected: [],
      },
      keywords: {
        matches: [],
        categories: [],
        uniqueKeywordCount: 0,
        totalOccurrences: 0,
        totalWeightedScore: 0,
        peakWeight: 0,
        matchedCategories: [],
      },
      patterns: [],
      riskScore: {
        compositeScore: 0,
        riskLevel: "LOW",
        components: {
          bank: {
            rawScore: 0,
            weight: 0.3,
            weightedScore: 0,
            explanation: "No content to analyze",
          },
          keyword: {
            rawScore: 0,
            weight: 0.4,
            weightedScore: 0,
            explanation: "No content to analyze",
          },
          pattern: {
            rawScore: 0,
            weight: 0.3,
            weightedScore: 0,
            explanation: "No content to analyze",
          },
        },
        amplifications: [],
        summary: "No content to analyze",
      },
    },
    analysisTimeMs,
  };
}

/**
 * Create a result for content that was filtered out by the quick check.
 * Still includes detection details for transparency, but won't alert.
 */
function createFilteredResult(
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
  startTime: number,
): AnalysisResult {
  const analysisTimeMs =
    Math.round((performance.now() - startTime) * 100) / 100;

  return {
    shouldAlert: false,
    riskLevel: "LOW",
    compositeScore: 0,
    summary: "Filtered out by quick risk check — no significant findings",
    alerts: [],
    details: {
      banks: bankResult,
      keywords: keywordResult,
      patterns: patternMatches,
      riskScore: {
        compositeScore: 0,
        riskLevel: "LOW",
        components: {
          bank: {
            rawScore: 0,
            weight: 0.3,
            weightedScore: 0,
            explanation: "Skipped (quick filter)",
          },
          keyword: {
            rawScore: 0,
            weight: 0.4,
            weightedScore: 0,
            explanation: "Skipped (quick filter)",
          },
          pattern: {
            rawScore: 0,
            weight: 0.3,
            weightedScore: 0,
            explanation: "Skipped (quick filter)",
          },
        },
        amplifications: [],
        summary: "Skipped (quick filter)",
      },
    },
    analysisTimeMs,
  };
}

// ─── Re-exports ────────────────────────────────────────
// Re-export everything so consumers only need to import from the package root

export {
  type BankDetectionResult,
  type BankMatch,
  containsBankMention,
  // Bank detector
  detectBanks,
  extractContext,
} from "./bank-detector";
export {
  BANK_COUNT,
  // Data exports
  BANKS,
  BANKS_BY_REGION,
  type BankEntry,
  type BankRegion,
  getAllBankIdentifiers,
} from "./data/banks";
export {
  HIGH_SEVERITY_KEYWORDS,
  KEYWORD_COUNT,
  KEYWORDS,
  KEYWORDS_BY_CATEGORY,
  type KeywordCategory,
  type KeywordEntry,
} from "./data/keywords";
export {
  containsHighSeverityKeyword,
  // Keyword detector
  detectKeywords,
  type KeywordCategoryGroup,
  type KeywordDetectionResult,
  type KeywordMatch,
  summarizeKeywordResult,
} from "./keyword-detector";
export {
  ALL_PATTERNS,
  BANK_DATA_PATTERNS,
  CREDENTIAL_PATTERNS,
  CREDIT_CARD_PATTERNS,
  CRYPTO_PATTERNS,
  HIGH_PRIORITY_PATTERNS,
  PATTERNS_BY_CATEGORY,
  type PatternCategory,
  type PatternEntry,
  type PatternMatch,
  PII_PATTERNS,
  runPattern,
  // Pattern matcher
  runPatterns,
} from "./patterns";
export {
  type AmplificationResult,
  type ComponentScore,
  // Risk scorer
  calculateRiskScore,
  quickRiskCheck,
  type RiskLevel,
  type RiskScoreResult,
  type RiskScorerConfig,
  riskLevelColor,
  riskLevelPriority,
} from "./risk-scorer";
