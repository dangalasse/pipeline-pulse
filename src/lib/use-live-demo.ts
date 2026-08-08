import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeDetailsMap } from '../../shared/node-run-detail';
import type { NodeId, NodeStatus } from '../../shared/pipeline-nodes';
import type { Locale } from '../i18n';

export interface DemoRunState {
  id: string;
  githubRunUrl: string | null;
  workflowStatus:
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'failure'
    | 'cancelled'
    | 'idle';
  nodeStatuses: Record<NodeId, NodeStatus> | null;
  nodeDetails: NodeDetailsMap | null;
  errorMessage: string | null;
}

export interface AiReviewResult {
  summary?: string;
  likelyCause?: string;
  suggestedFix?: string;
  provider?: string;
  model?: string;
  analyzedAt?: string;
  error?: string;
  message?: string;
}

export interface NodeLogResult {
  nodeId: NodeId;
  truncated: boolean;
  text: string;
  lines?: number;
  fetchedAt: string;
  error?: string;
}

interface UseLiveDemoOptions {
  locale: Locale;
  t: {
    demoUnavailable: string;
    rateLimited: string;
  };
  getTurnstileToken: () => string | null;
  resetTurnstile: () => void;
}

async function mintTicket(
  aud: string,
  turnstileToken: string,
): Promise<{ ticket: string } | { error: string }> {
  const res = await fetch('/api/demo-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken, aud }),
  });
  const data = (await res.json()) as {
    ticket?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.ticket) {
    return { error: data.message ?? data.error ?? `HTTP ${res.status}` };
  }
  return { ticket: data.ticket };
}

function applyRun(
  data: DemoRunState,
  setDemo: (d: DemoRunState) => void,
  setNodeStatuses: (s: Record<NodeId, NodeStatus> | null) => void,
  setNodeDetails: (d: NodeDetailsMap | null) => void,
): void {
  setDemo(data);
  setNodeStatuses(data.nodeStatuses);
  setNodeDetails(data.nodeDetails ?? null);
}

export function useLiveDemo({
  locale,
  t,
  getTurnstileToken,
  resetTurnstile,
}: UseLiveDemoOptions) {
  const [demo, setDemo] = useState<DemoRunState | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<
    NodeId,
    NodeStatus
  > | null>(null);
  const [nodeDetails, setNodeDetails] = useState<NodeDetailsMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [nodeLog, setNodeLog] = useState<NodeLogResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/demo-run/latest');
        if (!res.ok) return;
        const data = (await res.json()) as DemoRunState;
        if (cancelled || !data.id) return;
        applyRun(data, setDemo, setNodeStatuses, setNodeDetails);
      } catch {
        /* read-only best effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pollRun = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/demo-run/${id}`);
          if (!res.ok) return;
          const data = (await res.json()) as DemoRunState;
          applyRun(data, setDemo, setNodeStatuses, setNodeDetails);
          if (
            data.workflowStatus === 'completed' ||
            data.workflowStatus === 'failure' ||
            data.workflowStatus === 'cancelled'
          ) {
            stopPolling();
            setLoading(false);
          }
        } catch {
          /* keep polling */
        }
      }, 3000);
    },
    [stopPolling],
  );

  const startDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiReview(null);
    setNodeLog(null);
    stopPolling();

    try {
      const token = getTurnstileToken();
      if (!token) {
        setError(
          locale === 'en-US'
            ? 'Complete the human check first.'
            : 'Complete a verificação humana primeiro.',
        );
        setLoading(false);
        return;
      }
      const ticket = await mintTicket('pipeline.dispatch', token);
      resetTurnstile();
      if ('error' in ticket) {
        setError(ticket.error);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/demo-run', {
        method: 'POST',
        headers: { 'X-Demo-Ticket': ticket.ticket },
      });
      const data = (await res.json()) as DemoRunState & {
        error?: string;
        message?: string;
      };

      if (res.status === 503) {
        setError(t.demoUnavailable);
        setLoading(false);
        return;
      }
      if (res.status === 429) {
        setError(data.message ?? t.rateLimited);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      applyRun(data, setDemo, setNodeStatuses, setNodeDetails);
      pollRun(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [
    getTurnstileToken,
    locale,
    pollRun,
    resetTurnstile,
    stopPolling,
    t.demoUnavailable,
    t.rateLimited,
  ]);

  const requestAiReview = useCallback(async () => {
    if (!demo) return;
    setAiLoading(true);
    setAiReview(null);

    const failedNodes = Object.entries(demo.nodeStatuses ?? {})
      .filter(([, s]) => s === 'failure')
      .map(([id]) => id)
      .join(', ');

    try {
      const token = getTurnstileToken();
      if (!token) {
        setAiReview({
          error:
            locale === 'en-US'
              ? 'Complete the human check first.'
              : 'Complete a verificação humana primeiro.',
        });
        return;
      }
      const ticket = await mintTicket('edge.analyze', token);
      resetTurnstile();
      if ('error' in ticket) {
        setAiReview({ error: ticket.error });
        return;
      }

      const res = await fetch('/api/demo-ai-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Ticket': ticket.ticket,
        },
        body: JSON.stringify({
          message:
            demo.errorMessage ??
            `Pipeline demo failed at: ${failedNodes || 'unknown step'}`,
          context: `Pipeline Pulse live-demo run ${demo.id}`,
          locale,
        }),
      });
      const data = (await res.json()) as AiReviewResult;
      setAiReview(data);
    } catch (err) {
      setAiReview({
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAiLoading(false);
    }
  }, [demo, getTurnstileToken, locale, resetTurnstile]);

  const fetchNodeLog = useCallback(
    async (nodeId: NodeId) => {
      if (!demo?.id) return;
      setLogLoading(true);
      setNodeLog(null);
      try {
        const token = getTurnstileToken();
        if (!token) {
          setNodeLog({
            nodeId,
            truncated: false,
            text: '',
            fetchedAt: new Date().toISOString(),
            error:
              locale === 'en-US'
                ? 'Complete the human check first.'
                : 'Complete a verificação humana primeiro.',
          });
          return;
        }
        const ticket = await mintTicket('pipeline.logs', token);
        resetTurnstile();
        if ('error' in ticket) {
          setNodeLog({
            nodeId,
            truncated: false,
            text: '',
            fetchedAt: new Date().toISOString(),
            error: ticket.error,
          });
          return;
        }

        const res = await fetch(
          `/api/demo-run/${encodeURIComponent(demo.id)}/nodes/${encodeURIComponent(nodeId)}/logs`,
          { headers: { 'X-Demo-Ticket': ticket.ticket } },
        );
        const data = (await res.json()) as NodeLogResult & {
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          setNodeLog({
            nodeId,
            truncated: false,
            text: '',
            fetchedAt: new Date().toISOString(),
            error: data.message ?? data.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        setNodeLog({
          nodeId: data.nodeId,
          truncated: data.truncated,
          text: data.text,
          lines: data.lines,
          fetchedAt: data.fetchedAt,
        });
      } catch (err) {
        setNodeLog({
          nodeId,
          truncated: false,
          text: '',
          fetchedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLogLoading(false);
      }
    },
    [demo?.id, getTurnstileToken, locale, resetTurnstile],
  );

  const clearNodeLog = useCallback(() => setNodeLog(null), []);

  return {
    demo,
    nodeStatuses,
    nodeDetails,
    loading,
    error,
    aiReview,
    aiLoading,
    logLoading,
    nodeLog,
    startDemo,
    requestAiReview,
    fetchNodeLog,
    clearNodeLog,
  };
}
