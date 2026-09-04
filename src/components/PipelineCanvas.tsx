import {
  type TransitionEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  NodeDetailsMap,
  NodeRunDetail,
} from '../../shared/node-run-detail';
import {
  NODE_ORDER,
  type NodeId,
  type NodeStatus,
  PIPELINE_COLS,
  PIPELINE_EDGES,
  PIPELINE_LAYOUT,
  PIPELINE_NODES,
  PIPELINE_ROWS,
  type PipelineNode,
  explainFor,
  labelFor,
} from '../../shared/pipeline-nodes';
import { type Locale, type UiCopy, isEnglish } from '../i18n';
import { localizeStepName, localizeStepStatus } from '../lib/localize-run';
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

interface WirePath {
  key: string;
  d: string;
  active: boolean;
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

/** Rounded orthogonal path — horizontal out, vertical jog, horizontal in. */
function orthogonalPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dy) < 0.5) {
    return `M ${x1} ${y1} H ${x2}`;
  }
  // Narrow gaps: cubic looks cleaner than a crushed elbow.
  if (Math.abs(dx) < 28) {
    const c = Math.max(Math.abs(dx) * 0.55, 14);
    return `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
  }
  const midX = x1 + dx * 0.5;
  const radius = Math.min(10, Math.abs(dy) / 2, Math.abs(dx) / 2 - 1);
  const dir = dy > 0 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `H ${midX - radius}`,
    `Q ${midX} ${y1} ${midX} ${y1 + dir * radius}`,
    `V ${y2 - dir * radius}`,
    `Q ${midX} ${y2} ${midX + radius} ${y2}`,
    `H ${x2}`,
  ].join(' ');
}

function edgeActive(from: NodeStatus, to: NodeStatus): boolean {
  return (
    from === 'success' ||
    from === 'running' ||
    to === 'running' ||
    to === 'pending'
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
                <span className="node-step-name">
                  {localizeStepName(step.name, locale)}
                </span>
                <span className="node-step-status">
                  {localizeStepStatus(step.status, step.conclusion, locale)}
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
  const [open, setOpen] = useState(false);
  const [wires, setWires] = useState<WirePath[]>([]);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Partial<Record<NodeId, HTMLButtonElement | null>>>(
    {},
  );
  const english = isEnglish(locale);
  const selectedNode = PIPELINE_NODES.find((n) => n.id === selected);

  const selectNode = (nodeId: NodeId) => {
    if (nodeId === selected && open) {
      setOpen(false);
      return;
    }
    if (nodeId !== selected) {
      onClearLog?.();
    }
    setSelected(nodeId);
    requestAnimationFrame(() => setOpen(true));
  };

  const closeDetail = () => {
    setOpen(false);
  };

  const finishClose = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'grid-template-rows') return;
    if (open) return;
    onClearLog?.();
    setSelected(null);
  };

  const paintWires = useCallback(() => {
    const root = graphRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const next: WirePath[] = [];

    for (const edge of PIPELINE_EDGES) {
      const fromEl = nodeRefs.current[edge.from];
      const toEl = nodeRefs.current[edge.to];
      if (!fromEl || !toEl) continue;
      const fromPort = fromEl.querySelector('.node-port-out');
      const toPort = toEl.querySelector('.node-port-in');
      const from = (fromPort ?? fromEl).getBoundingClientRect();
      const to = (toPort ?? toEl).getBoundingClientRect();
      const x1 = from.left + from.width / 2 - rootBox.left;
      const y1 = from.top + from.height / 2 - rootBox.top;
      const x2 = to.left + to.width / 2 - rootBox.left;
      const y2 = to.top + to.height / 2 - rootBox.top;
      const fromStatus: NodeStatus = nodeStatuses?.[edge.from] ?? 'idle';
      const toStatus: NodeStatus = nodeStatuses?.[edge.to] ?? 'idle';
      next.push({
        key: `${edge.from}-${edge.to}`,
        d: orthogonalPath(x1, y1, x2, y2),
        active: edgeActive(fromStatus, toStatus),
      });
    }
    setWires(next);
  }, [nodeStatuses]);

  useLayoutEffect(() => {
    paintWires();
    const root = graphRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => paintWires());
    ro.observe(root);
    for (const el of Object.values(nodeRefs.current)) {
      if (el) ro.observe(el);
    }
    window.addEventListener('resize', paintWires);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', paintWires);
    };
  }, [paintWires]);

  return (
    <div className="canvas-wrap" data-testid="pipeline-canvas">
      <div className="canvas-scroll">
        <div ref={graphRef} className="canvas-graph-shell">
          <svg className="canvas-wires" aria-hidden="true">
            {wires.map((wire) => (
              <path
                key={wire.key}
                d={wire.d}
                className={`wire-path${wire.active ? ' is-active' : ''}`}
                fill="none"
              />
            ))}
          </svg>
          <ol
            className="canvas-graph"
            aria-label={t.conveyorHeading}
            style={{
              gridTemplateColumns: `repeat(${PIPELINE_COLS}, minmax(5.2rem, 1fr))`,
              gridTemplateRows: `repeat(${PIPELINE_ROWS}, auto)`,
            }}
          >
            {PIPELINE_LAYOUT.map((slot) => {
              const node = PIPELINE_NODES.find((n) => n.id === slot.id);
              if (!node) return null;
              const status: NodeStatus = nodeStatuses?.[slot.id] ?? 'idle';
              const rowSpan = slot.rowSpan ?? 1;
              const orderIndex = NODE_ORDER.indexOf(slot.id);
              const isLeaf = !PIPELINE_EDGES.some((e) => e.from === slot.id);
              return (
                <li
                  key={slot.id}
                  className={`canvas-slot${slot.col === 0 ? ' is-root' : ''}${isLeaf ? ' is-leaf' : ''}`}
                  style={{
                    gridColumn: slot.col + 1,
                    gridRow: `${slot.row + 1} / span ${rowSpan}`,
                  }}
                >
                  <button
                    type="button"
                    ref={(el) => {
                      nodeRefs.current[slot.id] = el;
                    }}
                    className={`canvas-node status-${status}${selected === slot.id ? ' is-selected' : ''}`}
                    onClick={() => selectNode(slot.id)}
                    aria-pressed={selected === slot.id}
                    data-testid={`pipeline-node-${slot.id}`}
                  >
                    <span
                      className="node-port node-port-in"
                      aria-hidden="true"
                    />
                    <span className="node-icon" aria-hidden="true">
                      {orderIndex + 1}
                    </span>
                    <span className="node-copy">
                      <span className="node-label">
                        {labelFor(node, english)}
                      </span>
                      <span className="node-status">
                        {statusLabel(t, status)}
                      </span>
                    </span>
                    <span
                      className="node-port node-port-out"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div
        className={`node-drawer${open ? ' is-open' : ''}`}
        onTransitionEnd={finishClose}
      >
        <div className="node-drawer-inner">
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
      </div>
    </div>
  );
}
