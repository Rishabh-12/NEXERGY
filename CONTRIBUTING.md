# Contributing to NexEnergy

Thanks for helping improve the Smart Campus Energy Optimizer.

## Before you start

- Check the README for frontend/backend setup and deployment details.
- For a larger change, open an issue first to agree on the scope.
- Keep changes focused and preserve current API behavior unless an API change is intentional and documented.

## Local development

Run the FastAPI backend and Vite frontend in separate terminals as described in the [README](README.md#run-locally). The frontend is in `Frontend/part 2`; the backend is in `Backend`.

Before submitting frontend changes, run:

```bash
cd "Frontend/part 2"
npm run lint
npm run build
```

The frontend deployment workflow runs these checks automatically. There is currently no automated backend test suite.

## Pull requests

- Use a short, descriptive branch name such as `fix/camera-permissions` or `docs/setup-guide`.
- Explain the user-visible change and how you checked it.
- Include screenshots for visible UI changes when practical.
- Update the README or changelog if setup, behavior, API, or deployment instructions change.
- Do not commit API keys, `.env` files, generated build output, or private camera footage.
- Keep energy consumption and savings labeled as estimates unless backed by connected meter readings. Vision changes must remain person-only and must not describe detections as energy measurements.

## Releases

Add unreleased changes to `CHANGELOG.md`. Version tags and GitHub release notes are created from `main` after the release contents are reviewed; see the release process in the changelog.
