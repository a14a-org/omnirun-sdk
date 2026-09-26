---
"@omnirun/sdk": patch
---

Correct `NetworkPolicy` documentation: `allowDomains` is only enforced when `sniProxy: true` is set, and then only for HTTPS (TCP/443); egress is otherwise open. Add `sniProxy` and `sniProxyLogOnly` to the `NetworkPolicy` type (accepted at sandbox creation). `production.setNetworkPolicy()` now throws when `sniProxy` is passed, because the server endpoint would silently ignore it.

Add `sandbox.getPreviewUrl(port)`, which returns a working preview URL via the exposures API. Deprecate `sandbox.getHost(port)`: the legacy `{sandboxId}-{port}.<domain>` pattern is not routed by hosted OmniRun, so it no longer has a default preview domain and throws unless `previewDomain` or `OMNIRUN_PREVIEW_DOMAIN` is set explicitly.
