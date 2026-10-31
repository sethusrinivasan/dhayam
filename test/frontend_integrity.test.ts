import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SITE_DIR = path.join(ROOT_DIR, "site");
const JS_DIR = path.join(SITE_DIR, "js");

test("all site/js/*.js files have valid JavaScript syntax", () => {
  const jsFiles = fs.readdirSync(JS_DIR).filter((f) => f.endsWith(".js"));
  assert.ok(jsFiles.length >= 10, `Expected at least 10 JS files in ${JS_DIR}, found ${jsFiles.length}`);

  for (const file of jsFiles) {
    const filePath = path.join(JS_DIR, file);
    const code = fs.readFileSync(filePath, "utf-8");
    try {
      new vm.Script(code, { filename: file });
    } catch (err) {
      assert.fail(`Syntax error in ${file}: ${(err as Error).message}`);
    }
  }
});

test("all script tags in site/index.html resolve to existing non-empty files", () => {
  const html = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf-8");
  const scriptRegex = /<script\s+[^>]*src="([^"]+)"/g;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith("http://") || src.startsWith("https://")) continue;
    const resolvedPath = path.join(SITE_DIR, src);
    assert.ok(fs.existsSync(resolvedPath), `Referenced script ${src} does not exist at ${resolvedPath}`);
    const stat = fs.statSync(resolvedPath);
    assert.ok(stat.size > 0, `Script ${src} is empty`);
    count++;
  }
  assert.ok(count >= 10, `Expected at least 10 local script references, found ${count}`);
});

test("all stylesheet links in site/index.html resolve to existing non-empty files", () => {
  const html = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf-8");
  const linkRegex = /<link\s+[^>]*rel="stylesheet"\s+[^>]*href="([^"]+)"/g;
  let match;
  let count = 0;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("http://") || href.startsWith("https://")) continue;
    const resolvedPath = path.join(SITE_DIR, href);
    assert.ok(fs.existsSync(resolvedPath), `Referenced CSS ${href} does not exist at ${resolvedPath}`);
    const stat = fs.statSync(resolvedPath);
    assert.ok(stat.size > 0, `Stylesheet ${href} is empty`);
    count++;
  }
  assert.ok(count >= 8, `Expected at least 8 local CSS references, found ${count}`);
});

test("no unescaped Tamil characters in core game UI files prior to full i18n release", () => {
  const tamilRegex = /[\u0B80-\u0BFF]+/;
  const filesToCheck = [
    path.join(SITE_DIR, "index.html"),
    ...fs.readdirSync(JS_DIR).map((f) => path.join(JS_DIR, f)),
  ];

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, "utf-8");
    const match = tamilRegex.exec(content);
    assert.equal(
      match,
      null,
      `Found Tamil script in ${path.relative(ROOT_DIR, file)}: '${match?.[0]}'. Defer to localized i18n.`,
    );
  }
});

test("headless Chrome loads site/index.html with zero runtime exceptions and responsive interactive UI", async (t) => {
  const chromePath = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"].find((p) =>
    fs.existsSync(p),
  );
  if (!chromePath) {
    t.skip("No Chrome or Chromium binary found on host; skipping headless CDP browser check.");
    return;
  }

  const port = 9333;
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderrOutput = "";
  chrome.stderr?.on("data", (data) => {
    stderrOutput += data.toString();
  });

  try {
    // Wait for Chrome debugging port to open (up to 5 seconds)
    let ready = false;
    for (let i = 0; i < 50; i++) {
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
      if (process.env.CI) {
        // In CI environments where Chrome headless port cannot bind or is restricted,
        // log warning and gracefully skip browser automation subtest rather than failing full suite
        t.skip(`Chrome headless remote debugging port could not start in CI: ${stderrOutput.slice(0, 300)}`);
        return;
      }
      assert.fail(`Chrome remote debugging port failed to become ready: ${stderrOutput}`);
    }

    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((tg: any) => tg.type === "page");
    assert.ok(pageTarget, "No browser page target found");

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const send = (method: string, params: Record<string, any> = {}) => {
      const id = msgId++;
      return new Promise<any>((resolve, reject) => {
        const handler = (event: any) => {
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

    const exceptions: string[] = [];
    const consoleErrors: string[] = [];

    ws.addEventListener("message", (event: any) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        const details = msg.params.exceptionDetails;
        exceptions.push(`${details.text} ${details.exception?.description || ""}`);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        consoleErrors.push(msg.params.args.map((a: any) => a.value ?? a.description).join(" "));
      }
    });

    await send("Runtime.enable");
    await send("Page.enable");

    const siteUrl = `file://${path.join(SITE_DIR, "index.html")}`;
    await send("Page.navigate", { url: siteUrl });

    // Wait for scripts execution and DOM initialization
    await new Promise((r) => setTimeout(r, 2000));

    assert.deepEqual(exceptions, [], `Expected 0 runtime exceptions on load, found: ${exceptions.join("; ")}`);
    assert.deepEqual(consoleErrors, [], `Expected 0 console.error logs on load, found: ${consoleErrors.join("; ")}`);

    // Verify DOM state
    const domState = await send("Runtime.evaluate", {
      expression: `(() => {
        return {
          cellsCount: document.querySelectorAll('.cell').length,
          playersCount: document.querySelectorAll('#players .player').length,
          actionBtnVisible: !document.getElementById('actionBtn')?.hidden,
          actionBtnText: document.getElementById('actionBtn')?.textContent?.trim(),
          actionBtnDisabled: document.getElementById('actionBtn')?.disabled,
          statusTitle: document.getElementById('statusTitle')?.textContent?.trim()
        };
      })()`,
      returnByValue: true,
    });

    const state = domState.result.value;
    assert.equal(state.cellsCount, 49, `Expected 49 board cells rendered, found ${state.cellsCount}`);
    assert.ok(state.playersCount >= 2, `Expected at least 2 player cards rendered, found ${state.playersCount}`);
    assert.equal(state.actionBtnVisible, true, "Expected actionBtn to be visible");
    assert.equal(state.actionBtnDisabled, false, "Expected actionBtn to be enabled for player turn");
    assert.ok(state.statusTitle.length > 0, "Expected statusTitle to have non-empty turn announcement");

    // Click action button and verify roll proceeds without exceptions
    await send("Runtime.evaluate", {
      expression: `document.getElementById('actionBtn').click()`,
    });

    await new Promise((r) => setTimeout(r, 1500));

    assert.deepEqual(
      exceptions,
      [],
      `Expected 0 runtime exceptions after roll click, found: ${exceptions.join("; ")}`,
    );

    ws.close();
  } finally {
    chrome.kill();
  }
});
