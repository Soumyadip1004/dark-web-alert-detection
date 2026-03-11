const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL_CONFIG: Record<LogLevel, { color: string; label: string }> = {
  debug: { color: COLORS.gray, label: "DEBUG" },
  info: { color: COLORS.cyan, label: "INFO " },
  warn: { color: COLORS.yellow, label: "WARN " },
  error: { color: COLORS.red, label: "ERROR" },
};

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel;
  }
  return "debug";
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  scope: string,
  message: string,
): string {
  const config = LOG_LEVEL_CONFIG[level];
  return `${COLORS.gray}${timestamp()}${COLORS.reset} ${config.color}[${config.label}]${COLORS.reset} ${COLORS.magenta}(${scope})${COLORS.reset} ${message}`;
}

export function createLogger(scope: string) {
  const minLevel = getMinLevel();

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
  }

  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", scope, message), ...args);
      }
    },

    info(message: string, ...args: unknown[]) {
      if (shouldLog("info")) {
        console.info(formatMessage("info", scope, message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]) {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", scope, message), ...args);
      }
    },

    error(message: string, ...args: unknown[]) {
      if (shouldLog("error")) {
        console.error(formatMessage("error", scope, message), ...args);
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
