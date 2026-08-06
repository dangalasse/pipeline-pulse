import type { NodeId, NodeStatus } from '../shared/pipeline-nodes';
import { NODE_ORDER, PIPELINE_NODES } from '../shared/pipeline-nodes';

export interface DemoRunRecord {
  id: string;
  githubRunId: number | null;
  githubRunUrl: string | null;
  workflowStatus:
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'failure'
    | 'cancelled';
  nodeStatuses: Record<NodeId, NodeStatus>;
  createdAt: number;
  errorMessage: string | null;
}

const GITHUB_REPO = 'dangalasse/pipeline-pulse';
const WORKFLOW_FILE = 'live-demo.yml';
const RATE_LIMIT_MS = 60_000;
const RUN_TTL_MS = 30 * 60_000;

const demoRuns = new Map<string, DemoRunRecord>();
let lastDispatchAt = 0;

const JOB_TO_NODE = new Map<string, NodeId>(
  PIPELINE_NODES.filter((n) => n.jobName).map((n) => [
    n.jobName as string,
    n.id,
  ]),
);

function idleNodeMap(): Record<NodeId, NodeStatus> {
  return Object.fromEntries(NODE_ORDER.map((id) => [id, 'idle'])) as Record<
    NodeId,
    NodeStatus
  >;
}

function pruneOldRuns(): void {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of demoRuns) {
    if (run.createdAt < cutoff) demoRuns.delete(id);
  }
}

export class RateLimitError extends Error {
  constructor() {
    super('Rate limit: wait ~1 minute between demo runs.');
    this.name = 'RateLimitError';
  }
}

export class TokenMissingError extends Error {
  constructor() {
    super('GITHUB_TOKEN secret is not configured on the Worker.');
    this.name = 'TokenMissingError';
  }
}

function mapJobStatus(status: string, conclusion: string | null): NodeStatus {
  if (status === 'completed') {
    if (conclusion === 'success') return 'success';
    if (conclusion === 'skipped') return 'skipped';
    return 'failure';
  }
  if (status === 'in_progress') return 'running';
  if (status === 'queued' || status === 'waiting' || status === 'pending') {
    return 'pending';
  }
  return 'idle';
}

function applyGithubJobs(
  record: DemoRunRecord,
  jobs: Array<{ name: string; status: string; conclusion: string | null }>,
): void {
  record.nodeStatuses.push = 'success';

  for (const job of jobs) {
    const nodeId = JOB_TO_NODE.get(job.name);
    if (nodeId) {
      record.nodeStatuses[nodeId] = mapJobStatus(job.status, job.conclusion);
    }
  }

  for (const node of PIPELINE_NODES) {
    if (node.id === 'push') continue;
    if (node.jobName) continue;
    if (record.workflowStatus === 'completed') {
      record.nodeStatuses[node.id] = 'skipped';
    }
  }
}

async function githubFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'pipeline-pulse-worker',
      ...(init?.headers ?? {}),
    },
  });
}

async function findLatestDispatchRun(
  token: string,
  afterMs: number,
): Promise<{ id: number; html_url: string } | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await githubFetch(
      token,
      `/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      workflow_runs: Array<{
        id: number;
        html_url: string;
        created_at: string;
        status: string;
      }>;
    };
    const match = body.workflow_runs.find(
      (run) => new Date(run.created_at).getTime() >= afterMs - 5000,
    );
    if (match) {
      return { id: match.id, html_url: match.html_url };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function refreshRunFromGithub(
  token: string,
  record: DemoRunRecord,
): Promise<void> {
  if (!record.githubRunId) return;

  const runRes = await githubFetch(
    token,
    `/repos/${GITHUB_REPO}/actions/runs/${record.githubRunId}`,
  );
  if (!runRes.ok) return;

  const runBody = (await runRes.json()) as {
    status: string;
    conclusion: string | null;
    html_url: string;
  };
  record.githubRunUrl = runBody.html_url;

  if (runBody.status === 'completed') {
    record.workflowStatus =
      runBody.conclusion === 'success' ? 'completed' : 'failure';
  } else if (runBody.status === 'in_progress' || runBody.status === 'queued') {
    record.workflowStatus = 'in_progress';
  }

  const jobsRes = await githubFetch(
    token,
    `/repos/${GITHUB_REPO}/actions/runs/${record.githubRunId}/jobs?per_page=20`,
  );
  if (!jobsRes.ok) return;

  const jobsBody = (await jobsRes.json()) as {
    jobs: Array<{ name: string; status: string; conclusion: string | null }>;
  };
  applyGithubJobs(record, jobsBody.jobs);
}

export async function createDemoRun(token: string): Promise<DemoRunRecord> {
  pruneOldRuns();

  if (!token) throw new TokenMissingError();
  if (Date.now() - lastDispatchAt < RATE_LIMIT_MS) throw new RateLimitError();

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const record: DemoRunRecord = {
    id,
    githubRunId: null,
    githubRunUrl: null,
    workflowStatus: 'queued',
    nodeStatuses: idleNodeMap(),
    createdAt,
    errorMessage: null,
  };
  record.nodeStatuses.push = 'success';
  demoRuns.set(id, record);

  const dispatchRes = await githubFetch(
    token,
    `/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    },
  );

  if (!dispatchRes.ok) {
    const detail = await dispatchRes.text();
    record.workflowStatus = 'failure';
    record.errorMessage = `GitHub dispatch failed (${dispatchRes.status}): ${detail.slice(0, 200)}`;
    throw new Error(record.errorMessage);
  }

  lastDispatchAt = Date.now();

  const found = await findLatestDispatchRun(token, createdAt);
  if (found) {
    record.githubRunId = found.id;
    record.githubRunUrl = found.html_url;
    record.workflowStatus = 'in_progress';
    record.nodeStatuses.ci = 'pending';
  }

  return record;
}

export async function getDemoRun(
  token: string,
  id: string,
): Promise<DemoRunRecord | null> {
  pruneOldRuns();
  const record = demoRuns.get(id);
  if (!record) return null;
  if (token) {
    await refreshRunFromGithub(token, record);
  }
  return record;
}

export function serializeDemoRun(record: DemoRunRecord) {
  return {
    id: record.id,
    githubRunId: record.githubRunId,
    githubRunUrl: record.githubRunUrl,
    workflowStatus: record.workflowStatus,
    nodeStatuses: record.nodeStatuses,
    createdAt: record.createdAt,
    errorMessage: record.errorMessage,
  };
}
