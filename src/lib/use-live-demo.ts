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
    | 'cancelled';
  nodeStatuses: Record<NodeId, NodeStatus>;
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
}

export function useLiveDemo({ locale, t }: UseLiveDemoOptions) {
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
      const res = await fetch('/api/demo-run', { method: 'POST' });
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
        setError(t.rateLimited);
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
  }, [pollRun, stopPolling, t.demoUnavailable, t.rateLimited]);

  const requestAiReview = useCallback(async () => {
    if (!demo) return;
    setAiLoading(true);
    setAiReview(null);

    const failedNodes = Object.entries(demo.nodeStatuses)
      .filter(([, s]) => s === 'failure')
      .map(([id]) => id)
      .join(', ');

    try {
      const res = await fetch('/api/demo-ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [demo, locale]);

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
