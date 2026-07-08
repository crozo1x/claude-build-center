# Prompt: Codex - Hardening and Integration

You own small, high-confidence engineering improvements while the owner is away.

## Goal

Keep BasePlate safe and shippable while other agents build larger product updates.

## Branch

```bash
git checkout main
git pull --ff-only origin main
git checkout -b agent/hardening-integration
```

## Work Items

Claim these only if they do not conflict with active UI work:

1. Merge or update IPC hardening work if PR #5 is still open.
2. Add tests for deterministic builder/debug helper modules after Sonnet lands them.
3. Add config validation for any new persisted builder state.
4. Add guardrails around terminal launch profiles.
5. Add README/security notes for local command execution boundaries.

## Constraints

- Do not rewrite the renderer while Sonnet/Fable are editing it.
- Prefer pure helper modules and tests.
- Keep changes narrow and independently mergeable.
- Avoid new dependencies.

## Validation

Always run:

```bash
npm test
node --check main.js
```

Also run `node --check` on any changed JS files.

## PR Notes

Call out if your hardening changes affect terminal launches, Rojo sync, or generated script execution. Builder agents need to know if they must use named launch profiles.
