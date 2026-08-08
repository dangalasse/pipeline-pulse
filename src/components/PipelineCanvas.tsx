import { useState } from 'react';
import type {
  NodeDetailsMap,
  NodeRunDetail,
} from '../../shared/node-run-detail';
import {
  NODE_ORDER,
  type NodeId,
  type NodeStatus,
  PIPELINE_NODES,
  type PipelineNode,
  explainFor,
  labelFor,
} from '../../shared/pipeline-nodes';
import { type Locale, type UiCopy, isEnglish } from '../i18n';
import type { NodeLogResult } from '../lib/use-live-demo';

interface PipelineCanvasProps {
  locale: Locale;
  t: UiCopy;
  nodeStatuses?: Record<NodeId, NodeStatus> | null;
  nodeDetails?: NodeDetailsMap | null;
  runId?: string | null;
  logLoading?: boolean;
  nodeLog?: NodeLogResult | null;
  onFetchLog?: (nodeId: NodeId) => void;
  onClearLog?: () => void;
}

function statusLabel(t: UiCopy, status: NodeStatus): string {
  const map: Record<NodeStatus, keyof UiCopy> = {
    idle: 'statusIdle',
    pending: 'statusPending',
    running: 'statusRunning',
    success: 'statusSuccess',
    failure: 'statusFailure',
    skipped: 'statusSkipped',
  };
  return t[map[status]];
}

function stepStatusClass(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    if (conclusion === 'success') return 'ok';
    if (conclusion === 'skipped') return 'skipped';
    return 'fail';
  }
  if (status === 'in_progress') return 'running';
  return 'pending';
}

function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function Edge({ animated }: { animated: boolean }) {
  return (
    <svg className="canvas-edge" viewBox="0 0 48 24" aria-hidden="true">
      <line
        x1="0"
        y1="12"
        x2="40"
        y2="12"
        className={`edge-line${animated ? ' edge-line--active' : ''}`}
      />
      <polygon points="40,8 48,12 40,16" className="edge-arrow" />
    </svg>
  );
}

function NodeDetail({
  node,
  locale,
  t,
  detail,
  runId,
  logLoading,
  nodeLog,
  onFetchLog,
  onClearLog,
  onClose,
}: {
  node: PipelineNode;
  locale: Locale;
  t: UiCopy;
  detail: NodeRunDetail | null | undefined;
  runId?: string | null;
  logLoading?: boolean;
  nodeLog?: NodeLogResult | null;
  onFetchLog?: (nodeId: NodeId) => void;
  onClearLog?: () => void;
  onClose: () => void;
}) {
  const english = isEnglish(locale);
  const canLog = Boolean(
    runId && detail?.githubJobId && detail.inThisRun && onFetchLog,
  );
  const duration = formatDuration(
    detail?.startedAt ?? null,
    detail?.completedAt ?? null,
  );
  const logForThisNode = nodeLog?.nodeId === node.id ? nodeLog : null;

  return (
    <aside className="node-detail" aria-live="polite">
      <div className="node-detail-head">
        <h3>{labelFor(node, english)}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          {t.nodeDetailClose}
        </button>
      </div>
      <p className="node-detail-explain">{explainFor(node, english)}</p>

      {detail && !detail.inThisRun && !node.jobName ? (
        <p className="node-detail-note">{t.logUnavailable}</p>
      ) : null}
      {detail && node.jobName && !detail.inThisRun ? (
        <p className="node-detail-note">{t.nodeNotInRun}</p>
      ) : null}

      {detail?.steps && detail.steps.length > 0 ? (
        <div className="node-steps">
          <p className="node-detail-label">{t.liveSteps}</p>
          {duration ? (
            <p className="node-detail-meta">
              {t.stepDuration}: {duration}
            </p>
          ) : null}
          <ol className="node-step-list">
            {detail.steps.map((step) => (
              <li
                key={`${step.number}-${step.name}`}
                className={`node-step status-${stepStatusClass(step.status, step.conclusion)}`}
              >
                <span className="node-step-num">{step.number}</span>
                <span className="node-step-name">{step.name}</span>
                <span className="node-step-status">
                  {step.conclusion ?? step.status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {canLog ? (
        <div className="node-log-actions">
          <button
            type="button"
            className="btn ghost small"
            disabled={logLoading}
            onClick={() => onFetchLog?.(node.id)}
          >
            {logLoading ? t.loadingLog : t.viewLog}
          </button>
          {logForThisNode && !logForThisNode.error ? (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => onClearLog?.()}
            >
              {t.nodeDetailClose}
            </button>
          ) : null}
        </div>
      ) : null}

      {logForThisNode?.error ? (
        <p className="demo-error">{logForThisNode.error}</p>
      ) : null}
      {logForThisNode && !logForThisNode.error ? (
        <div className="node-log-panel">
          {logForThisNode.truncated ? (
            <p className="node-detail-meta">{t.logTruncated}</p>
          ) : null}
          <pre className="node-log">
            <code>{logForThisNode.text || '(empty)'}</code>
          </pre>
        </div>
      ) : null}

      <p className="node-detail-label">{t.workflowYaml}</p>
      <pre className="node-yaml">
        <code>{node.yaml}</code>
      </pre>
    </aside>
  );
}

export function PipelineCanvas({
  locale,
  t,
  nodeStatuses,
  nodeDetails,
  runId,
  logLoading,
  nodeLog,
  onFetchLog,
  onClearLog,
}: PipelineCanvasProps) {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const english = isEnglish(locale);
  const selectedNode = PIPELINE_NODES.find((n) => n.id === selected);

  const selectNode = (nodeId: NodeId) => {
    if (nodeId !== selected) {
      onClearLog?.();
    }
    setSelected(nodeId);
  };

  const closeDetail = () => {
    onClearLog?.();
    setSelected(null);
  };

  return (
    <div className="canvas-wrap">
      <div className="canvas-scroll">
        <ol className="canvas-flow" aria-label={t.conveyorHeading}>
          {NODE_ORDER.map((nodeId, index) => {
            const node = PIPELINE_NODES.find((n) => n.id === nodeId);
            if (!node) return null;
            const status: NodeStatus = nodeStatuses?.[nodeId] ?? 'idle';
            const nextStatus = nodeStatuses?.[NODE_ORDER[index + 1]];
            const edgeActive =
              status === 'success' ||
              status === 'running' ||
              nextStatus === 'running' ||
              nextStatus === 'pending';

            return (
              <li key={nodeId} className="canvas-step">
                <button
                  type="button"
                  className={`canvas-node status-${status}${selected === nodeId ? ' is-selected' : ''}`}
                  onClick={() => selectNode(nodeId)}
                  aria-pressed={selected === nodeId}
                >
                  <span className="node-icon" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="node-label">{labelFor(node, english)}</span>
                  <span className="node-status">{statusLabel(t, status)}</span>
                </button>
                {index < NODE_ORDER.length - 1 ? (
                  <Edge animated={edgeActive} />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {selectedNode ? (
        <NodeDetail
          node={selectedNode}
          locale={locale}
          t={t}
          detail={nodeDetails?.[selectedNode.id]}
          runId={runId}
          logLoading={logLoading}
          nodeLog={nodeLog}
          onFetchLog={onFetchLog}
          onClearLog={onClearLog}
          onClose={closeDetail}
        />
      ) : null}
    </div>
  );
}
