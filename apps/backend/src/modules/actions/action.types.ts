export type ActionEventStatus = "ok" | "failed";

export type ActionEventType =
  | "command_received"
  | "input_validated"
  | "policy_checked"
  | "state_transition_applied"
  | "artifact_written"
  | "command_succeeded"
  | "command_failed";

export type ActionEvent = {
  eventType: ActionEventType;
  timestamp: string;
  status: ActionEventStatus;
  summary: string;
  payload: Record<string, unknown>;
};

export type ActionArtifact = {
  type: string;
  id: string;
};

export type ActionResult = {
  success: boolean;
  businessObjectType: string;
  businessObjectId: string;
  nextActions: string[];
  artifacts: ActionArtifact[];
};

export type ActionEnvelope = {
  events: ActionEvent[];
  result: ActionResult;
};
