/**
 * Risk scoring engine — combines findings from the bank detector,
 * keyword detector, and regex pattern matcher into a final risk level.
 *
 * The scoring algorithm works in three stages:
 *
 *   1. **Component Scores**: Each detector type produces a weighted score
 *      based on the number and severity of its findings.
 *
 *   2. **Composite Score**: Component scores are combined with configurable
 *      weights into a single 0–100 composite score.
 *
 *   3. **Risk Level**: The composite score is mapped to a discrete risk
 *      level (LOW, MEDIUM, HIGH, CRITICAL) using configurable thresholds.
 *
 * The algorithm also applies **amplification rules** — certain combinations
 * of findings (e.g. bank name + credit card pattern + "fullz" keyword)
 * produce a multiplicative boost to the final score.
 */

import type { BankDetectionResult } from "./bank-detector";
import type { KeywordDetectionResult } from "./keyword-detector";
import type { PatternMatch } from "./patterns";

// ─── Types ─────────────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskScoreResult {
  /** Final composite score from 0–100 */
  compositeScore: number;
  /** Discrete risk level derived from the composite score */
  riskLevel: RiskLevel;
  /** Individual component scores that fed into the composite */
  components: {
    bank: ComponentScore;
    keyword: ComponentScore;
    pattern: ComponentScore;
  };
  /** Amplification rules that fired, if any */
  amplifications: AmplificationResult[];
  /** Human-readable summary of the risk assessment */
  summary: string;
}

export interface ComponentScore {
  /** Raw score before weighting (0–100 scale) */
  rawScore: number;
  /** Weight applied to this component (0–1) */
  weight: number;
  /** Weighted contribution to the composite score */
  weightedScore: number;
  /** Brief explanation of how the score was derived */
  explanation: string;
}

export interface AmplificationResult {
  /** Name of the amplification rule */
  rule: string;
  /** Multiplier applied (e.g. 1.5 = 50% boost) */
  multiplier: number;
  /** Why this rule fired */
  reason: string;
}

// ─── Configuration ─────────────────────────────────────

export interface RiskScorerConfig {
  /** Weight for bank detection component (0–1, default: 0.30) */
  bankWeight: number;
  /** Weight for keyword detection component (0–1, default: 0.40) */
  keywordWeight: number;
  /** Weight for pattern detection component (0–1, default: 0.30) */
  patternWeight: number;
  /** Threshold for LOW → MEDIUM transition (default: 20) */
  mediumThreshold: number;
  /** Threshold for MEDIUM → HIGH transition (default: 45) */
  highThreshold: number;
  /** Threshold for HIGH → CRITICAL transition (default: 70) */
  criticalThreshold: number;
  /** Maximum composite score (capped, default: 100) */
  maxScore: number;
}

const DEFAULT_CONFIG: RiskScorerConfig = {
  bankWeight: 0.3,
  keywordWeight: 0.4,
  patternWeight: 0.3,
  mediumThreshold: 20,
  highThreshold: 45,
  criticalThreshold: 70,
  maxScore: 100,
};

// ─── Main Scoring Function ─────────────────────────────

/**
 * Calculate a risk score from the combined results of all three detectors.
 *
 * @param bankResult - Result from detectBanks()
 * @param keywordResult - Result from detectKeywords()
 * @param patternMatches - Array of PatternMatch from runPatterns()
 * @param config - Optional custom scoring configuration
 * @returns Complete risk score with breakdown and explanations
 */
export function calculateRiskScore(
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
  config: Partial<RiskScorerConfig> = {},
): RiskScoreResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 1. Compute individual component scores
  const bankScore = scoreBankDetection(bankResult, cfg.bankWeight);
  const keywordScore = scoreKeywordDetection(keywordResult, cfg.keywordWeight);
  const patternScore = scorePatternDetection(patternMatches, cfg.patternWeight);

  // 2. Sum weighted components into a base composite
  let compositeScore =
    bankScore.weightedScore +
    keywordScore.weightedScore +
    patternScore.weightedScore;

  // 3. Apply amplification rules for dangerous combinations
  const amplifications = evaluateAmplifications(
    bankResult,
    keywordResult,
    patternMatches,
  );

  for (const amp of amplifications) {
    compositeScore *= amp.multiplier;
  }

  // 4. Clamp to configured max
  compositeScore = Math.min(
    Math.round(compositeScore * 100) / 100,
    cfg.maxScore,
  );

  // 5. Map composite to discrete risk level
  const riskLevel = mapToRiskLevel(compositeScore, cfg);

  // 6. Generate summary
  const summary = generateSummary(
    riskLevel,
    compositeScore,
    bankResult,
    keywordResult,
    patternMatches,
    amplifications,
  );

  return {
    compositeScore,
    riskLevel,
    components: {
      bank: bankScore,
      keyword: keywordScore,
      pattern: patternScore,
    },
    amplifications,
    summary,
  };
}

// ─── Component Scorers ─────────────────────────────────

/**
 * Score bank name detection findings.
 *
 * Scoring logic:
 *   - Each unique bank detected adds 15 points (up to 45)
 *   - Each additional mention per bank adds 2 points (up to 15)
 *   - Multiple affected regions add 10 points per extra region (up to 20)
 *   - Capped at raw score of 100
 */
function scoreBankDetection(
  result: BankDetectionResult,
  weight: number,
): ComponentScore {
  if (result.uniqueBankCount === 0) {
    return {
      rawScore: 0,
      weight,
      weightedScore: 0,
      explanation: "No bank mentions detected",
    };
  }

  let rawScore = 0;

  // Unique banks (up to 45 points)
  rawScore += Math.min(result.uniqueBankCount * 15, 45);

  // Mention volume bonus (up to 15 points)
  const extraMentions = Math.max(
    0,
    result.totalMentions - result.uniqueBankCount,
  );
  rawScore += Math.min(extraMentions * 2, 15);

  // Regional diversity bonus (up to 20 points)
  const extraRegions = Math.max(0, result.regionsAffected.length - 1);
  rawScore += Math.min(extraRegions * 10, 20);

  // Baseline: any bank mention is at least 20 points
  rawScore = Math.max(rawScore, 20);

  // Cap at 100
  rawScore = Math.min(rawScore, 100);

  const weightedScore = Math.round(rawScore * weight * 100) / 100;

  const bankNames = result.matches
    .slice(0, 3)
    .map(m => m.bankName)
    .join(", ");
  const explanation =
    `${result.uniqueBankCount} bank(s) detected (${bankNames}` +
    `${result.uniqueBankCount > 3 ? ", ..." : ""})` +
    `, ${result.totalMentions} total mention(s)` +
    `, ${result.regionsAffected.length} region(s)`;

  return { rawScore, weight, weightedScore, explanation };
}

/**
 * Score keyword detection findings.
 *
 * Scoring logic:
 *   - Uses the total weighted score from keyword detection
 *   - Scaled logarithmically to prevent runaway scores from high-volume pages
 *   - Peak keyword weight provides a minimum floor
 *   - Category diversity adds bonus points
 *   - Capped at raw score of 100
 */
function scoreKeywordDetection(
  result: KeywordDetectionResult,
  weight: number,
): ComponentScore {
  if (result.uniqueKeywordCount === 0) {
    return {
      rawScore: 0,
      weight,
      weightedScore: 0,
      explanation: "No keywords detected",
    };
  }

  let rawScore = 0;

  // Logarithmic scaling of the total weighted score
  // log2(totalWeightedScore + 1) * 8 gives a reasonable 0–100 curve
  rawScore += Math.log2(result.totalWeightedScore + 1) * 8;

  // Peak weight floor: ensures high-severity keywords push the score up
  const peakFloor = result.peakWeight * 5;
  rawScore = Math.max(rawScore, peakFloor);

  // Category diversity bonus: more categories = broader threat surface
  rawScore += (result.matchedCategories.length - 1) * 5;

  // Cap at 100
  rawScore = Math.min(Math.round(rawScore * 100) / 100, 100);

  const weightedScore = Math.round(rawScore * weight * 100) / 100;

  const topKeywords = result.matches
    .slice(0, 3)
    .map(m => `"${m.term}"`)
    .join(", ");
  const explanation =
    `${result.uniqueKeywordCount} keyword(s) matched` +
    ` (top: ${topKeywords}${result.uniqueKeywordCount > 3 ? ", ..." : ""})` +
    `, weighted score: ${result.totalWeightedScore}` +
    `, peak weight: ${result.peakWeight}` +
    `, ${result.matchedCategories.length} categor${result.matchedCategories.length === 1 ? "y" : "ies"}`;

  return { rawScore, weight, weightedScore, explanation };
}

/**
 * Score regex pattern detection findings.
 *
 * Scoring logic:
 *   - Each pattern match contributes its weight × a volume factor
 *   - High-value patterns (credit card, email:password) get more weight
 *   - Multiple pattern categories compound the score
 *   - Capped at raw score of 100
 */
function scorePatternDetection(
  matches: PatternMatch[],
  weight: number,
): ComponentScore {
  if (matches.length === 0) {
    return {
      rawScore: 0,
      weight,
      weightedScore: 0,
      explanation: "No pattern matches detected",
    };
  }

  let rawScore = 0;

  for (const match of matches) {
    // Base contribution: pattern weight × log of match count
    // Log scaling prevents a page with 10,000 email addresses
    // from dwarfing everything else
    const volumeFactor = Math.log2(match.matchCount + 1);
    rawScore += match.weight * volumeFactor;
  }

  // Category diversity bonus
  const categories = new Set(matches.map(m => m.category));
  rawScore += (categories.size - 1) * 5;

  // Peak pattern weight provides a minimum floor
  const peakWeight = Math.max(...matches.map(m => m.weight));
  const peakFloor = peakWeight * 4;
  rawScore = Math.max(rawScore, peakFloor);

  // Cap at 100
  rawScore = Math.min(Math.round(rawScore * 100) / 100, 100);

  const weightedScore = Math.round(rawScore * weight * 100) / 100;

  const topPatterns = matches
    .sort((a, b) => b.weight * b.matchCount - a.weight * a.matchCount)
    .slice(0, 3)
    .map(m => `${m.patternName} (×${m.matchCount})`)
    .join(", ");
  const explanation =
    `${matches.length} pattern(s) matched` +
    ` (${topPatterns}${matches.length > 3 ? ", ..." : ""})` +
    `, ${categories.size} categor${categories.size === 1 ? "y" : "ies"}`;

  return { rawScore, weight, weightedScore, explanation };
}

// ─── Amplification Rules ───────────────────────────────

/**
 * Evaluate amplification rules — certain combinations of findings
 * indicate a much higher threat than individual findings suggest.
 *
 * Each rule checks for a specific dangerous combination and returns
 * a multiplier that boosts the composite score.
 */
function evaluateAmplifications(
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
): AmplificationResult[] {
  const results: AmplificationResult[] = [];

  const hasBankMention = bankResult.uniqueBankCount > 0;
  const hasCreditCardPattern = patternMatches.some(
    m => m.category === "CREDIT_CARD",
  );
  const hasCredentialPattern = patternMatches.some(
    m => m.category === "CREDENTIAL_DUMP",
  );
  const hasBankDataPattern = patternMatches.some(
    m => m.category === "BANK_DATA",
  );

  const keywordTerms = new Set(
    keywordResult.matches.map(m => m.term.toLowerCase()),
  );

  const hasFullzKeyword = keywordTerms.has("fullz");
  const hasCcDumpKeyword =
    keywordTerms.has("cc dump") ||
    keywordTerms.has("cc dumps") ||
    keywordTerms.has("card dump") ||
    keywordTerms.has("card dumps");
  const hasBankLeakKeyword =
    keywordTerms.has("bank leak") ||
    keywordTerms.has("bank breach") ||
    keywordTerms.has("bank database");
  const hasCredentialDumpKeyword =
    keywordTerms.has("credential dump") ||
    keywordTerms.has("combo list") ||
    keywordTerms.has("combolist") ||
    keywordTerms.has("stealer logs") ||
    keywordTerms.has("stealer log");

  // Rule 1: Bank + Credit Card Pattern + CC keyword
  // "Someone is selling credit card data from a specific bank"
  if (
    hasBankMention &&
    hasCreditCardPattern &&
    (hasCcDumpKeyword || hasFullzKeyword)
  ) {
    results.push({
      rule: "bank_cc_dump_combo",
      multiplier: 1.5,
      reason:
        "Bank name + credit card patterns + card dump keywords — " +
        "strong indicator of targeted bank card leak",
    });
  }

  // Rule 2: Bank + Credential Pattern + Credential keyword
  // "Credential dump targeting a specific bank's customers"
  if (hasBankMention && hasCredentialPattern && hasCredentialDumpKeyword) {
    results.push({
      rule: "bank_credential_dump_combo",
      multiplier: 1.4,
      reason:
        "Bank name + credential patterns + dump keywords — " +
        "likely a targeted credential leak",
    });
  }

  // Rule 3: Bank + Bank data patterns (IBAN, routing number, etc.)
  // "Actual bank account data from a named institution"
  if (hasBankMention && hasBankDataPattern && hasBankLeakKeyword) {
    results.push({
      rule: "bank_data_leak_combo",
      multiplier: 1.5,
      reason:
        "Bank name + bank data patterns + leak keywords — " +
        "direct bank data exposure",
    });
  }

  // Rule 4: "Fullz" keyword + any PII patterns
  // "Full identity packages" — the most dangerous leak type
  if (hasFullzKeyword) {
    const hasPii = patternMatches.some(m => m.category === "PII");
    if (hasPii) {
      results.push({
        rule: "fullz_with_pii",
        multiplier: 1.6,
        reason:
          '"Fullz" keyword + PII pattern matches — ' +
          "complete identity packages being traded",
      });
    }
  }

  // Rule 5: Multiple high-severity keyword categories + patterns
  // Broad threat surface — multiple types of sensitive data together
  const highSeverityCategories = keywordResult.categories.filter(
    c => c.maxWeight >= 8,
  );
  if (highSeverityCategories.length >= 3 && patternMatches.length >= 2) {
    results.push({
      rule: "multi_category_threat",
      multiplier: 1.3,
      reason:
        `${highSeverityCategories.length} high-severity keyword categories + ` +
        `${patternMatches.length} pattern types — broad threat surface`,
    });
  }

  // Rule 6: Very high volume of credential patterns
  // Indicates a large-scale dump rather than incidental mentions
  const credentialVolume = patternMatches
    .filter(m => m.category === "CREDENTIAL_DUMP")
    .reduce((sum, m) => sum + m.matchCount, 0);
  if (credentialVolume >= 50) {
    results.push({
      rule: "mass_credential_dump",
      multiplier: 1.4,
      reason: `${credentialVolume} credential pattern matches — mass dump detected`,
    });
  }

  // Rule 7: Very high volume of credit card patterns
  const ccVolume = patternMatches
    .filter(m => m.category === "CREDIT_CARD")
    .reduce((sum, m) => sum + m.matchCount, 0);
  if (ccVolume >= 20) {
    results.push({
      rule: "mass_cc_dump",
      multiplier: 1.4,
      reason: `${ccVolume} credit card pattern matches — mass card dump detected`,
    });
  }

  return results;
}

// ─── Risk Level Mapping ────────────────────────────────

/**
 * Map a composite score to a discrete risk level using configured thresholds.
 */
function mapToRiskLevel(score: number, cfg: RiskScorerConfig): RiskLevel {
  if (score >= cfg.criticalThreshold) return "CRITICAL";
  if (score >= cfg.highThreshold) return "HIGH";
  if (score >= cfg.mediumThreshold) return "MEDIUM";
  return "LOW";
}

// ─── Summary Generation ────────────────────────────────

/**
 * Generate a human-readable summary of the risk assessment.
 * This is stored in the `matchedData` field of Alert records.
 */
function generateSummary(
  riskLevel: RiskLevel,
  compositeScore: number,
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
  amplifications: AmplificationResult[],
): string {
  const parts: string[] = [];

  parts.push(`Risk: ${riskLevel} (score: ${compositeScore.toFixed(1)}/100)`);

  // Banks
  if (bankResult.uniqueBankCount > 0) {
    const bankNames = bankResult.matches
      .slice(0, 5)
      .map(m => m.bankName)
      .join(", ");
    parts.push(
      `Banks: ${bankResult.uniqueBankCount} detected (${bankNames}${bankResult.uniqueBankCount > 5 ? ", ..." : ""})`,
    );
  }

  // Keywords
  if (keywordResult.uniqueKeywordCount > 0) {
    const topTerms = keywordResult.matches
      .slice(0, 5)
      .map(m => `"${m.term}"`)
      .join(", ");
    parts.push(
      `Keywords: ${keywordResult.uniqueKeywordCount} matched (${topTerms}${keywordResult.uniqueKeywordCount > 5 ? ", ..." : ""})`,
    );
  }

  // Patterns
  if (patternMatches.length > 0) {
    const totalMatches = patternMatches.reduce(
      (sum, m) => sum + m.matchCount,
      0,
    );
    const topPatterns = patternMatches
      .slice(0, 3)
      .map(m => `${m.patternName}:${m.matchCount}`)
      .join(", ");
    parts.push(`Patterns: ${totalMatches} match(es) (${topPatterns})`);
  }

  // Amplifications
  if (amplifications.length > 0) {
    const ampNames = amplifications.map(a => a.rule).join(", ");
    const totalMultiplier = amplifications.reduce(
      (product, a) => product * a.multiplier,
      1,
    );
    parts.push(`Amplified: ${totalMultiplier.toFixed(2)}x (${ampNames})`);
  }

  return parts.join(" | ");
}

// ─── Utility Exports ───────────────────────────────────

/**
 * Quick risk classification without full scoring — useful for
 * pre-filtering content before running the full detection pipeline.
 *
 * Returns true if ANY of the following are present:
 *   - Bank mentions + any keyword with weight >= 7
 *   - Credit card or credential patterns
 *   - Keywords with weight >= 9
 */
export function quickRiskCheck(
  bankResult: BankDetectionResult,
  keywordResult: KeywordDetectionResult,
  patternMatches: PatternMatch[],
): boolean {
  // Any high-weight patterns
  const hasHighPatterns = patternMatches.some(m => m.weight >= 7);
  if (hasHighPatterns) return true;

  // Very high severity keywords alone
  if (keywordResult.peakWeight >= 9) return true;

  // Bank mention + moderate keywords
  if (bankResult.uniqueBankCount > 0 && keywordResult.peakWeight >= 7) {
    return true;
  }

  return false;
}

/**
 * Get a color code for a risk level — useful for dashboard rendering.
 */
export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL":
      return "#dc2626"; // red-600
    case "HIGH":
      return "#ea580c"; // orange-600
    case "MEDIUM":
      return "#ca8a04"; // yellow-600
    case "LOW":
      return "#16a34a"; // green-600
  }
}

/**
 * Numeric priority for a risk level (higher = more urgent).
 * Useful for sorting alerts.
 */
export function riskLevelPriority(level: RiskLevel): number {
  switch (level) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
  }
}
