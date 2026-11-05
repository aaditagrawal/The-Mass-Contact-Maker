// Benchmark-only inputs are kept outside the project; no baseline library ships with the app.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs bun tests/benchmark-exports.mjs JSZIP_FILE FILESAVER_FILE
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const zipSource = readFileSync(process.argv[2], "utf8");
const saverSource = readFileSync(process.argv[3], "utf8");
const helperSource = readFileSync(new URL("../scripts/export-files.js", import.meta.url), "utf8");
const zipHash = createHash("sha256").update(zipSource).digest("hex");
if (zipHash !== "7f839b2d4688b845c105ebf5d2f9803075f91ea0fe72bdaac176c3a04dd3d2c1") {
  throw new Error("Expected the committed index.html's JSZip 3.10.2 CDN artifact");
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--num-raster-threads=2", "--js-flags=--expose-gc"],
});
const metadata = {
  browser: await browser.version(), runtime: Bun.version, zipHash,
  saverHash: createHash("sha256").update(saverSource).digest("hex"),
  helperHash: createHash("sha256").update(helperSource).digest("hex"),
  samples: Number(process.env.BENCH_SAMPLES || 7),
  warmups: Number(process.env.BENCH_WARMUPS || 2),
  gcBetweenSamples: true,
};
const progress = { ...metadata, zip: [] };
try {
  const page = await browser.newPage();
  page.on("console", message => process.stderr.write(`${message.text()}\n`));
  await page.exposeFunction("recordBenchmark", record => {
    if (record.name) progress.zip.push(record);
    else progress.download = record.download;
    if (process.env.BENCH_OUTPUT) writeFileSync(process.env.BENCH_OUTPUT, JSON.stringify(progress, null, 2));
  });
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: zipSource });
  await page.addScriptTag({ content: saverSource });
  await page.addScriptTag({ content: helperSource });
  const result = await page.evaluate(async ({ samples, warmups, only }) => {
    const workloads = [
      { name: "small", count: 1, bytes: 512 },
      { name: "typical", count: 50, bytes: 4096 },
      { name: "large", count: 2000, bytes: 4096 },
      { name: "one-large", count: 1, bytes: 8 * 1024 * 1024 },
      { name: "many-small", count: 4096, bytes: 9 },
    ].filter(workload => !only.length || only.includes(workload.name));
    const results = [];
    const summarize = values => {
      const sorted = values.slice().sort((a, b) => a - b);
      return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1] };
    };
    for (const workload of workloads) {
      console.log(`Benchmarking ${workload.name}`);
      const content = "BEGIN:VCARD\nFN:Zoë नमस्ते 😀\nEND:VCARD\n".repeat(Math.ceil(workload.bytes / 45)).slice(0, workload.bytes);
      const files = Array.from({ length: workload.count }, (_, index) => ({ name: `équipe/班_batch${index}_contacts.vcf`, content }));
      const samplesByKind = { baseline: [], candidate: [] };
      const gapsByKind = { baseline: [], candidate: [] };
      const run = async kind => {
        let last = performance.now();
        let maxGap = 0;
        const timer = setInterval(() => {
          const now = performance.now();
          maxGap = Math.max(maxGap, now - last);
          last = now;
        }, 0);
        const start = performance.now();
        let blob;
        if (kind === "baseline") {
          const zip = new JSZip();
          for (const file of files) zip.file(file.name, file.content);
          blob = await zip.generateAsync({ type: "blob" });
        } else {
          blob = await ContactFiles.createZip(files);
        }
        const elapsed = performance.now() - start;
        maxGap = Math.max(maxGap, performance.now() - last);
        clearInterval(timer);
        if (blob.type !== "application/zip" || blob.size === 0) throw new Error("Empty archive");
        return { elapsed, maxGap, size: blob.size };
      };
      for (let iteration = -warmups; iteration < samples; iteration++) {
        const order = iteration % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"];
        for (const kind of order) {
          const measured = await run(kind);
          if (iteration >= 0) {
            samplesByKind[kind].push(measured.elapsed);
            gapsByKind[kind].push(measured.maxGap);
          }
          globalThis.gc();
        }
      }
      const record = { ...workload, actualBytesPerEntry: new TextEncoder().encode(content).length, totalMs: Object.fromEntries(Object.entries(samplesByKind).map(([kind, values]) => [kind, summarize(values)])), maxEventLoopGapMs: Object.fromEntries(Object.entries(gapsByKind).map(([kind, values]) => [kind, summarize(values)])), rawMs: samplesByKind };
      results.push(record);
      await window.recordBenchmark(record);
    }

    // Measure helper activation/scheduling and cleanup, not OS download latency.
    // Suppress both activation APIs at the same boundary. FileSaver's synthetic
    // click is not cancelable, so preventDefault alone would suppress only ours.
    // The shared 40s retention delay is excluded; deferred clicks use real timers.
    const originalTimeout = window.setTimeout;
    const originalDispatch = HTMLAnchorElement.prototype.dispatchEvent;
    const originalClick = HTMLAnchorElement.prototype.click;
    let cleanup = [];
    let clicked;
    const activate = () => { clicked?.(); };
    HTMLAnchorElement.prototype.click = activate;
    HTMLAnchorElement.prototype.dispatchEvent = function(event) {
      if (event.type === "click") { activate(); return true; }
      return originalDispatch.call(this, event);
    };
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 40000) { cleanup.push(callback); return 0; }
      return originalTimeout(callback, delay, ...args);
    };
    const download = { baseline: [], candidate: [] };
    const blob = new Blob(["BEGIN:VCARD\nFN:Zoë\nEND:VCARD\n"], { type: "text/vcard;charset=utf-8" });
    for (let iteration = -warmups; iteration < samples * 10; iteration++) {
      const order = iteration % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"];
      for (const kind of order) {
        let activate;
        const activation = new Promise(resolve => { activate = resolve; });
        clicked = activate;
        const start = performance.now();
        if (kind === "baseline") saveAs(blob, "équipe.vcf");
        else ContactFiles.downloadBlob(blob, "équipe.vcf");
        await activation;
        for (const callback of cleanup) callback();
        cleanup = [];
        if (iteration >= 0) download[kind].push(performance.now() - start);
      }
    }
    window.setTimeout = originalTimeout;
    HTMLAnchorElement.prototype.dispatchEvent = originalDispatch;
    HTMLAnchorElement.prototype.click = originalClick;
    const downloadResult = Object.fromEntries(Object.entries(download).map(([kind, values]) => [kind, summarize(values)]));
    await window.recordBenchmark({ download: downloadResult });
    return { zip: results, download: downloadResult };
  }, { samples: metadata.samples, warmups: metadata.warmups, only: (process.env.BENCH_ONLY || "").split(",").filter(Boolean) });
  console.log(JSON.stringify({ ...metadata, ...result }, null, 2));
} finally {
  await browser.close();
}
