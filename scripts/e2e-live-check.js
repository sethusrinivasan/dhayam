#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";

const CLOUDFLARE_URL = process.env.CLOUDFLARE_URL || "https://dhayam.cancun.workers.dev";
const GITHUB_PAGES_URL = process.env.GITHUB_PAGES_URL || "https://sethusrinivasan.github.io/dhayam/";

async function checkLiveness(url, description, validator = null) {
  process.stdout.write(`  • Checking ${description} (${url})... `);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.log(`FAIL (HTTP ${res.status} ${res.statusText})`);
      return false;
    }

    if (validator) {
      const body = await res.text();
      const valid = validator(body, res);
      if (!valid) {
        console.log(`FAIL (Validation condition not met)`);
        return false;
      }
    }

    console.log(`PASS (HTTP ${res.status})`);
    return true;
  } catch (err) {
    console.log(`FAIL (${err.message})`);
    return false;
  }
}

async function runBrowserE2E(targetUrl) {
  console.log(`\n▶ Launching Headless Chrome E2E verification against: ${targetUrl}`);

  const chromePath = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"].find((p) =>
    fs.existsSync(p),
  );
  if (!chromePath) {
    console.error("  ✗ No Chrome / Chromium binary found on host system.");
    return false;
  }

  const port = 9444;
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    let ready = false;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!ready) {
      console.error("  ✗ Could not connect to Chrome DevTools port");
      return false;
    }

    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page");
    if (!pageTarget) {
      console.error("  ✗ No page target in Chrome");
      return false;
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener("message", handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    const exceptions = [];
    const consoleErrors = [];

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        const details = msg.params.exceptionDetails;
        exceptions.push(`${details.text} ${details.exception?.description || ""}`);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
      }
    });

    await send("Runtime.enable");
    await send("Page.enable");

    console.log(`  • Navigating to ${targetUrl}...`);
    await send("Page.navigate", { url: targetUrl });
    await new Promise((r) => setTimeout(r, 3500));

    if (exceptions.length > 0) {
      console.error(`  ✗ JavaScript runtime exceptions detected on initial load:`);
      exceptions.forEach((e) => console.error(`    - ${e}`));
      return false;
    }
    if (consoleErrors.length > 0) {
      console.error(`  ✗ console.error detected on initial load:`);
      consoleErrors.forEach((e) => console.error(`    - ${e}`));
      return false;
    }
    console.log("  ✓ Zero JavaScript exceptions or console errors on page load");

    // Check DOM components
    const evalRes = await send("Runtime.evaluate", {
      expression: `(() => {
        return {
          title: document.title,
          cellsCount: document.querySelectorAll('.cell').length,
          playersCount: document.querySelectorAll('#players .player').length,
          actionBtnVisible: !document.getElementById('actionBtn')?.hidden,
          actionBtnText: document.getElementById('actionBtn')?.textContent?.trim(),
          actionBtnDisabled: document.getElementById('actionBtn')?.disabled,
          statusTitle: document.getElementById('statusTitle')?.textContent?.trim(),
          statusText: document.getElementById('statusText')?.textContent?.trim(),
          hasDieA: !!document.getElementById('dieA'),
          hasDieB: !!document.getElementById('dieB')
        };
      })()`,
      returnByValue: true,
    });

    const state = evalRes.result?.value;
    if (!state) {
      console.error("  ✗ Could not evaluate DOM state");
      return false;
    }

    if (state.cellsCount !== 49) {
      console.error(`  ✗ Expected 49 board cells, found ${state.cellsCount}`);
      return false;
    }
    console.log(`  ✓ 49/49 board cells rendered`);

    if (state.playersCount < 2) {
      console.error(`  ✗ Expected at least 2 player cards rendered, found ${state.playersCount}`);
      return false;
    }
    console.log(`  ✓ ${state.playersCount} player cards rendered`);

    if (!state.actionBtnVisible || state.actionBtnDisabled) {
      console.error(`  ✗ Action button not ready (visible: ${state.actionBtnVisible}, disabled: ${state.actionBtnDisabled})`);
      return false;
    }
    console.log(`  ✓ Action button active: "${state.actionBtnText}"`);

    // Perform interactive dice roll
    console.log(`  • Clicking "${state.actionBtnText}" to test live gameplay interaction...`);
    await send("Runtime.evaluate", {
      expression: `document.getElementById('actionBtn').click()`,
    });

    await new Promise((r) => setTimeout(r, 2000));

    if (exceptions.length > 0) {
      console.error(`  ✗ JavaScript exceptions occurred during roll interaction:`);
      exceptions.forEach((e) => console.error(`    - ${e}`));
      return false;
    }

    const postState = await send("Runtime.evaluate", {
      expression: `(() => {
        return {
          actionBtnText: document.getElementById('actionBtn')?.textContent?.trim(),
          actionBtnDisabled: document.getElementById('actionBtn')?.disabled,
          moveBtnText: document.getElementById('moveBtn')?.textContent?.trim(),
          moveBtnDisabled: document.getElementById('moveBtn')?.disabled,
          statusTitle: document.getElementById('statusTitle')?.textContent?.trim(),
          statusText: document.getElementById('statusText')?.textContent?.trim(),
          dieA: document.querySelector('#dieA')?.getAttribute('aria-label'),
          dieB: document.querySelector('#dieB')?.getAttribute('aria-label')
        };
      })()`,
      returnByValue: true,
    });

    const after = postState.result?.value;
    console.log(`  ✓ Dice interaction completed without error:`);
    console.log(`    - Status: "${after.statusTitle} - ${after.statusText}"`);
    console.log(`    - Action Button: "${after.actionBtnText}" (disabled: ${after.actionBtnDisabled})`);
    console.log(`    - Move Button: "${after.moveBtnText}" (disabled: ${after.moveBtnDisabled})`);
    console.log(`    - Dice State: ${after.dieA} | ${after.dieB}`);

    ws.close();
    return true;
  } catch (err) {
    console.error(`  ✗ E2E test failed with error: ${err.message}`);
    return false;
  } finally {
    chrome.kill();
  }
}

async function main() {
  console.log("==================================================================");
  console.log(" Dhayam Production Liveness & E2E Verification Suite");
  console.log("==================================================================");

  let allPassed = true;

  console.log("\n▶ Checking HTTP Service Liveness:");
  const cfRootOk = await checkLiveness(CLOUDFLARE_URL, "Cloudflare Worker Root", (b) => b.includes("<title>Dhayam</title>"));
  const cfHealthOk = await checkLiveness(`${CLOUDFLARE_URL}/health`, "Cloudflare Edge /health", (b) => b.includes("healthy"));
  const cfMcpOk = await checkLiveness(`${CLOUDFLARE_URL}/mcp`, "Cloudflare Edge MCP /mcp Discovery", (b) => b.includes("Dhayam MCP"));
  const ghPagesOk = await checkLiveness(GITHUB_PAGES_URL, "GitHub Pages Root", (b) => b.includes("<title>Dhayam</title>"));

  if (!cfRootOk || !cfHealthOk || !cfMcpOk || !ghPagesOk) {
    allPassed = false;
  }

  // Cloudflare Live E2E
  const cfE2EOk = await runBrowserE2E(CLOUDFLARE_URL);
  if (!cfE2EOk) {
    allPassed = false;
  }

  console.log("\n==================================================================");
  if (allPassed) {
    console.log("✓ ALL LIVENESS AND E2E VERIFICATIONS PASSED");
    process.exit(0);
  } else {
    console.error("✗ ONE OR MORE LIVENESS OR E2E CHECKS FAILED");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
