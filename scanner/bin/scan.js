#!/usr/bin/env node
/*
 * shipcheck — a fast, dependency-free pre-ship security scan for app code.
 * Built for the "I just shipped an app (maybe with an AI) — did I leave anything
 * dangerous in it?" moment. Deterministic checks only: no AI at runtime, no API
 * key, no code execution. It reads your files and looks for the highest-signal
 * mistakes, then tells you where and how to fix them.
 *
 * Usage:  npx shipcheck [path]        (defaults to ".")
 *         npx shipcheck --json        (machine-readable output, for CI)
 *
 * Exit code: 0 if no HIGH findings, 1 otherwise — so it fails a CI build on a
 * real problem but not on advisories.
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ---- config ----------------------------------------------------------------
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'vendor', 'coverage',
  '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.mypy_cache', '.cache',
]);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.php',
  '.java', '.env', '.yml', '.yaml', '.json', '.cfg', '.ini', '.sh', '.tf',
]);
const MAX_BYTES = 1000000; // skip files > 1MB (likely generated/minified)

// Obvious non-secret placeholder values — never flag these as hardcoded secrets.
// (This is the "don't cry wolf" list: e.g. Flask's docstring `SECRET_KEY = 'development key'`.)
const PLACEHOLDERS = new Set([
  'development key', 'dev', 'devkey', 'changeme', 'change-me', 'secret',
  'password', 'your-secret-key', 'your_secret_key', 'yoursecret', 'xxx', 'todo',
  'example', 'placeholder', 'none', 'null', 'test', 'testing', 'supersecret-change-this',
]);

// ---- checks -----------------------------------------------------------------
// Each check: id, severity (high|medium|low), title, regex, fix. `skipComment`
// means "don't fire on a line that is clearly a comment" (reduces doc-example noise).
const CHECKS = [
  {
    id: 'weak-secret-fallback', severity: 'high',
    title: 'Secret falls back to a hardcoded default',
    // process.env.JWT_SECRET || 'superSecret'   /   os.environ.get('SECRET_KEY', 'x')
    re: /(?:(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PASSWD|PRIVATE[_-]?KEY)\w*)\s*(?:\|\||,)\s*['"`]([^'"`]{4,})['"`]/i,
    valGroup: 1, skipComment: false,
    fix: 'Never ship a fallback secret — a missing env var should crash at startup, not sign tokens with a public default.',
  },
  {
    id: 'hardcoded-secret', severity: 'high',
    title: 'Hardcoded secret / credential in source',
    re: /(?:secret|password|passwd|api[_-]?key|access[_-]?key|token|private[_-]?key)\s*[:=]\s*['"`]([^'"`\s]{6,})['"`]/i,
    valGroup: 1, skipComment: true,
    fix: 'Move it to an environment variable or a secrets manager; rotate it if it was ever committed.',
  },
  {
    id: 'aws-access-key', severity: 'high',
    title: 'AWS access key id in source',
    re: /\bAKIA[0-9A-Z]{16}\b/, skipComment: false,
    fix: 'Revoke this key in AWS immediately and load credentials from the environment or an IAM role.',
  },
  {
    id: 'private-key-block', severity: 'high',
    title: 'Private key committed to the repo',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, skipComment: false,
    fix: 'Remove the key from the repo and history, and rotate it — committed private keys are compromised.',
  },
  {
    id: 'dangerous-eval', severity: 'medium',
    title: 'Dynamic code execution (eval/exec) — review if any input is untrusted',
    re: /\b(?:eval\(|exec\(|pickle\.loads\(|yaml\.load\((?!.*Safe)|child_process\.exec\(|os\.system\()/,
    skipComment: true,
    fix: 'Safe if the input is fully trusted (e.g. loading your own config). Dangerous on request data — prefer a parser, yaml.safe_load, or execFile with an argument array.',
  },
  {
    id: 'shell-injection', severity: 'high',
    title: 'Shell command built from a variable (injection risk)',
    re: /(?:subprocess\.(?:call|run|Popen)\([^)]*shell\s*=\s*True|exec(?:Sync)?\(\s*[`'"][^`'"]*\$\{)/,
    skipComment: true,
    fix: 'Pass arguments as an array and disable shell interpolation; never concatenate user input into a shell string.',
  },
  {
    id: 'sql-string-concat', severity: 'high',
    title: 'SQL query built by string concatenation (injection risk)',
    re: /(?:execute|query)\(\s*(?:f?['"`][^'"`]*(?:SELECT|INSERT|UPDATE|DELETE)[^'"`]*['"`]\s*(?:\+|%|\.format|,\s*\()|['"`][^'"`]*(?:SELECT|INSERT|UPDATE|DELETE)[^'"`]*['"`]\s*\+)/i,
    skipComment: true,
    fix: 'Use parameterized queries / prepared statements — never build SQL by concatenating input.',
  },
  {
    id: 'react-dangerous-html', severity: 'medium',
    title: 'dangerouslySetInnerHTML (XSS risk)',
    re: /dangerouslySetInnerHTML/, skipComment: true,
    fix: 'Render text as children, or sanitize the HTML with a vetted sanitizer before injecting it.',
  },
  {
    id: 'debug-enabled', severity: 'medium',
    title: 'Debug mode enabled',
    re: /(?:debug\s*=\s*True|DEBUG\s*[:=]\s*True|app\.run\([^)]*debug\s*=\s*True)/,
    skipComment: true,
    fix: 'Never run with debug on in production — it exposes stack traces and, in some frameworks, remote code execution.',
  },
  {
    id: 'insecure-cookie', severity: 'medium',
    title: 'Cookie/session not marked Secure',
    re: /(?:SESSION_COOKIE_SECURE\s*[:=]\s*False|secure\s*:\s*false|httpOnly\s*:\s*false)/i,
    skipComment: true,
    fix: 'Set Secure and HttpOnly on session cookies in production (behind HTTPS); consider SameSite=Lax.',
  },
  {
    id: 'cors-wildcard', severity: 'medium',
    title: 'CORS allows any origin (*)',
    re: /(?:Access-Control-Allow-Origin['"]\s*[:,]\s*['"]\*|origin\s*:\s*['"]\*['"]|cors\(\s*\))/,
    skipComment: true,
    fix: 'Restrict CORS to an explicit allowlist of origins instead of "*", especially with credentials.',
  },
];

// ---- scanning ---------------------------------------------------------------
function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*');
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (TEXT_EXT.has(ext) || e.name === '.env') yield full;
    }
  }
}

function scanFile(file, findings) {
  let stat;
  try { stat = fs.statSync(file); } catch { return; }
  if (stat.size > MAX_BYTES) return;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (let ci = 0; ci < text.length; ci++) { if (text.charCodeAt(ci) === 0) return; } // NUL => binary
  const lines = text.split(/\r?\n/);
  let inDoc = false, docDelim = null; // track Python triple-quoted docstrings/examples
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineInDoc = inDoc; // state at the START of this line
    const delim = inDoc ? docDelim : (line.match(/"""|'''/) || [])[0];
    if (delim) {
      const count = line.split(delim).length - 1;
      if (count % 2 === 1) { inDoc = !inDoc; docDelim = inDoc ? delim : null; }
    }
    if (line.length > 500) continue; // minified line, skip
    for (const check of CHECKS) {
      check.re.lastIndex = 0;
      const m = check.re.exec(line);
      if (!m) continue;
      if (check.skipComment && (isComment(line) || lineInDoc)) continue;
      if (check.valGroup && m[check.valGroup]) {
        const val = m[check.valGroup].toLowerCase();
        if (PLACEHOLDERS.has(val)) continue;             // obvious placeholder → not a secret
        if (/^(process\.env|os\.environ|import\.meta)/i.test(val)) continue;
        if (val.length < 6 && check.id === 'hardcoded-secret') continue;
      }
      findings.push({
        check: check.id, severity: check.severity, title: check.title,
        file, line: i + 1, snippet: line.trim().slice(0, 140), fix: check.fix,
      });
    }
  }
}

// ---- reporting --------------------------------------------------------------
const useColor = process.stdout.isTTY;
const paint = (code) => (s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s);
const C = { red: paint(31), yel: paint(33), dim: paint(2), bold: paint(1), grn: paint(32), cyan: paint(36) };

const SEV_ORDER = { high: 0, medium: 1, low: 2 };
const SEV_LABEL = { high: C.red('HIGH  '), medium: C.yel('MEDIUM'), low: C.dim('LOW   ') };

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const target = args.find(a => !a.startsWith('-')) || '.';
  const root = path.resolve(target);

  const findings = [];
  let files = 0;
  for (const f of walk(root)) { files++; scanFile(f, findings); }
  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.file.localeCompare(b.file));

  if (asJson) {
    console.log(JSON.stringify({ scanned_files: files, findings }, null, 2));
  } else {
    console.log(`\n  ${C.bold('shipcheck')} ${C.dim('— pre-ship security scan')}`);
    console.log(`  ${C.dim(`scanned ${files} files in ${path.relative(process.cwd(), root) || '.'}`)}\n`);
    if (!findings.length) {
      console.log(`  ${C.grn('✓ No issues found.')} ${C.dim('(Deterministic checks only — not a guarantee.)')}\n`);
    } else {
      for (const f of findings) {
        const loc = `${path.relative(root, f.file)}:${f.line}`;
        console.log(`  ${SEV_LABEL[f.severity]}  ${C.bold(f.title)}`);
        console.log(`          ${C.cyan(loc)}`);
        console.log(`          ${C.dim(f.snippet)}`);
        console.log(`          ${C.dim('fix: ' + f.fix)}\n`);
      }
      const high = findings.filter(f => f.severity === 'high').length;
      const med = findings.filter(f => f.severity === 'medium').length;
      console.log(`  ${C.bold('Summary:')} ${high ? C.red(high + ' high') : '0 high'}, ${med ? C.yel(med + ' medium') : '0 medium'}.`);
      console.log(`  ${C.dim('Free scan. A full reasoned audit of these findings + fixes is the paid tier.')}\n`);
    }
  }
  process.exit(findings.some(f => f.severity === 'high') && !asJson ? 1 : 0);
}

main();
