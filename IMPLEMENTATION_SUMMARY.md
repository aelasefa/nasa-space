# Main synchronization and Docker setup

Date: 2026-11-14

## Source and preservation

- Imported `mtourham/nasa-space:main` at
  `48ad6e1976bb1e3eece7174774941150f1f3ef9b` into `aelasefa/nasa-space:main`.
- Adopted the friend's `frontend/` and `backend/` layout, including its latest
  UI changes. Domain and API source files were preserved in `backend/src/`.
- Used a normal merge instead of a destructive reset; both histories remain.
- Preserved the previous main at local branch
  `codex/backup-main-before-frontend-docker-20261114`.
- Retained the existing uncommitted `run.sh` improvements: strict shell mode,
  script-relative paths, dependency checks, bounded health waits, curl timeouts,
  and correctly expanded container test paths. They are included in this change.
- No merge conflicts, force pushes, hard resets, or volume deletions were needed.

## Docker and script changes

- Added `frontend/Dockerfile`: Node builds the React/Vite app, then Nginx serves
  the static output on port 8080 as an unprivileged user (UID 101).
- The frontend build context is the repository root because the app imports the
  domain engine from `backend/src/`.
- Added `frontend/nginx.conf`: frontend health endpoint `/healthz`, SPA fallback,
  static assets, and `/api/` proxying to `backend:3000`.
- Compose builds the backend from `backend/` and starts the frontend after the
  backend is healthy. An optional `frontend-tests` service uses the `test` profile.
- Added root and backend `.dockerignore` files to exclude dependencies, generated
  output, environment files, and other local-only content from build contexts.
- Updated `run.sh` to manage both apps and run both test suites.
- Updated README and integration instructions for the new workflow.

## Validation results

| Check | Result |
|---|---|
| Shell syntax and invalid-command handling | Passed |
| Compose configuration | Passed |
| Backend Docker build | Passed |
| Backend domain suite | 53 tests passed, 0 failed |
| Frontend production Docker build | Passed |
| Frontend TypeScript checking | Passed |
| Frontend suite, including the real-engine mission flow | 12 tests passed across 4 files |
| Frontend lint | Passed: 0 errors, 7 warnings |
| `./run.sh up` | Passed; both services healthy |
| Frontend HTML, JavaScript, CSS, and SPA fallback | Passed |
| Backend health and API catalog through the frontend proxy | Passed |
| Mission simulation through the frontend proxy | Passed: success |
| Exhaustive API matrix | Passed: 128 combinations accounted for |
| Nginx runtime user | Verified UID 101 |
| Dependency audits during Docker installation | 0 reported vulnerabilities |

## Issues encountered

The first Docker test run linted installed dependencies because repository-level
Git ignore rules were unavailable in the image. Added explicit `node_modules/**`
and `dist/**` ignore patterns to the frontend Oxlint configuration. The complete
test command then passed.

Remaining non-blocking issues:

- Seven existing frontend lint warnings: six Fast Refresh export warnings and
  one ref-update-during-render warning.
- Vite reports that the lazy-loaded Three.js scene chunk exceeds 500 kB.
- The host filesystem is nearly full. Less than 200 MB remained during final
  validation. Free space before further dependency installations or large builds.
  Unrelated Docker images, caches, containers, and volumes were not pruned.

## Usage

```bash
./run.sh up
./run.sh test
./run.sh logs
./run.sh down
```

- Frontend: <http://localhost:8080>
- Backend: <http://localhost:3000>
- Frontend API proxy: <http://localhost:8080/api/catalog>
- Optional frontend port override: `FRONTEND_PORT=8081 ./run.sh up`.

Both services were left running after validation. `down` stops the stack without
requesting volume deletion.
