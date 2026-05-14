## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at root, `docs/adr/` at root. See `docs/agents/domain.md`.

## GitHub issue workflow

For every new feature, bugfix, or GitHub issue task, create a dedicated branch from an up-to-date main branch before editing files, keep the branch scoped to that one issue, commit only those changes, push the branch, and open a pull request. Do not commit directly to main unless explicitly asked.

Read CONTEXT.md before starting unattended GitHub issue work. It defines the branch, TDD, pull request, merge-conflict, and issue-creation loop.
