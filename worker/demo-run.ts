import { unzipSync } from 'fflate';
import { fetchGithubJobLogBody } from '../shared/github-job-logs';
import type {
  JobStepDetail,
  NodeDetailsMap,
  NodeRunDetail,
} from '../shared/node-run-detail';
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
  nodeDetails: NodeDetailsMap;
  createdAt: number;
  errorMessage: string | null;
}

const GITHUB_REPO = 'dangalasse/pipeline-pulse';
const WORKFLOW_FILE = 'live-demo.yml';
const RUN_TTL_MS = 30 * 60_000;
const LOG_MAX_BYTES = 32 * 1024;
const LOG_MAX_LINES = 200;

const demoRuns = new Map<string, DemoRunRecord>();

const JOB_TO_NODE = new Map<string, NodeId>(
  PIPELINE_NODES.filter((n) => n.jobName).map((n) => [
    n.jobName as string,
    n.id,
  ]),
);

interface GithubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
  }>;
}

function idleNodeMap(): Record<NodeId, NodeStatus> {
  return Object.fromEntries(NODE_ORDER.map((id) => [id, 'idle'])) as Record<
    NodeId,
    NodeStatus
  >;
}

function emptyNodeDetails(): NodeDetailsMap {
  const out: NodeDetailsMap = {};
  for (const node of PIPELINE_NODES) {
    if (node.id === 'push') {
      out.push = {
        githubJobId: null,
        status: 'success',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        steps: [],
        inThisRun: true,
      };
      continue;
    }
    out[node.id] = {
      githubJobId: null,
      status: 'idle',
      conclusion: null,
      startedAt: null,
      completedAt: null,
      steps: [],
      inThisRun: Boolean(node.jobName),
    };
  }
  return out;
}

function pruneOldRuns(): void {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of demoRuns) {
    if (run.createdAt < cutoff) demoRuns.delete(id);
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
    if (conclusion === 'cancelled') return 'failure';
    return 'failure';
  }
  if (status === 'in_progress') return 'running';
  if (status === 'queued' || status === 'waiting' || status === 'pending') {
    return 'pending';
  }
  return 'idle';
}

function mapSteps(steps: GithubJob['steps'] | undefined): JobStepDetail[] {
  if (!steps?.length) return [];
  return steps.map((s) => ({
    name: s.name,
    status: s.status,
    conclusion: s.conclusion,
    number: s.number,
  }));
}

function applyGithubJobs(record: DemoRunRecord, jobs: GithubJob[]): void {
  record.nodeStatuses.push = 'success';
  if (!record.nodeDetails.push) {
    record.nodeDetails.push = {
      githubJobId: null,
      status: 'success',
      conclusion: 'success',
      startedAt: null,
      completedAt: null,
      steps: [],
      inThisRun: true,
    };
  } else {
    record.nodeDetails.push.status = 'success';
    record.nodeDetails.push.inThisRun = true;
  }

  const seenJobNodes = new Set<NodeId>();
  for (const job of jobs) {
    const nodeId = JOB_TO_NODE.get(job.name);
    if (!nodeId) continue;
    seenJobNodes.add(nodeId);
    const status = mapJobStatus(job.status, job.conclusion);
    record.nodeStatuses[nodeId] = status;
    record.nodeDetails[nodeId] = {
      githubJobId: job.id,
      status,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      steps: mapSteps(job.steps),
      inThisRun: true,
    };
  }

  if (record.workflowStatus === 'completed') {
    for (const node of PIPELINE_NODES) {
      if (node.id === 'push') continue;
      if (!node.jobName || !seenJobNodes.has(node.id)) {
        if (record.nodeStatuses[node.id] === 'idle') {
          record.nodeStatuses[node.id] = 'skipped';
        }
        const prev = record.nodeDetails[node.id];
        record.nodeDetails[node.id] = {
          githubJobId: prev?.githubJobId ?? null,
          status: record.nodeStatuses[node.id],
          conclusion: prev?.conclusion ?? 'skipped',
          startedAt: prev?.startedAt ?? null,
          completedAt: prev?.completedAt ?? null,
          steps: prev?.steps ?? [],
          inThisRun: Boolean(node.jobName && seenJobNodes.has(node.id)),
        };
      }
    }
  }
}

async function githubFetch(
  token: string | undefined,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pipeview-worker',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers,
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
  token: string | undefined,
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

  const jobsBody = (await jobsRes.json()) as { jobs: GithubJob[] };
  applyGithubJobs(record, jobsBody.jobs);
}

export async function createDemoRun(token: string): Promise<DemoRunRecord> {
  pruneOldRuns();

  if (!token) throw new TokenMissingError();

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const record: DemoRunRecord = {
    id,
    githubRunId: null,
    githubRunUrl: null,
    workflowStatus: 'queued',
    nodeStatuses: idleNodeMap(),
    nodeDetails: emptyNodeDetails(),
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

  const found = await findLatestDispatchRun(token, createdAt);
  if (found) {
    record.githubRunId = found.id;
    record.githubRunUrl = found.html_url;
    record.workflowStatus = 'in_progress';
    record.nodeStatuses.ci = 'pending';
  }

  return record;
}

/** Public (or lightly-authed) read of the latest live-demo.yml run. */
export async function getLatestLiveDemoRun(
  token?: string,
): Promise<DemoRunRecord | null> {
  const res = await githubFetch(
    token,
    `/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
  );
  if (!res.ok) {
    throw new Error(`GitHub runs list failed (${res.status})`);
  }
  const body = (await res.json()) as {
    workflow_runs: Array<{
      id: number;
      html_url: string;
      status: string;
      conclusion: string | null;
      created_at: string;
    }>;
  };
  const run = body.workflow_runs[0];
  if (!run) return null;

  let workflowStatus: DemoRunRecord['workflowStatus'] = 'in_progress';
  if (run.status === 'completed') {
    workflowStatus = run.conclusion === 'success' ? 'completed' : 'failure';
  } else if (run.status === 'queued') {
    workflowStatus = 'queued';
  }

  const record: DemoRunRecord = {
    id: `gh-${run.id}`,
    githubRunId: run.id,
    githubRunUrl: run.html_url,
    workflowStatus,
    nodeStatuses: idleNodeMap(),
    nodeDetails: emptyNodeDetails(),
    createdAt: new Date(run.created_at).getTime(),
    errorMessage: null,
  };
  record.nodeStatuses.push = 'success';
  await refreshRunFromGithub(token, record);
  demoRuns.set(record.id, record);
  return record;
}

export async function getDemoRun(
  token: string | undefined,
  id: string,
): Promise<DemoRunRecord | null> {
  pruneOldRuns();
  let record = demoRuns.get(id);
  if (!record && id.startsWith('gh-')) {
    const githubRunId = Number(id.slice(3));
    if (Number.isFinite(githubRunId)) {
      record = {
        id,
        githubRunId,
        githubRunUrl: null,
        workflowStatus: 'in_progress',
        nodeStatuses: idleNodeMap(),
        nodeDetails: emptyNodeDetails(),
        createdAt: Date.now(),
        errorMessage: null,
      };
      demoRuns.set(id, record);
    }
  }
  if (!record) return null;
  await refreshRunFromGithub(token, record);
  return record;
}

const REDACT_PATTERNS: RegExp[] = [
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9_]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-/=+]{8,}/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi,
];

function stripAnsi(text: string): string {
  const esc = String.fromCharCode(27);
  return text.split(esc).reduce((acc, part, i) => {
    if (i === 0) return part;
    const m = part.match(/^\[[0-9;]*[a-zA-Z]/);
    return acc + (m ? part.slice(m[0].length) : part);
  }, '');
}

function redactSecrets(text: string): string {
  let out = text;
  for (const re of REDACT_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

function truncateLog(text: string): { text: string; truncated: boolean } {
  const lines = text.split(/\r?\n/);
  let truncated = false;
  let sliced = lines;
  if (sliced.length > LOG_MAX_LINES) {
    sliced = sliced.slice(-LOG_MAX_LINES);
    truncated = true;
  }
  let joined = sliced.join('\n');
  if (joined.length > LOG_MAX_BYTES) {
    joined = joined.slice(-LOG_MAX_BYTES);
    truncated = true;
  }
  return { text: joined, truncated };
}

function extractTextFromZip(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf));
  const parts: string[] = [];
  const names = Object.keys(files).sort();
  for (const name of names) {
    const data = files[name];
    if (!data || name.endsWith('/')) continue;
    parts.push(`--- ${name} ---\n${new TextDecoder().decode(data)}`);
  }
  return parts.join('\n\n');
}

export async function fetchNodeJobLogs(
  token: string,
  record: DemoRunRecord,
  nodeId: NodeId,
): Promise<{
  nodeId: NodeId;
  truncated: boolean;
  text: string;
  fetchedAt: string;
  githubJobId: number;
}> {
  if (!token) throw new TokenMissingError();

  await refreshRunFromGithub(token, record);
  const detail: NodeRunDetail | undefined = record.nodeDetails[nodeId];
  if (!detail?.githubJobId) {
    throw new Error(
      `No GitHub job for node "${nodeId}" in this live-demo run.`,
    );
  }

  const githubRes = await githubFetch(
    token,
    `/repos/${GITHUB_REPO}/actions/jobs/${detail.githubJobId}/logs`,
    { redirect: 'manual' },
  );
  const res = await fetchGithubJobLogBody(githubRes);
  if (!res.ok) {
    const detailText = await res.text();
    throw new Error(
      `GitHub job logs failed (${res.status}): ${detailText.slice(0, 160)}`,
    );
  }

  const buf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') ?? '';
  let raw: string;
  if (
    contentType.includes('zip') ||
    contentType.includes('octet-stream') ||
    (buf.byteLength >= 4 && new DataView(buf).getUint32(0, true) === 0x04034b50)
  ) {
    raw = extractTextFromZip(buf);
  } else {
    raw = new TextDecoder().decode(buf);
  }

  const cleaned = redactSecrets(stripAnsi(raw));
  const { text, truncated } = truncateLog(cleaned);
  return {
    nodeId,
    truncated,
    text,
    fetchedAt: new Date().toISOString(),
    githubJobId: detail.githubJobId,
  };
}

export function serializeDemoRun(record: DemoRunRecord) {
  return {
    id: record.id,
    githubRunId: record.githubRunId,
    githubRunUrl: record.githubRunUrl,
    workflowStatus: record.workflowStatus,
    nodeStatuses: record.nodeStatuses,
    nodeDetails: record.nodeDetails,
    createdAt: record.createdAt,
    errorMessage: record.errorMessage,
  };
}

export function isNodeId(value: string): value is NodeId {
  return NODE_ORDER.includes(value as NodeId);
}
