@AGENTS.md

## Git sync protocol

GitHub is the source of truth. Local checkouts can be stale.

At the start of each task, and again before the first edit:
1. `git fetch origin`, then `git status --porcelain --branch`.
2. If there are uncommitted changes you didn't make, stop and report them.
   Never stash, discard, or commit them without permission.
3. If the branch has diverged from its upstream, stop and report it.
   Never rebase, merge, or force-push without permission.
4. If behind, `git pull --ff-only`.
5. Start new work on a branch cut from freshly fetched `origin/main`.
   Never commit or push directly to `main`.
6. State in one line that you're up to date (branch + short SHA).
   A new branch with no upstream yet is fine.

Recheck after the user says they pushed from another machine, or after a
non-fast-forward push rejection.

When work is done: commit, push the branch (never force-push without
permission), open a PR, and give the branch name, commit SHA, PR link, and
the commands to pull it locally.

A cloud session can't see unpushed work on the user's laptop. If something
looks missing, say so and ask them to push. Don't recreate it.
