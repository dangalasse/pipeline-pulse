import type { NodeId, NodeStatus } from './pipeline-nodes';

/** One GitHub Actions job step (from jobs API). */
export interface JobStepDetail {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

/** Per-canvas-node detail for the live drawer. */
export interface NodeRunDetail {
  githubJobId: number | null;
  status: NodeStatus;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: JobStepDetail[];
  /** False when this canvas node has no job in the live-demo run. */
  inThisRun: boolean;
}

export type NodeDetailsMap = Partial<Record<NodeId, NodeRunDetail>>;
