## Cross-check before "done" (Mapulon · 16 Oct 2026)

Nothing is reported **done** until a **different model** has checked it.

- Claude checks Codex work; Codex checks Claude work. Same-family self-check does not count.
- A fix loop that makes **no progress for 2 rounds** stops and is flagged to **Control**.
- **Control** lanes write the task as a **step-by-step workflow script** first, then hand scanning / mechanical passes to cheap parallel workers.

Do not invent flags that are not on the CLI. Claude Code `--effort` accepts `low | medium | high | xhigh | max` only.
