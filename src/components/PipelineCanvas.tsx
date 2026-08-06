import { useState } from 'react';
import {
  NODE_ORDER,
  type NodeId,
  type NodeStatus,
  PIPELINE_NODES,
  type PipelineNode,
  explainFor,
  labelFor,
} from '../../shared/pipeline-nodes';
import { type UiCopy, isEnglish } from '../i18n';
import type { Locale } from '../i18n';

interface PipelineCanvasProps {
  locale: Locale;
  t: UiCopy;
  nodeStatuses?: Record<NodeId, NodeStatus> | null;
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
  onClose,
}: {
  node: PipelineNode;
  locale: Locale;
  t: UiCopy;
  onClose: () => void;
}) {
  const english = isEnglish(locale);
  return (
    <aside className="node-detail" aria-live="polite">
      <div className="node-detail-head">
        <h3>{labelFor(node, english)}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          {t.nodeDetailClose}
        </button>
      </div>
      <p className="node-detail-explain">{explainFor(node, english)}</p>
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
}: PipelineCanvasProps) {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const english = isEnglish(locale);
  const selectedNode = PIPELINE_NODES.find((n) => n.id === selected);

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
                  onClick={() => setSelected(nodeId)}
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
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
