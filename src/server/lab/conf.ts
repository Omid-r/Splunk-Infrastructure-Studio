// Splunk-style .conf parser/serializer with merge and diff — lab-only, no vendor code.

export type ConfDoc = Record<string, Record<string, string>>;

export function parseConf(text: string): ConfDoc {
  const doc: ConfDoc = {};
  let stanza = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const m = /^\[(.+)\]$/.exec(line);
    if (m) {
      stanza = m[1];
      if (!doc[stanza]) doc[stanza] = {};
      continue;
    }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    if (!doc[stanza]) doc[stanza] = {};
    doc[stanza][kv[1].trim()] = kv[2].trim();
  }
  return doc;
}

export function serializeConf(doc: ConfDoc): string {
  const lines: string[] = [];
  const top = doc[''];
  if (top && Object.keys(top).length > 0) {
    for (const [k, v] of Object.entries(top)) lines.push(`${k} = ${v}`);
    lines.push('');
  }
  for (const [stanza, props] of Object.entries(doc)) {
    if (stanza === '') continue;
    lines.push(`[${stanza}]`);
    for (const [k, v] of Object.entries(props)) lines.push(`${k} = ${v}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function mergeConf(base: ConfDoc, overlay: ConfDoc): ConfDoc {
  const out: ConfDoc = {};
  for (const [s, props] of Object.entries(base)) out[s] = { ...props };
  for (const [s, props] of Object.entries(overlay)) {
    out[s] = { ...(out[s] ?? {}), ...props };
  }
  return out;
}

export interface ConfDiffEntry {
  stanza: string;
  key: string;
  from: string | null;
  to: string | null;
  kind: 'added' | 'removed' | 'changed';
}

export function diffConf(before: ConfDoc, after: ConfDoc): ConfDiffEntry[] {
  const entries: ConfDiffEntry[] = [];
  const stanzas = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const s of stanzas) {
    const b = before[s] ?? {};
    const a = after[s] ?? {};
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const k of keys) {
      const bv = b[k] ?? null;
      const av = a[k] ?? null;
      if (bv === av) continue;
      entries.push({
        stanza: s,
        key: k,
        from: bv,
        to: av,
        kind: bv === null ? 'added' : av === null ? 'removed' : 'changed',
      });
    }
  }
  return entries;
}

export function formatDiff(entries: ConfDiffEntry[]): string {
  if (entries.length === 0) return 'هیچ تغییری وجود ندارد';
  return entries
    .map((e) => {
      const label = e.stanza ? `[${e.stanza}] ${e.key}` : e.key;
      if (e.kind === 'added') return `+ ${label} = ${e.to}`;
      if (e.kind === 'removed') return `- ${label} = ${e.from}`;
      return `~ ${label}: ${e.from} → ${e.to}`;
    })
    .join('\n');
}

// btool-style view: merge default (base) and local (overlay) like Splunk's precedence.
export function btoolView(defaults: ConfDoc, locals: ConfDoc): string {
  const merged = mergeConf(defaults, locals);
  const out: string[] = [];
  for (const [stanza, props] of Object.entries(merged)) {
    out.push(`[${stanza || 'DEFAULT'}]`);
    for (const [k, v] of Object.entries(props)) {
      const overridden = locals[stanza]?.[k] !== undefined ? '   (local)' : '';
      out.push(`    ${k} = ${v}${overridden}`);
    }
    out.push('');
  }
  return out.join('\n');
}
