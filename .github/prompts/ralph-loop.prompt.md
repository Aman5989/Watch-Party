---
name: Ralph Loop
description: "Iterate on one well-defined coding task and verify it, with a strict iteration limit."
argument-hint: "Task, acceptance criteria, and iteration limit (default 5)"
agent: "agent"
---

Work on this task using a bounded Ralph-style iteration loop:

**Task:** ${input:task:Describe one task with clear acceptance criteria}
**Iteration limit:** ${input:iterations:5}

For each iteration:
1. Inspect the relevant code and identify the smallest next change.
2. Implement only changes needed for the stated task.
3. Run the narrowest relevant checks and examine their actual results.
4. If a check fails, diagnose and fix it in the next iteration.
5. Stop early when every acceptance criterion is met and the checks pass.

Never exceed the requested iteration limit. Do not repeat an unchanged failed
approach. If blocked or still failing at the limit, stop and report what remains,
what was tried, and the exact verification output. Do not claim success without
verification. Do not commit or deploy.
