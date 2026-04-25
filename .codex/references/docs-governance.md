# Docs Governance Reference

- `README.md`
  - Project entry, document map, and development baseline.
- `Discussion.md`
  - Open discussion, tradeoffs, and undecided product or architecture questions.
- `docs/architecture-boundary.md`
  - Architecture boundaries, module ownership, and responsibility split.
- `docs/parity-contract.md`
  - Compatibility contract with the original Python app.
- `docs/backlog.md`
  - Capability-level master backlog and global scheduling view. Do not put detailed checklist items here.
- `docs/backlog-active.md`
  - Current work, near-term open work, and executable checklist items.
- `docs/backlog-archive.md`
  - Completed capabilities and historical boundaries that still have reference value.
- `docs/dev_log.md`
  - Version nodes and meaningful completed changes.

## Backlog Sync Rule

When any of `docs/backlog.md`, `docs/backlog-active.md`, or `docs/backlog-archive.md` changes, check all three files for logical conflicts and required synchronization.

- Keep `docs/backlog.md` at capability-summary level.
- Keep detailed tasks, open work, and acceptance checklist items in `docs/backlog-active.md`.
- Move completed capabilities that no longer need daily tracking to `docs/backlog-archive.md`.
- Do not duplicate detailed checklist items across `backlog.md` and `backlog-active.md`.
