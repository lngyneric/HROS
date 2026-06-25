export const WORKFLOW_EVENT_TYPES = {
  created: "command_received",
  validated: "input_validated",
  policyChecked: "policy_checked",
  transitioned: "state_transition_applied",
  artifactWritten: "artifact_written",
  succeeded: "command_succeeded",
  failed: "command_failed"
} as const;
