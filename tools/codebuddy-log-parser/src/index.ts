#!/usr/bin/env node
/**
 * CodeBuddy stream-json (JSONL) → human-readable or aggregated JSON.
 * CLI: node dist/index.js --stdin [--stream] [-f human-chat|json] [--no-color]
 */
import * as readline from 'readline';

type Format = 'human-chat' | 'json';

function parseArgs(argv: string[]): {
  stdin: boolean;
  stream: boolean;
  format: Format;
  noColor: boolean;
} {
  let stdin = false;
  let stream = false;
  let format: Format = 'human-chat';
  let noColor = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stdin') stdin = true;
    else if (a === '--stream') stream = true;
    else if (a === '--no-color') noColor = true;
    else if (a === '-f' || a === '--format') {
      const v = argv[++i];
      if (v === 'json' || v === 'human-chat') format = v;
    }
  }
  return { stdin, stream, format, noColor };
}

function extractText(line: unknown): string {
  if (line === null || typeof line !== 'object') return '';
  const o = line as Record<string, unknown>;
  const parts: string[] = [];

  const pushStr = (v: unknown) => {
    if (typeof v === 'string' && v.length) parts.push(v);
  };

  const walkContent = (content: unknown) => {
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.type === 'text' && typeof b.text === 'string') pushStr(b.text);
      else if (typeof b.text === 'string') pushStr(b.text);
    }
  };

  if (o.message && typeof o.message === 'object') {
    const m = o.message as Record<string, unknown>;
    walkContent(m.content);
  }

  const delta = o.delta;
  if (delta && typeof delta === 'object') {
    const d = delta as Record<string, unknown>;
    if (typeof d.text === 'string') pushStr(d.text);
  }

  pushStr(o.text);
  if (typeof o.content === 'string') pushStr(o.content);
  if (typeof o.result === 'string') pushStr(o.result);

  return parts.join('');
}

function lineLabel(type: string | undefined, role: string | undefined): string {
  const t = type || 'unknown';
  const r = role || '';
  if (t === 'assistant' || r === 'assistant') return '[assistant]';
  if (t === 'user' || r === 'user') return '[user]';
  if (t === 'system' || t === 'init' || t === 'result') return `[${t}]`;
  return `[${t}]`;
}

async function main(): Promise<void> {
  const { stdin, stream, format, noColor: _noColor } = parseArgs(process.argv.slice(2));
  void _noColor;
  if (!stdin) {
    console.error('codebuddy-log-parser: use --stdin');
    process.exit(2);
  }

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const records: unknown[] = [];
  let humanBuf = '';

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      if (format === 'json') continue;
      if (stream) process.stdout.write(trimmed + '\n');
      else humanBuf += trimmed + '\n';
      continue;
    }
    records.push(obj);

    if (format === 'json') continue;

    const o = obj as Record<string, unknown>;
    const type = typeof o.type === 'string' ? o.type : undefined;
    const msg = o.message as { role?: string } | undefined;
    const role = msg?.role;
    const text = extractText(obj);
    if (!text) continue;

    if (stream) {
      process.stdout.write(text);
    } else {
      humanBuf += `${lineLabel(type, role)} ${text}\n`;
    }
  }

  if (format === 'json') {
    process.stdout.write(JSON.stringify({ lines: records }, null, 2) + '\n');
    return;
  }

  if (!stream) process.stdout.write(humanBuf);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
