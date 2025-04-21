# Release

This project uses [Changesets](https://github.com/changesets/changesets) to automate versioning, changelogs, and releases. This document outlines the release workflow for contributors.

---

## 🧠 Overview: How It Works

1. When making changes that affect the public API or behavior, **create a changeset**.
2. Merging PRs with changesets will prompt the CI to open a **Version Packages PR**.
3. Merging the Version Packages PR finalizes versioning and changelogs. To publish, create a git tag like `v0.1.0` and push it to trigger the release workflow.

No manual version bumps or changelog edits — Changesets handles those. Publishing is triggered by pushing a version tag.

---

## ✍️ Creating a Changeset

Before merging a PR with public changes (new features, fixes, etc.), run:

```bash
npm run changeset
```

---

## 🚀 Triggering the Release

Before creating a git tag, verify that the version you want to release matches the version declared in `package.json`.

After merging the Version Packages PR to `main`, you can publish a new release by creating and pushing a git tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Replace `v0.1.0` with the desired version. This version should match the version in `package.json`. This will trigger the release workflow and publish the package.
