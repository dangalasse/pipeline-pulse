import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAB_SOURCE,
  LAB_SOURCE_MAX_BYTES,
  composeLabSource,
  hashLabSource,
  parseLabSource,
  sourceToSrcDoc,
  splitLabSource,
} from './lab-object';

describe('parseLabSource', () => {
  it('accepts the default cube snippet', () => {
    expect(parseLabSource({ source: DEFAULT_LAB_SOURCE })).toBe(
      DEFAULT_LAB_SOURCE,
    );
    expect(parseLabSource(DEFAULT_LAB_SOURCE)).toBe(DEFAULT_LAB_SOURCE);
  });

  it('accepts free CSS and script fragments', () => {
    const src = `<style>:root{--lab:#fbbf24}</style><div class="cube"></div>`;
    expect(parseLabSource({ source: src })).toBe(src);
  });

  it('rejects empty, oversized and non-source payloads', () => {
    expect(parseLabSource(null)).toBeNull();
    expect(parseLabSource(undefined)).toBeNull();
    expect(parseLabSource({})).toBeNull();
    expect(parseLabSource({ source: '   ' })).toBeNull();
    expect(
      parseLabSource({ source: 'x'.repeat(LAB_SOURCE_MAX_BYTES + 1) }),
    ).toBe(null);
    expect(parseLabSource('cyan')).toBe('cyan');
  });

  it('rejects credential-like material', () => {
    expect(
      parseLabSource({ source: `color: ghp_${'A'.repeat(36)};` }),
    ).toBeNull();
    expect(
      parseLabSource({
        source: `/* github_pat_${'B'.repeat(22)} */ .x{}`,
      }),
    ).toBeNull();
    expect(parseLabSource({ source: 'AKIAIOSFODNN7EXAMPLE {}' })).toBeNull();
  });
});

describe('hashLabSource', () => {
  it('is stable and short', async () => {
    const a = await hashLabSource(DEFAULT_LAB_SOURCE);
    const b = await hashLabSource(DEFAULT_LAB_SOURCE);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await hashLabSource('other')).not.toBe(a);
  });
});

describe('splitLabSource / composeLabSource', () => {
  it('round-trips the default cube into HTML, CSS and JS panes', () => {
    const parts = splitLabSource(DEFAULT_LAB_SOURCE);
    expect(parts.css).toContain('--lab: #5eead4');
    expect(parts.html).toContain('class="cube"');
    expect(parts.html).not.toContain('<style');
    expect(parts.js).toContain("setProperty('--lab'");
    const again = splitLabSource(composeLabSource(parts));
    expect(again.css).toBe(parts.css);
    expect(again.html).toBe(parts.html);
    expect(again.js).toBe(parts.js);
  });
});

describe('sourceToSrcDoc', () => {
  it('wraps fragments and keeps full documents', () => {
    expect(sourceToSrcDoc('<div class="x"></div>')).toContain(
      '<!doctype html>',
    );
    expect(sourceToSrcDoc('<!doctype html><html><body>ok</body></html>')).toBe(
      '<!doctype html><html><body>ok</body></html>',
    );
  });
});
