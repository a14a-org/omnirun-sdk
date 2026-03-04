import { lookup } from "node:dns/promises";
import { CommandExitException, Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

function isIPv4(host) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function parseTargets() {
  const raw =
    process.env.OMNIRUN_NETWORK_PROBE_TARGETS ||
    "1.1.1.1:443,1.0.0.1:443,api.omnirun.io:443,example.com:443";
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [host, portRaw] = part.split(":");
      const port = Number(portRaw || 443);
      return { host, port };
    })
    .filter((t) => t.host && Number.isFinite(t.port) && t.port > 0 && t.port < 65536);
}

function summarizeProbe(target, result) {
  const key = `${target.host}:${target.port}`;
  const status = result.ok ? "reachable" : "blocked";
  return `${key}=${status}`;
}

async function probeTcp(sbx, host, port) {
  const script = [
    "import socket,sys",
    `host = ${JSON.stringify(host)}`,
    `port = ${port}`,
    "s = socket.socket()",
    "s.settimeout(4)",
    "try:",
    "  s.connect((host, port))",
    "  print('reachable')",
    "  sys.exit(0)",
    "except Exception as e:",
    "  print('blocked:' + type(e).__name__ + ':' + str(e))",
    "  sys.exit(13)",
    "finally:",
    "  s.close()",
  ].join("\\n");

  const command = `python3 - <<'PY'\\n${script}\\nPY`;

  try {
    const result = await sbx.commands.run(command);
    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: result.exitCode,
    };
  } catch (err) {
    if (err instanceof CommandExitException) {
      return {
        ok: false,
        stdout: (err.stdout || "").trim(),
        stderr: (err.stderr || "").trim(),
        exitCode: err.exitCode,
      };
    }
    throw err;
  }
}

async function withSandbox(apiUrl, apiKey, scenario, fn) {
  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    internet: true,
    metadata: { suite: "hosted-examples", scenario },
  });

  try {
    return await fn(sbx);
  } finally {
    await sbx.kill();
    console.log(`sandbox_killed_${scenario}=true`);
  }
}

async function ipAllowlistCheck(apiUrl, apiKey, targets, strictMode) {
  return withSandbox(apiUrl, apiKey, "network-policy-ip", async (sbx) => {
    const baseline = [];
    for (const target of targets) {
      const result = await probeTcp(sbx, target.host, target.port);
      baseline.push({ target, result });
    }

    console.log(
      "baseline=" +
        baseline
          .map((entry) => summarizeProbe(entry.target, entry.result))
          .join(",")
    );

    const reachableIPs = baseline
      .filter((entry) => entry.result.ok && isIPv4(entry.target.host))
      .map((entry) => entry.target);

    if (reachableIPs.length === 0) {
      const msg = "ip_allowlist_check=skipped_no_reachable_ip_targets";
      if (strictMode) throw new Error(msg);
      console.log(msg);
      return "skip";
    }

    const allowed = reachableIPs[0];
    const blocked = { host: process.env.OMNIRUN_NETWORK_POLICY_BLOCK_IP || "9.9.9.9", port: 443 };

    await sbx.setNetworkPolicy({ allowIPs: [allowed.host] });

    const allowedAfter = await probeTcp(sbx, allowed.host, allowed.port);
    const blockedAfter = await probeTcp(sbx, blocked.host, blocked.port);

    console.log(`ip_allow_target=${allowed.host}:${allowed.port}`);
    console.log(`ip_allow_target_after=${allowedAfter.ok ? "reachable" : "blocked"}`);
    console.log(`ip_block_probe=${blocked.host}:${blocked.port}`);
    console.log(`ip_block_probe_after=${blockedAfter.ok ? "reachable" : "blocked"}`);

    if (!allowedAfter.ok) {
      throw new Error("IP allowlist check failed: allowed IP became unreachable");
    }

    if (blockedAfter.ok) {
      throw new Error("IP allowlist check failed: non-allowlisted IP is still reachable");
    }

    console.log("ip_allowlist_check=pass");
    return "pass";
  });
}

async function domainAllowlistCheck(apiUrl, apiKey, strictMode) {
  const domain = process.env.OMNIRUN_NETWORK_POLICY_DOMAIN || "example.com";
  const resolved = await lookup(domain, { family: 4 });
  const allowedIP = resolved.address;
  const blocked = { host: process.env.OMNIRUN_NETWORK_POLICY_BLOCK_IP || "9.9.9.9", port: 443 };

  return withSandbox(apiUrl, apiKey, "network-policy-domain", async (sbx) => {
    const baselineAllowed = await probeTcp(sbx, allowedIP, 443);
    console.log(`domain_allow_target=${domain} (${allowedIP}:443)`);
    console.log(`domain_allow_target_baseline=${baselineAllowed.ok ? "reachable" : "blocked"}`);

    if (!baselineAllowed.ok) {
      const msg = "domain_allowlist_check=skipped_no_baseline_connectivity";
      if (strictMode) throw new Error(msg);
      console.log(msg);
      return "skip";
    }

    await sbx.setNetworkPolicy({ allowDomains: [domain] });

    const allowedAfter = await probeTcp(sbx, allowedIP, 443);
    const blockedAfter = await probeTcp(sbx, blocked.host, blocked.port);

    console.log(`domain_allow_target_after=${allowedAfter.ok ? "reachable" : "blocked"}`);
    console.log(`domain_block_probe=${blocked.host}:${blocked.port}`);
    console.log(`domain_block_probe_after=${blockedAfter.ok ? "reachable" : "blocked"}`);

    if (!allowedAfter.ok) {
      throw new Error("Domain allowlist check failed: allowlisted domain IP became unreachable");
    }

    if (blockedAfter.ok) {
      throw new Error("Domain allowlist check failed: non-allowlisted IP is still reachable");
    }

    console.log("domain_allowlist_check=pass");
    return "pass";
  });
}

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  const strictMode = process.env.OMNIRUN_STRICT_NETWORK_POLICY_CHECK === "1";
  const targets = parseTargets();

  step("network policy");

  if (targets.length === 0) {
    throw new Error("No valid network probe targets configured");
  }

  const ipStatus = await ipAllowlistCheck(apiUrl, apiKey, targets, strictMode);
  const domainStatus = await domainAllowlistCheck(apiUrl, apiKey, strictMode);

  console.log(`network_policy_summary=ip:${ipStatus},domain:${domainStatus}`);
}
