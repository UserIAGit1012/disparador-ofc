# Debug

Systematically diagnose and fix a bug.

## Steps
1. **Reproduce** — Understand the symptoms. What's the expected vs actual behavior?
2. **Locate** — Find the relevant code. Use grep, git blame, stack traces.
3. **Hypothesize** — Form a theory about the root cause before changing anything.
4. **Verify** — Confirm the hypothesis by reading code, adding a test, or tracing execution.
5. **Fix** — Make the minimal change that fixes the root cause, not just the symptom.
6. **Test** — Run the test suite. Verify the fix works and nothing else broke.
7. **Log** — Write the bug and fix to today's memory file.

## Rules
- Don't guess-and-check. Understand the bug before fixing it.
- Don't fix symptoms. Find the root cause.
- Don't add defensive code to mask the bug. Fix the actual problem.
- If the fix is non-obvious, add a brief comment explaining why.
- Write a regression test if one doesn't exist for this case.

## Memory Entry Format
```markdown
## Bugs Found
- **Bug:** [description]
- **Root cause:** [why it happened]
- **Fix:** [what was changed]
- **File:** [path:line]
```
