# shipcheck

**A 5-second security gut-check for code you're about to ship** — especially code
you (or an AI) wrote fast. It reads your files and flags the highest-signal
mistakes: secrets with hardcoded fallbacks, committed keys, dynamic-execution
risks, debug mode left on, insecure cookies, wildcard CORS.

No AI at runtime. No API key. No account. It never runs your code — it only reads
it. One command:

```bash
npx shipcheck            # scan the current directory
npx shipcheck ./src      # scan a path
npx shipcheck --json     # machine-readable, for CI
```

Exit code is non-zero when a **HIGH** finding is present, so you can drop it into a
CI step or a pre-commit hook and fail the build on a real problem.

## What it checks (free tier)

| Check | Severity | Catches |
|---|---|---|
| Weak secret fallback | high | `process.env.JWT_SECRET \|\| 'superSecret'` and friends |
| Hardcoded secret | high | secrets/passwords/API keys pasted into source |
| AWS key / private key | high | `AKIA…` ids and committed `PRIVATE KEY` blocks |
| Dynamic execution | medium | `eval` / `exec` / `pickle.loads` / unsafe `yaml.load` |
| Shell / SQL injection shape | high | shell strings and SQL built by concatenation |
| Debug mode on | medium | `debug=True`, `DEBUG = True` |
| Insecure cookie | medium | `secure: false`, `SESSION_COOKIE_SECURE = False` |
| Wildcard CORS | medium | `Access-Control-Allow-Origin: *` |

It works hard **not** to cry wolf: obvious placeholder values (`'development key'`,
`'changeme'`) and documentation/docstring examples are deliberately ignored.

## What it is not

Deterministic checks are a fast first pass, **not** a guarantee and **not** a
replacement for a real security review. shipcheck finds common, high-signal
mistakes; it does not understand your app's logic, so it will miss design and
authorization bugs that need a human (or a deeper, reasoned audit).

> **Paid tier (coming):** submit a repo and get a full, *reasoned* audit — a
> human-readable report that explains each finding, checks the things a regex
> can't (auth/authorization logic, trust boundaries), clears the false positives,
> and hands you a prioritized fix list.

MIT licensed. Built in the open.
