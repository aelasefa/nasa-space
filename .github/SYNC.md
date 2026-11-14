# Automatic upstream sync

The workflow in `workflows/ci.yml` merges `mtourham/nasa-space:main` into
`aelasefa/nasa-space:main`. It checks every 15 minutes and supports a manual
run from Actions → Sync upstream main → Run workflow. Scheduled runs can be
delayed by GitHub, so this is not an immediate push trigger.

## Enable

1. Commit and push the workflow to `aelasefa/nasa-space` on `main`.
2. Create a fine-grained personal access token owned by an account with write
   access to `aelasefa/nasa-space`. Limit repository access to this repository
   and grant Contents: read and write. Grant Workflows: read and write if
   upstream changes to `.github/workflows/` should also be synchronized.
3. In the destination repository, open Settings → Secrets and variables →
   Actions → New repository secret. Name it `SYNC_TOKEN` and paste the token.
   Never commit the token. Renew it before its expiration date.
4. Enable GitHub Actions if disabled (including workflows disabled by default
   on a fork), then run the workflow manually once to verify setup.
5. Branch protection or rulesets must permit this token's account to push to
   `main`. If your rules require pull requests, this direct-sync workflow will
   fail until you use a pull-request-based process or configure an allowed actor.

A personal token is used so pushes can trigger downstream workflows and the
connected Vercel Git integration. Vercel must already be connected to the
destination repository, with `main` as its production branch and deployment
author access configured as required by your Vercel plan.

## Behavior

- Preserves destination commits through a normal Git merge; never force-pushes.
- Stops without pushing if histories are unrelated or there are merge conflicts.
- Does not run code or install dependencies from upstream during synchronization.
- Skips runs in repositories other than `aelasefa/nasa-space`.
- Public repositories can have schedules disabled after 60 days of inactivity;
  re-enable the workflow in Actions when needed.

## Immediate updates (optional upstream setup)

For immediate updates, an administrator of `mtourham/nasa-space` can configure
a workflow triggered by pushes to its `main` to send a GitHub
`repository_dispatch` event to `aelasefa/nasa-space` with event type
`upstream-main-updated`. That requires a destination-authorized credential
stored in the upstream repository. The scheduled workflow works independently
and does not require changing the upstream repository.
