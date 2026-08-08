import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
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
        setDemo(data);
        setNodeStatuses(data.nodeStatuses);
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
          setDemo(data);
          setNodeStatuses(data.nodeStatuses);
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

      setDemo(data);
      setNodeStatuses(data.nodeStatuses);
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

  return {
    demo,
    nodeStatuses,
    loading,
    error,
    aiReview,
    aiLoading,
    startDemo,
    requestAiReview,
  };
}
