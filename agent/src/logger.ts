type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

function write(level: "debug" | "info" | "warn" | "error", event: string, fields: LogFields): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, fields: LogFields = {}) => write("debug", event, fields),
  info: (event: string, fields: LogFields = {}) => write("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => write("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => write("error", event, fields),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function maskHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-6)}` : "redacted";
}
