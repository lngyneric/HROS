import type { ActionEnvelope, ActionEvent, ActionResult } from "./action.types.js";

export function createActionResponse(params: {
  events: ActionEvent[];
  result: ActionResult;
}): ActionEnvelope {
  return {
    events: params.events,
    result: params.result
  };
}

export type { ActionEnvelope } from "./action.types.js";
