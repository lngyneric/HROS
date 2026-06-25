import { createActionResponse } from "./action-response.js";
import type { ActionEnvelope, ActionEvent, ActionEventStatus, ActionEventType, ActionResult } from "./action.types.js";

type ActionEmitter = (
  eventType: ActionEventType,
  status: ActionEventStatus,
  payload?: Record<string, unknown>
) => void;

type CreateActionRunInput = {
  actionCode: string;
  actorType: string;
  actorId: string;
  input: Record<string, unknown>;
  execute: (helpers: {
    emit: ActionEmitter;
  }) => Promise<ActionResult>;
};

function createEvent(params: {
  eventType: ActionEventType;
  status: ActionEventStatus;
  payload?: Record<string, unknown>;
}): ActionEvent {
  return {
    eventType: params.eventType,
    timestamp: new Date().toISOString(),
    status: params.status,
    summary: params.eventType,
    payload: params.payload ?? {}
  };
}

export async function createActionRun(input: CreateActionRunInput): Promise<ActionEnvelope> {
  const events: ActionEvent[] = [];

  const emit: ActionEmitter = (eventType, status, payload = {}) => {
    events.push(
      createEvent({
        eventType,
        status,
        payload
      })
    );
  };

  emit("command_received", "ok", {
    actionCode: input.actionCode,
    actorType: input.actorType,
    actorId: input.actorId,
    input: input.input
  });

  try {
    const result = await input.execute({ emit });

    emit("command_succeeded", "ok", {
      businessObjectType: result.businessObjectType,
      businessObjectId: result.businessObjectId,
      nextActions: result.nextActions
    });

    return createActionResponse({ events, result });
  } catch (error) {
    emit("command_failed", "failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });

    throw error;
  }
}
