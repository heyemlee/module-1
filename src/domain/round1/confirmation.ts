export type ConfirmationCategory =
  | "ROOM"
  | "OPENING"
  | "MEP"
  | "APPLIANCE"
  | "CABINET"
  | "READINESS";

export type ConfirmationSeverity = "REQUIRED" | "REVIEW";

export type ConfirmationItem = {
  id: string;
  category: ConfirmationCategory;
  code: string;
  message: string;
  severity: ConfirmationSeverity;
  path?: string;
  blocksProduction: boolean;
};

export function createConfirmationItem(input: {
  category: ConfirmationCategory;
  code: string;
  message: string;
  path?: string;
  severity?: ConfirmationSeverity;
}): ConfirmationItem {
  return {
    id: [input.category, input.code, input.path ?? "root"].join(":"),
    category: input.category,
    code: input.code,
    message: input.message,
    severity: input.severity ?? "REQUIRED",
    path: input.path,
    blocksProduction: true
  };
}
