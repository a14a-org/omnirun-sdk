import {
  Sandbox,
  decryptE2EEJSON,
  deriveE2EESharedKey,
  encryptE2EEJSON,
} from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

function isHex64(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  const strictE2EE = process.env.OMNIRUN_STRICT_E2EE_CHECK === "1";
  step("secure mode");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    secure: true,
    e2ee: true,
    metadata: { suite: "hosted-examples", scenario: "secure-mode" },
  });

  try {
    if (!isHex64(sbx.trafficAccessToken)) {
      throw new Error("secure sandbox did not return a valid traffic access token");
    }
    console.log(`traffic_token_len=${sbx.trafficAccessToken.length}`);
    console.log(`e2ee_enabled=${sbx.e2ee?.enabled === true}`);
    console.log(`client_public_key_len=${sbx.e2ee?.clientPublicKey?.length ?? 0}`);
    console.log(`server_public_key_present=${Boolean(sbx.e2ee?.serverPublicKey)}`);

    if (!sbx.e2ee?.clientKeyPair?.privateKey) {
      throw new Error("E2EE client private key is missing from SDK session state");
    }
    if (!sbx.e2ee?.serverPublicKey) {
      if (strictE2EE) {
        throw new Error("strict E2EE check failed: serverPublicKey missing");
      }
      console.log("e2ee_handshake_check=skipped_no_server_public_key");
    } else {
      const shared = await deriveE2EESharedKey(
        sbx.e2ee.clientKeyPair.privateKey,
        sbx.e2ee.serverPublicKey
      );
      const envelope = await encryptE2EEJSON(
        shared,
        { hello: "secure", sandbox: sbx.sandboxId },
        `sandbox:${sbx.sandboxId}:secure-mode`
      );
      const roundtrip = await decryptE2EEJSON(shared, envelope);
      const ok =
        roundtrip?.hello === "secure" && roundtrip?.sandbox === sbx.sandboxId;
      console.log(`e2ee_handshake_roundtrip_ok=${ok}`);
      if (!ok) {
        throw new Error("E2EE handshake roundtrip validation failed");
      }
    }

    const command = await sbx.commands.run("python3 -c \"print('secure-ok')\"");
    console.log(`command_stdout=${command.stdout.trim()}`);

    await sbx.files.write("/tmp/secure-mode.txt", "secure-mode-data");
    const readBack = await sbx.files.read("/tmp/secure-mode.txt");
    console.log(`file_read_back=${readBack}`);

    const proxyTemplate = process.env.OMNIRUN_SECURE_PROXY_URL_TEMPLATE || "";
    const strictProxyCheck = process.env.OMNIRUN_STRICT_SECURE_PROXY_CHECK === "1";

    if (!proxyTemplate) {
      console.log("proxy_gate_check=skipped (set OMNIRUN_SECURE_PROXY_URL_TEMPLATE to enable)");
      return;
    }

    // Serve a known file through an in-sandbox HTTP server for proxy token checks.
    await sbx.files.write("/tmp/secure-proxy.txt", "secure-proxy-data");
    await sbx.commands.run("python3 -m http.server 8000 --directory /tmp", {
      background: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const proxyUrl = proxyTemplate
      .replaceAll("${SANDBOX_ID}", sbx.sandboxId)
      .replaceAll("${PORT}", "8000");

    const noTokenResp = await fetch(proxyUrl, { redirect: "manual" });
    const withTokenResp = await fetch(proxyUrl, {
      headers: { "e2b-traffic-access-token": sbx.trafficAccessToken },
      redirect: "manual",
    });

    console.log(`proxy_status_no_token=${noTokenResp.status}`);
    console.log(`proxy_status_with_token=${withTokenResp.status}`);

    if (strictProxyCheck) {
      if (noTokenResp.status === 200) {
        throw new Error("strict proxy check failed: unauthenticated request unexpectedly returned 200");
      }
      if (withTokenResp.status !== 200) {
        throw new Error(
          `strict proxy check failed: token-authenticated request returned ${withTokenResp.status}`
        );
      }
      const body = await withTokenResp.text();
      if (!body.includes("secure-proxy-data")) {
        throw new Error("strict proxy check failed: authenticated proxy body mismatch");
      }
      console.log("proxy_gate_check=strict-pass");
      return;
    }

    const bestEffortPass = noTokenResp.status !== 200 && withTokenResp.status === 200;
    console.log(`proxy_gate_check=${bestEffortPass ? "best-effort-pass" : "inconclusive"}`);
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}
