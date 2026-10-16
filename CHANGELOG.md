# Changelog

Notable project changes are recorded here. This project does not have a tagged version yet, so changes currently belong to the unreleased section.

## Unreleased

### Documentation

- Expanded the README with the live demo links, local run steps, deployment map, API overview, energy assumptions, and known limitations.
- Added architecture/data-flow and Windows YOLO camera setup/troubleshooting guides.
- Clarified which rooms use shared backend state, how camera telemetry is sent, where the Gemini key is stored, and which values are estimates.
- Corrected contribution guidance to describe the separate GitHub Pages frontend and Render API deployment.

## Release process

When publishing a version, move the relevant items from **Unreleased** into a dated version heading such as `## [1.0.0] - YYYY-MM-DD`, create the matching `v1.0.0` Git tag, and publish the release notes on GitHub. Use semantic versioning for future versions.
