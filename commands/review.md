# Code Review

Review the specified code for quality, correctness, and maintainability.

## Steps
1. Read the file(s) or diff to review
2. Check for:
   - Logic errors or edge cases
   - Security vulnerabilities (injection, XSS, CSRF, etc.)
   - Performance issues (N+1 queries, unnecessary re-renders, memory leaks)
   - Missing error handling at system boundaries
   - Code that contradicts existing patterns in the codebase
   - Overly complex code that could be simplified
3. Check test coverage — are critical paths tested?
4. Verify naming consistency with the rest of the codebase

## Output Format
For each issue found:
- **File:Line** — Description of the issue
- **Severity:** critical | warning | nit
- **Suggestion:** How to fix it

End with a summary: approve, request changes, or comment.

## Rules
- Don't nitpick formatting if there's a formatter configured
- Don't suggest adding comments to self-explanatory code
- Focus on bugs and logic issues over style preferences
- If everything looks good, say so briefly — don't invent issues
