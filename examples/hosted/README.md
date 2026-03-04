# Hosted API examples

These examples validate `@omnirun/sdk` against a hosted OmniRun API.

## Prerequisites

- Node 18+
- Built SDK (`npm run build`)
- `OMNIRUN_API_URL` set to your hosted API base URL
- `OMNIRUN_API_KEY` set

## Run all

```bash
OMNIRUN_API_URL=https://<your-api-host> \
OMNIRUN_API_KEY=<key> \
npm run examples:hosted
```

## Run one suite

```bash
OMNIRUN_API_URL=https://<your-api-host> npm run examples:hosted -- preflight
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- lifecycle
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- commands-files
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- streaming
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- contexts
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- network-policy
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- secure-mode
OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted -- pty
```

## TLS troubleshooting

If your hosted endpoint has a temporary certificate mismatch during setup, you can run examples with:

```bash
OMNIRUN_ALLOW_INSECURE_TLS=1
```

Use this only for local debugging.

## Network policy example options

`network-policy` creates internet-enabled sandboxes and exercises:

- IP allowlisting (`allowIPs` + default deny behavior)
- Domain allowlisting (`allowDomains`)

Optional environment variables:

```bash
# Probes used to establish baseline reachability (host:port CSV)
OMNIRUN_NETWORK_PROBE_TARGETS=1.1.1.1:443,1.0.0.1:443,api.omnirun.io:443,example.com:443

# IP used to verify non-allowlisted egress is blocked
OMNIRUN_NETWORK_POLICY_BLOCK_IP=9.9.9.9

# Domain used in allowDomains test
OMNIRUN_NETWORK_POLICY_DOMAIN=example.com

# In strict mode, skip conditions become failures
OMNIRUN_STRICT_NETWORK_POLICY_CHECK=1
```

## Optional secure proxy gate validation

`secure-mode` always validates:

- secure sandbox token issuance (`secure: true`)
- E2EE client key bootstrap (`e2ee: true` + `clientPublicKey` generation)
- E2EE handshake roundtrip when `serverPublicKey` is returned
- normal API operations (commands/files)

To also validate traffic-token gate behavior on your port-proxy domain, set:

```bash
OMNIRUN_SECURE_PROXY_URL_TEMPLATE=https://${SANDBOX_ID}-${PORT}.claudebox.io/secure-proxy.txt
```

To make that check strict/failing when proxy behavior is unexpected:

```bash
OMNIRUN_STRICT_SECURE_PROXY_CHECK=1
```

You can also enforce server key presence:

```bash
OMNIRUN_STRICT_E2EE_CHECK=1
```
