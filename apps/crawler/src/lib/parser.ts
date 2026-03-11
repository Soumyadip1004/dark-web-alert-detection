import * as cheerio from "cheerio";

import { createLogger } from "./logger";

const log = createLogger("parser");

export interface ParsedPage {
  /** Page title extracted from <title> or <h1> */
  title: string | null;
  /** Main text content of the page, cleaned of scripts/styles/nav */
  content: string;
  /** Author if found in common meta tags or page patterns */
  author: string | null;
  /** Timestamp if found in meta tags, <time> elements, or common patterns */
  timestamp: string | null;
  /** All discovered links (absolute URLs) */
  links: string[];
}

/**
 * Selectors for elements that should be removed before extracting
 * text content — they add noise and no useful intelligence.
 */
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "header",
  "footer",
  "aside",
  ".sidebar",
  ".nav",
  ".navbar",
  ".menu",
  ".footer",
  ".header",
  ".advertisement",
  ".ad",
  ".ads",
  ".cookie-banner",
  ".cookie-notice",
] as const;

/**
 * Common meta tag names/properties that may contain author information.
 */
const AUTHOR_META_SELECTORS = [
  'meta[name="author"]',
  'meta[property="article:author"]',
  'meta[name="dc.creator"]',
  'meta[name="dcterms.creator"]',
  'meta[property="og:author"]',
] as const;

/**
 * Common meta tag names/properties that may contain date information.
 */
const DATE_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[name="date"]',
  'meta[name="dc.date"]',
  'meta[name="dcterms.date"]',
  'meta[property="og:updated_time"]',
  'meta[name="publish-date"]',
  'meta[name="created"]',
] as const;

/**
 * Parse raw HTML from a crawled page and extract structured data.
 *
 * This parser is intentionally broad — dark web pages have wildly
 * inconsistent markup, so we try multiple strategies for each field.
 */
export function parsePage(html: string, pageUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = extractTitle($);
  const author = extractAuthor($);
  const timestamp = extractTimestamp($);
  const content = extractContent($);
  const links = extractLinks($, pageUrl);

  log.debug(
    `Parsed: title=${title ? `"${title.slice(0, 50)}"` : "null"}, ` +
      `content=${content.length} chars, ` +
      `author=${author ?? "null"}, ` +
      `links=${links.length}`,
  );

  return { title, content, author, timestamp, links };
}

/**
 * Extract the page title. Tries <title>, then falls back to <h1>.
 */
function extractTitle($: cheerio.CheerioAPI): string | null {
  // Try <title> tag first
  const titleTag = $("title").first().text().trim();
  if (titleTag.length > 0) {
    return cleanText(titleTag);
  }

  // Fall back to first <h1>
  const h1 = $("h1").first().text().trim();
  if (h1.length > 0) {
    return cleanText(h1);
  }

  // Try og:title meta
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle && ogTitle.length > 0) {
    return cleanText(ogTitle);
  }

  return null;
}

/**
 * Extract the main text content of the page.
 * Removes noise elements first, then extracts cleaned text.
 */
function extractContent($: cheerio.CheerioAPI): string {
  // Clone the document so we don't mutate the original
  // (we still need the original for link extraction)
  const clone = cheerio.load($.html());

  // Remove noisy elements
  for (const selector of NOISE_SELECTORS) {
    clone(selector).remove();
  }

  // Try to find the main content area first
  const mainSelectors = [
    "main",
    "article",
    '[role="main"]',
    ".post-content",
    ".thread-content",
    ".message-content",
    ".post-body",
    ".entry-content",
    "#content",
    ".content",
  ];

  for (const selector of mainSelectors) {
    const el = clone(selector).first();
    if (el.length > 0) {
      const text = el.text().trim();
      if (text.length > 50) {
        log.debug(`Content extracted from selector: ${selector}`);
        return cleanText(text);
      }
    }
  }

  // Fall back to <body> text
  const bodyText = clone("body").text().trim();
  if (bodyText.length > 0) {
    return cleanText(bodyText);
  }

  // Last resort: entire document text
  return cleanText(clone.root().text().trim());
}

/**
 * Extract author information from meta tags or common page patterns.
 */
function extractAuthor($: cheerio.CheerioAPI): string | null {
  // Try meta tags
  for (const selector of AUTHOR_META_SELECTORS) {
    const content = $(selector).attr("content")?.trim();
    if (content && content.length > 0) {
      return cleanText(content);
    }
  }

  // Try common author class patterns (forums often use these)
  const authorSelectors = [
    ".author",
    ".username",
    ".poster",
    ".user-name",
    ".post-author",
    '[itemprop="author"]',
    ".message-username",
  ];

  for (const selector of authorSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      const text = el.text().trim();
      if (text.length > 0 && text.length < 100) {
        return cleanText(text);
      }
    }
  }

  return null;
}

/**
 * Extract timestamp from meta tags, <time> elements, or common patterns.
 */
function extractTimestamp($: cheerio.CheerioAPI): string | null {
  // Try meta tags
  for (const selector of DATE_META_SELECTORS) {
    const content = $(selector).attr("content")?.trim();
    if (content && content.length > 0) {
      return content;
    }
  }

  // Try <time> elements (datetime attribute is most reliable)
  const timeEl = $("time[datetime]").first();
  if (timeEl.length > 0) {
    const datetime = timeEl.attr("datetime")?.trim();
    if (datetime) {
      return datetime;
    }
  }

  // Try <time> element text content
  const timeText = $("time").first().text().trim();
  if (timeText.length > 0) {
    return timeText;
  }

  // Try common date class patterns
  const dateSelectors = [
    ".date",
    ".timestamp",
    ".post-date",
    ".message-date",
    ".time",
    ".created",
    '[itemprop="datePublished"]',
    '[itemprop="dateCreated"]',
  ];

  for (const selector of dateSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      // Prefer datetime attribute
      const datetime = el.attr("datetime")?.trim();
      if (datetime) return datetime;

      // Fall back to text content
      const text = el.text().trim();
      if (text.length > 0 && text.length < 100) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Extract all links from the page and resolve them to absolute URLs.
 * Filters out non-HTTP(S) schemes, fragment-only links, and
 * common non-content resources.
 */
function extractLinks($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const resolved = resolveUrl(href, pageUrl);
    if (resolved) {
      links.add(resolved);
    }
  });

  return Array.from(links);
}

/**
 * Resolve a potentially relative URL against the page URL.
 * Returns null for URLs that should be skipped.
 */
function resolveUrl(href: string, pageUrl: string): string | null {
  const trimmed = href.trim();

  // Skip empty, fragment-only, and javascript: links
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, pageUrl);

    // Only keep http/https/.onion URLs
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    // Skip common non-content file extensions
    const skipExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".ico",
      ".bmp",
      ".mp3",
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".zip",
      ".rar",
      ".7z",
      ".tar",
      ".gz",
      ".css",
      ".js",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
    ];

    const pathname = resolved.pathname.toLowerCase();
    for (const ext of skipExtensions) {
      if (pathname.endsWith(ext)) {
        return null;
      }
    }

    // Strip the fragment
    resolved.hash = "";

    return resolved.toString();
  } catch {
    log.debug(`Could not resolve URL: "${trimmed}" against "${pageUrl}"`);
    return null;
  }
}

/**
 * Clean extracted text:
 * - collapse whitespace runs into single spaces
 * - trim leading/trailing whitespace
 * - remove null bytes and other control characters
 */
function cleanText(raw: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally removing control chars
  const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  return raw
    .replace(controlCharsRegex, "") // remove control chars (keep \t \n \r)
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines
    .trim();
}
