# Release Runbook

Use this when turning merged work on `main` into a GitHub release and installer build.

The release workflow is `.github/workflows/release.yml`. It runs when a tag matching `v*` is pushed.

## Preflight

1. Make sure local checkout is on `main`.

```bash
git checkout main
git pull --ff-only origin main
```

2. Confirm the intended PRs are merged.

```bash
gh pr list --repo crozo1x/baseplate --state merged --limit 10
```

3. Confirm working tree is clean.

```bash
git status --short
```

4. Run tests.

```bash
npm test
```

5. If packaging changed, regenerate icons and smoke packaging.

```bash
npm run icon
npm run pack:win
```

If dependencies are not installed:

```bash
npm install
```

## Version Bump

Pick the next patch version unless there was a breaking change.

Example for `0.1.3`:

```bash
npm version 0.1.3 --no-git-tag-version
```

This updates `package.json` and `package-lock.json`. Verify both changed.

```bash
git diff -- package.json package-lock.json
```

Commit the version bump:

```bash
git add package.json package-lock.json
git commit -m "Release v0.1.3"
```

## Tag and Push

Create and push the release tag:

```bash
git tag v0.1.3
git push origin main
git push origin v0.1.3
```

The tag push triggers the Release workflow.

## Watch the Workflow

```bash
gh run list --repo crozo1x/baseplate --workflow Release --limit 5
gh run watch --repo crozo1x/baseplate <run-id>
```

If the workflow fails, inspect logs:

```bash
gh run view --repo crozo1x/baseplate <run-id> --log-failed
```

Do not delete and recreate tags until the failure is understood.

## Verify Release

```bash
gh release view v0.1.3 --repo crozo1x/baseplate
```

Confirm:

- Release exists.
- Installer asset exists.
- Version matches package metadata.
- Release notes mention major user-visible changes.

## Installer Notes

BasePlate currently uses an unsigned Windows installer. Windows SmartScreen may warn users until the project has signing/reputation. Do not claim it is signed unless code signing is actually added.

## Emergency Patch Release

For a release-only fix:

1. Branch from main.
2. Make minimal fix.
3. PR and merge.
4. Bump patch version.
5. Tag and push.

Never release from an unmerged feature branch unless the owner explicitly asks for a pre-release.
