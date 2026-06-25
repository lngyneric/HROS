import { randomUUID } from "node:crypto";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeCommandName(commandName: string) {
  return commandName.trim().replace(/\s+/g, " ");
}

export function makeTraceId() {
  return `trace_${randomUUID()}`;
}

export function makeRequestId() {
  return `req_${randomUUID()}`;
}

export function makeIdempotencyKey(commandName: string, argsJson: Record<string, unknown>) {
  return `${normalizeCommandName(commandName)}:${stableSerialize(argsJson)}`;
}
