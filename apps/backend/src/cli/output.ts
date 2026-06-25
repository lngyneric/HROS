export type CliEventStatus = "ok" | "failed";

export type CliOutputEvent = {
  eventType: string;
  timestamp: string;
  status: CliEventStatus;
  summary: string;
  payload: Record<string, unknown>;
};

export type CliOutputStatus = "succeeded" | "blocked" | "failed";

export type CliCommandResponse = {
  status: CliOutputStatus;
  invocationId?: string;
  traceId?: string;
  events: CliOutputEvent[];
  result: Record<string, unknown>;
};

export function createCliEvent(
  eventType: string,
  status: CliEventStatus,
  payload: Record<string, unknown> = {}
): CliOutputEvent {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    status,
    summary: eventType,
    payload
  };
}

type CreateCliResponseInput = {
  invocationId?: string;
  traceId?: string;
  events: CliOutputEvent[];
  result: Record<string, unknown>;
};

export function cliSucceeded(input: CreateCliResponseInput): CliCommandResponse {
  return {
    status: "succeeded",
    invocationId: input.invocationId,
    traceId: input.traceId,
    events: input.events,
    result: input.result
  };
}

export function cliBlocked(input: CreateCliResponseInput): CliCommandResponse {
  return {
    status: "blocked",
    invocationId: input.invocationId,
    traceId: input.traceId,
    events: input.events,
    result: input.result
  };
}

export function cliFailed(input: CreateCliResponseInput): CliCommandResponse {
  return {
    status: "failed",
    invocationId: input.invocationId,
    traceId: input.traceId,
    events: input.events,
    result: input.result
  };
}
