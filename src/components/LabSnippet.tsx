import { useMemo, useRef, useState } from 'react';
import {
  type LabPane,
  composeLabSource,
  splitLabSource,
} from '../../shared/lab-object';
import { highlightLab } from '../lib/lab-highlight';

interface LabSnippetProps {
  source: string;
  disabled?: boolean;
  hint: string;
  onChange: (source: string) => void;
}

const PANES: { id: LabPane; label: string; file: string }[] = [
  { id: 'html', label: 'HTML', file: 'object.html' },
  { id: 'css', label: 'CSS', file: 'object.css' },
  { id: 'js', label: 'JS', file: 'object.js' },
];

export function LabSnippet({
  source,
  disabled,
  hint,
  onChange,
}: LabSnippetProps) {
  const [pane, setPane] = useState<LabPane>('css');
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const hlRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);

  const parts = useMemo(() => splitLabSource(source), [source]);
  const code = parts[pane];
  const active = PANES.find((p) => p.id === pane) ?? PANES[1];
  const lines = Math.max(code.split('\n').length, 1);
  const gutter = Array.from({ length: lines }, (_, i) => String(i + 1)).join(
    '\n',
  );
  const highlighted = useMemo(() => highlightLab(code, pane), [code, pane]);

  const syncScroll = () => {
    const edit = editRef.current;
    if (!edit) return;
    if (hlRef.current) {
      hlRef.current.scrollTop = edit.scrollTop;
      hlRef.current.scrollLeft = edit.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = edit.scrollTop;
    }
  };

  const copyPane = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="snippet">
      <div className="snippet-chrome">
        <span className="snippet-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="snippet-tabs" role="tablist" aria-label="object">
          {PANES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={pane === item.id}
              id={`lab-tab-${item.id}`}
              className={`snippet-tab snippet-tab-${item.id}${pane === item.id ? ' is-on' : ''}`}
              data-testid={`lab-tab-${item.id}`}
              onClick={() => setPane(item.id)}
            >
              <span className="snippet-lang" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
        <span className="snippet-file">{active.file}</span>
        <button
          type="button"
          className="snippet-copy"
          onClick={copyPane}
          disabled={disabled}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="snippet-stage">
        <div className="snippet-body">
          <pre className="snippet-gutter" aria-hidden="true" ref={gutterRef}>
            {gutter}
          </pre>
          <div className="snippet-edit">
            <pre
              className="snippet-hl"
              aria-hidden="true"
              ref={hlRef}
              // Tokens are HTML-escaped in highlightLab before this paint.
              // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped overlay
              dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
            />
            <textarea
              ref={editRef}
              className="snippet-code"
              spellCheck={false}
              disabled={disabled}
              value={code}
              onScroll={syncScroll}
              onChange={(e) =>
                onChange(composeLabSource({ ...parts, [pane]: e.target.value }))
              }
              aria-label={active.file}
              data-testid="lab-snippet"
            />
          </div>
        </div>
      </div>
      <p className="snippet-hint">{hint}</p>
    </div>
  );
}
