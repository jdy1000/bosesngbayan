# Boses ng Bayan — Claude Code Project Instructions

> These instructions apply to every Claude Code session started from this repository root.

## Mandatory project specification

The authoritative product and engineering requirements are in:

`docs/BOSES_NG_BAYAN_MASTER_SPEC.md`

This file is intentionally imported so the project brief is available in Claude Code context. Read the relevant sections before making a change. The master specification is the source of truth for product scope, public-site behavior, CMS capabilities, access control, editorial workflows, architecture, security, testing, and completion criteria.

@docs/BOSES_NG_BAYAN_MASTER_SPEC.md

## Non-negotiable execution rules

1. **Inspect before changing.** Read the current implementation, relevant docs, Git status, package scripts, and affected files before modifying anything. Preserve working features and existing architectural decisions unless a documented reason justifies a change.
2. **Build real functionality.** Do not replace database-backed behavior with mocks, hardcoded arrays, fake metrics, placeholder handlers, or UI-only controls. If a feature cannot be completed because credentials or external services are missing, implement the safe integration boundary, document the blocker, and continue with independent work.
3. **Treat the specification as acceptance criteria.** Before implementing a feature, identify the relevant requirements in the master spec. After implementing it, verify those requirements against the actual code and behavior.
4. **Self-correct after every failure.** Whenever a command, build, type check, test, migration, API request, browser interaction, or user-reported workflow fails:
   - Stop and capture the exact error and reproduction steps.
   - Re-read the relevant master-spec section and the affected architecture/security documentation.
   - Trace the root cause; do not patch symptoms blindly.
   - Make the smallest safe correction that addresses the cause.
   - Re-run the failing check and relevant regression tests.
   - Inspect the diff for collateral changes.
   - Record the cause, fix, and verification in `progress.txt` or the project's issue log.
   - Do not claim success until the failing case passes.
5. **Do not repeat a failed approach without new evidence.** If the same failure occurs twice, broaden the diagnosis: inspect dependencies, data contracts, environment configuration, permissions, database policies, logs, and related callers before trying another fix.
6. **Security is enforced on the server.** Never rely on hidden buttons, route hiding, or client-side role checks. Enforce permissions in server actions/API handlers and database/storage policies. Never expose service-role keys or secrets to client code.
7. **No fake completion.** A page rendering is not proof that a feature works. Verify persistence, authorization, state transitions, error handling, and the relevant public/admin experience.
8. **Keep docs truthful.** Update documentation when implementation decisions change. Do not document planned behavior as completed behavior.
9. **Keep the implementation maintainable.** Use strict types, small modules, validation, reusable components, and consistent data-access boundaries. Avoid giant components, unsafe casts, and duplicate business logic.
10. **Respect the existing repository.** Do not overwrite user work, discard uncommitted changes, reset branches, or run destructive database/Git commands without explicit authorization.

## Required error-recovery protocol

Use this loop whenever you encounter a defect or an acceptance test fails:

`Observe → Reproduce → Read requirements → Diagnose root cause → Fix → Verify → Regression-check → Document`

Before editing after a failure, answer these questions internally and make the answers evident in your work:

- What exactly failed, and how can it be reproduced?
- Which requirement in `docs/BOSES_NG_BAYAN_MASTER_SPEC.md` governs this behavior?
- Is the failure in the UI, API contract, server logic, database schema, RLS, storage policy, authentication, authorization, configuration, or deployment?
- What is the root cause, rather than the visible symptom?
- Which targeted test proves the fix?
- Which adjacent workflows could have regressed?

If the issue reveals a gap or contradiction in the specification, do not silently invent a product rule. Choose the safest consistent interpretation, document the decision in `docs/ARCHITECTURE.md` or an appropriate decision log, and update the master spec if the product requirement has genuinely changed. Do not weaken security or acceptance criteria just to make a test pass.

## Required checkpoints

At the end of each meaningful implementation phase:

1. Run the applicable formatter, lint, type check, tests, and build commands that exist in the repository.
2. Review the Git diff and inspect changed files for accidental scope creep, leaked secrets, dead controls, and hardcoded CMS content.
3. Verify the corresponding acceptance criteria in the master spec.
4. Update `progress.txt` with completed work, checks run, results, known defects, and next steps.
5. Mark a phase complete only when its criteria have actually passed.

## Completion report requirements

When asked to finish or report status, distinguish clearly between:

- Implemented and verified.
- Implemented but not fully verified.
- Blocked by missing credentials/services.
- Not implemented.

Include the exact checks run and their outcomes. Never invent passing tests, analytics, data, or deployment status.
