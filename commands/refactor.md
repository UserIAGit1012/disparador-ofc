# Refactor

Improve code structure without changing behavior.

## Steps
1. **Understand** — Read the code thoroughly. Understand what it does and why.
2. **Identify** — What specific problem does this refactor solve? (duplication, complexity, poor naming, etc.)
3. **Plan** — Describe the refactor approach before starting. Get alignment.
4. **Test first** — Ensure tests pass before making changes. If no tests exist, write them first.
5. **Refactor** — Make changes in small, verifiable steps.
6. **Verify** — Run tests after each step. No behavior should change.
7. **Document** — If the refactor changes how something works, update relevant docs.

## Rules
- Never refactor and add features in the same change
- Keep each step small enough to verify independently
- If tests don't exist, write them before refactoring — not after
- Don't rename things just because you prefer a different name
- Don't abstract until you have at least 3 concrete cases
- Match existing code patterns unless there's a clear reason to change them
