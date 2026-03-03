import { RoleKey } from "@/lib/roles";

export const TEAM_SEQUENCE: RoleKey[] = [
  "business_analyst",
  "product_owner",
  "solution_architect",
  "data_scientist"
];

export type TeamSimulationInput = {
  task: string;
  notes?: string;
};

export type AgentStepResult = {
  role: RoleKey;
  output: string;
  fallbackUsed: boolean;
};

export type TeamSimulationOutput = {
  steps: AgentStepResult[];
  finalSynthesis: string;
  fallbackUsed: boolean;
};
