# Write Tests

Write tests for the specified code.

## Steps
1. **Read** the code to understand what it does
2. **Identify** the testing approach used in this project (framework, patterns, file locations)
3. **Plan** test cases:
   - Happy path (normal expected usage)
   - Edge cases (empty input, boundary values, null/undefined)
   - Error cases (invalid input, network failures, missing data)
4. **Write** tests following existing patterns in the project
5. **Run** the test suite to verify they pass

## Rules
- Follow the project's existing test patterns and conventions
- Test behavior, not implementation details
- One assertion per test when possible
- Use descriptive test names that explain the expected behavior
- Don't mock what you don't own — use integration tests for external dependencies when feasible
- Don't test framework behavior or library internals
- Don't write tests for trivial code (simple getters, pass-through functions)
