// End-to-end check of LiquidationRescue in real (headless) Chrome: a borrower and the price-feed operator.
// Needs Google Chrome, the local chain on :8546 (dev-local.ts), the local relayer and the web app running.
// node scripts/e2e.mjs [http://127.0.0.1:3200] [./e2e-shots]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const [base = "http://127.0.0.1:3200", shots = "./shots"] = process.argv.slice(2);
// E2E_WIDTH=390 runs the whole flow at phone size.
const WIDTH = Number(process.env.E2E_WIDTH) || 1280;
const MOBILE = WIDTH < 600;
mkdirSync(shots, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function browser(name) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(tmpdir() + "/lr-")}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0]);
  };
  const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: MOBILE ? 844 : 900, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
  const evalJs = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  const b = {
    name, errors,
    async go(path) { await send("Page.navigate", { url: base + path }); await sleep(2500); },
    text: () => evalJs("document.body.innerText"),
    async waitFor(re, ms = 30000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const t = await b.text(); if (new RegExp(re, "i").test(t)) return t; await sleep(500); } // case-insensitive: some headings are styled in capitals
      throw new Error(`[${name}] timed out waiting for /${re}/. Page says:\n${(await b.text()).slice(0, 800)}`);
    },
    async click(label) {
      // Retry while the page hydrates: a button only works once React is running.
      for (let i = 0; i < 20; i++) {
        const found = await evalJs(`[...document.querySelectorAll("button, a")].some(e => e.innerText.trim().startsWith(${JSON.stringify(label)}))`);
        if (found) break;
        await sleep(500);
      }
      const ok = await evalJs(`(() => { const el = [...document.querySelectorAll("button, a")].find(e => e.innerText.trim() === ${JSON.stringify(label)} || e.innerText.trim().startsWith(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`[${name}] no button "${label}". Page says:\n${(await b.text()).slice(0, 600)}`);
      await sleep(700);
    },
    /** Sets the input labelled `label` (its <label> text or aria-label). */
    async fill(label, value) {
      const ok = await evalJs(`(() => { const L = ${JSON.stringify(label)};
        const el = [...document.querySelectorAll("label")].find(l => l.innerText.trim().startsWith(L))?.querySelector("input") ?? document.querySelector(\`input[aria-label="\${L}"]\`);
        if (!el) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
      if (!ok) throw new Error(`[${name}] no field "${label}"`);
    },
    async shot(file) {
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      writeFileSync(`${shots}/${file}.png`, Buffer.from(r.data, "base64"));
    },
    close() { ws.close(); proc.kill(); },
  };
  return b;
}

async function connect(b, wallet) {
  await sleep(1500); // let the page hydrate before opening the wallet menu
  await b.click("Connect");
  await b.click(wallet);
  await sleep(1500);
}

const alice = await browser("borrower");
const operator = await browser("operator");
const log = s => console.log("✓ " + s);
try {
  await alice.go("/");
  await connect(alice, "Borrower (Alice)");
  let t = await alice.waitFor("Open position|Health factor");
  if (/Open position/.test(t)) {
    await alice.fill("Collateral (WETH)", "1");
    await alice.fill("Borrow (USDC)", "1200");
    await alice.click("Open position");
  }
  t = await alice.waitFor("Liquidation price", 60000);
  log("position open (HF " + t.match(/Health factor\s+([\d.]+)/i)?.[1] + ")");

  if (!/Protected/.test(t)) {
    await alice.fill("Trigger below HF", "1.25");
    await alice.fill("Restore to HF", "1.5");
    await alice.fill("Max spend (USDC)", "300");
    await alice.fill("Valid for (days)", "7");
    await alice.click("Activate protection");
    await alice.waitFor("Budget used", 60000);
  }
  await alice.fill("Amount in USDC", "300");
  await alice.click("Fund");
  await alice.waitFor("What happens", 60000);
  log("policy active and reserve funded");
  await alice.shot("1-protected");

  // The relayer has to deliver the policy event before the reactive contract knows Alice is protected.
  await alice.waitFor("Protected users\\s+[1-9]", 30000);
  log("reactive contract tracks the user");

  const before = Number((await alice.text()).match(/Decisions\s+(\d+)/i)?.[1] ?? 0);
  await operator.go("/");
  await connect(operator, "Price feed operator");
  await operator.waitFor("Publish a price");
  await operator.click("-10%");
  await operator.waitFor("Confirmed", 30000);
  log("price dropped 10%");

  // Wait for a new decision, not one left over from an earlier run.
  t = await alice.waitFor(`Decisions\\s+${before + 1}`, 60000);
  const outcome = t.match(/Rescue log[\s\S]*?(Partially rescued|Rescued|Not needed|Budget used up|No reserve|Paused|Expired|Stale price|Already liquidated|Repay failed)/i)?.[1];
  log("new rescue decision recorded: " + outcome);
  await sleep(1500);
  await alice.shot("2-rescued");
  const errs = [...alice.errors, ...operator.errors];
  if (errs.length) console.log("page errors:", errs);
} catch (e) {
  await alice.shot("error").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  alice.close(); operator.close();
}
