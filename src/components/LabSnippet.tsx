interface LabSnippetProps {
  source: string;
  disabled?: boolean;
  label: string;
  hint: string;
  onChange: (source: string) => void;
}

export function LabSnippet({
  source,
  disabled,
  label,
  hint,
  onChange,
}: LabSnippetProps) {
  const lines = source.split(/\n/).length;
  const gutter = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);

  return (
    <div className="snippet">
      <div className="snippet-bar">
        <span className="snippet-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="snippet-pills">
          <span className="snippet-pill">HTML</span>
          <span className="snippet-pill is-on">CSS</span>
          <span className="snippet-pill is-on">JS</span>
        </span>
        <span className="snippet-meta mono">{label}</span>
      </div>
      <div className="snippet-body">
        <pre className="snippet-gutter" aria-hidden="true">
          {gutter.join('\n')}
        </pre>
        <textarea
          className="snippet-code"
          spellCheck={false}
          disabled={disabled}
          value={source}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          data-testid="lab-snippet"
        />
      </div>
      <p className="snippet-hint muted">{hint}</p>
    </div>
  );
}
