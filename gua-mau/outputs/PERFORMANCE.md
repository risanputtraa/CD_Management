# Performance changes — build 0026

- API state snapshots are cached by authenticated user and database revision. Tokens cannot be reused across users. Missing/expired tokens fall back to a full snapshot.
- New clients send snapshot tokens instead of hashing the full browser state on every save.
- Saves and polling return changed rows, deleted IDs, and ordering changes. The initial load still loads the full workspace.
- Existing conflict baselines and the five-second update polling remain enabled, including background notification updates. Polling cannot overwrite an in-flight save.
- Unchanged rows retain client object identity; notification-only updates avoid rebuilding unrelated pages.
- Reporting hierarchy and visible timer lookups use cached indexes. Work Performance source calculations are reused until their inputs change.
- General Task names wrap without truncation.

## Validation

Run node --test --test-isolation=none tests/state-sync.test.js tests/work-performance.test.js tests/employment-type.test.js tests/working-time.test.js.
Run node tests/state-sync-integration.js for a separate server and copied database; it changes no live task data.

One local comparison with 24,348 tasks: legacy save response 13,374,325 bytes / 708 ms plus 174 ms client hashing; new delta response 11,596 bytes / 403 ms. These are individual local observations, not production guarantees.

## Remaining architectural work

The initial workspace snapshot remains about 25 MB before compression. Server-side pagination and dedicated aggregate dashboard endpoints require migrating the list and dashboard data contracts; they are not implemented in this build.
