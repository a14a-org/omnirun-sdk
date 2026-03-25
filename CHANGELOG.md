# Changelog

## 0.5.0

### Minor Changes

- a42b442: Add LLM proxy client with streaming support. New `LLM` class provides `chatCompletion()`, `streamChatCompletion()`, `listModels()`, and `getUsage()` methods for the OpenAI-compatible LLM proxy endpoint.

## 0.4.0

### Minor Changes

- 9d4a061: Add automatic retry on transient server errors (500/502/503) for POST and upload requests, fixing intermittent binary file write failures. Add Exposures API for managing sandbox preview URLs. Fix E2EE test compatibility with Node 18.

All notable changes to this project will be documented in this file.

## 0.3.0 - 2026-03-04

- First standalone release of `@omnirun/sdk`.
- Full sandbox SDK surface extracted from OmniRun monorepo.
- API contract fixes for metadata filters and context stream execution.
- Added Changesets and CI/publish workflows.
