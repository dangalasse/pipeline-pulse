import type { LabPane } from '../../shared/lab-object';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Cheap VS Code Dark+ tokens — editor overlay only, not a full parser. */
export function highlightLab(code: string, pane: LabPane): string {
  const e = escapeHtml(code);
  if (pane === 'css') {
    return e
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-cmt">$1</span>')
      .replace(/#[0-9A-Fa-f]{3,8}\b/g, '<span class="tok-num">$&</span>')
      .replace(
        /(\b(?:from|in|srgb|deg|infinite|linear|none)\b)/g,
        '<span class="tok-key">$1</span>',
      )
      .replace(/(\b[\w-]+)(?=\s*:)/g, '<span class="tok-attr">$1</span>');
  }
  if (pane === 'html') {
    return e.replace(
      /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:-]+)((?:[^&]|&(?!gt;))*?)(\/?&gt;)/g,
      (
        _full,
        comment: string,
        open: string,
        tag: string,
        rest: string,
        close: string,
      ) => {
        if (comment) return `<span class="tok-cmt">${comment}</span>`;
        return `${open}<span class="tok-tag">${tag}</span><span class="tok-attr">${rest}</span>${close}`;
      },
    );
  }
  return e
    .replace(
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g,
      '<span class="tok-cmt">$1</span>',
    )
    .replace(
      /('(?:\\.|[^\\'])*'|"(?:\\.|[^\\"])*")/g,
      '<span class="tok-str">$1</span>',
    )
    .replace(
      /\b(const|let|var|function|return|document|style|setProperty|undefined|null)\b/g,
      '<span class="tok-key">$&</span>',
    );
}
