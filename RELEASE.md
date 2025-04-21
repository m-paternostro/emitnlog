# Release

This project uses [Changesets](https://github.com/changesets/changesets) to automate versioning, changelogs, and releases. This document outlines the release workflow for contributors.

---

## 🧠 Overview: How It Works

1. When making changes that affect the public API or behavior, **create a changeset**.
2. Merging PRs with changesets will prompt the CI to open a **Version Packages PR**.
3. Merging the Version Packages PR:
   - Bumps `package.json` versions
   - Updates the changelog
   - Triggers an automatic release to npm

No tags, no manual version bumps, no manual publishing — it's all handled for you.

---

## ✍️ Creating a Changeset

Before merging a PR with public changes (new features, fixes, etc.), run:

```bash
npx changeset
```
