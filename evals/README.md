# Evals

The audit questions behind the testing notes in the post. Each case in `cases.json` has:

- `question`, and optionally `task` (`today`, `changed`, `eat`, `sitter`, `visit`), `date` and `checkins`, the same fields the site sends to `/api/chat`
- `why`: the failure or guardrail it exists for. Several are real failures from the first two rounds of testing (blueberries, the invented 400-600 copper row, Atopica, the empty "today" answer)
- `expect`: patterns the answer must `include` or must not contain (`exclude`), and sometimes the agent `mode` (`scope-gate`)

```bash
cd web && npm run dev                           # or any deployed copy
node evals/run.mjs                              # http://localhost:3000
node evals/run.mjs https://steadywag.com A1,A10 # only some cases
```

Every answer is also checked for the rules that must hold everywhere: it finishes, it is not empty, it does not diagnose, and it does not tell the family to start or stop a medication.

**What this is and isn't.** These are smoke checks. A pattern match cannot tell you an answer is good, only that it didn't fall into a known trap. Read the answers too. Each case is one real model call (about 20 seconds, a few cents), and wording varies between runs, so a rare FAIL is a reason to read the answer, not proof of a bug. Needs Node 20 or newer, and a server with `ANTHROPIC_API_KEY` set.
