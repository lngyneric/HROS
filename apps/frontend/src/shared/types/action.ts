export type ActionEventStatus = "ok" | "failed";

export type ActionEvent = {
  eventType: string;
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

export type ActionEnvelope<T = Record<string, unknown>> = {
  events: ActionEvent[];
  result: ActionResult & T;
};
