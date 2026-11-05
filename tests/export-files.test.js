import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const helperSource = readFileSync(new URL("../scripts/export-files.js", import.meta.url), "utf8");

function context(overrides = {}) {
  const sandbox = vm.createContext({ Blob, TextEncoder, setTimeout, ...overrides });
  vm.runInContext(helperSource, sandbox);
  return sandbox;
}

function downloadEnvironment(failure) {
  const timers = [];
  const events = [];
  const links = [];
  const blobs = [];
  const document = {
    body: { appendChild(link) { events.push("append"); links.push(link); } },
    createElement() {
      return {
        click() { events.push("click"); if (failure === "click") throw new Error("click failed"); },
        remove() { events.push("remove"); },
      };
    },
  };
  if (failure === "append") document.body.appendChild = () => { throw new Error("append failed"); };
  const sandbox = context({
    document,
    URL: {
      createObjectURL(blob) { blobs.push(blob); return "blob:test"; },
      revokeObjectURL(url) { events.push(`revoke ${url}`); },
    },
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
  });
  return { sandbox, document, timers, events, links, blobs };
}

// An independent reader in check_zip.py checks CRCs, offsets, UTF-8, directories and ZIP64.
describe("browser downloads", () => {
  test("keeps the original blob/name, clicks an attached anchor and delays revocation", () => {
    const env = downloadEnvironment();
    const blob = new Blob(["नमस्ते\n"], { type: "text/vcard;charset=utf-8" });
    env.sandbox.ContactFiles.downloadBlob(blob, "équipe_contacts.vcf");
    expect(env.blobs).toEqual([blob]);
    expect(env.links[0].download).toBe("équipe_contacts.vcf");
    expect(env.links[0].href).toBe("blob:test");
    expect(env.links[0].rel).toBe("noopener");
    expect(env.links[0].hidden).toBe(true);
    expect(env.events).toEqual(["append", "click", "remove"]);
    expect(env.timers[0].delay).toBe(40000);
    env.timers[0].callback();
    expect(env.events.at(-1)).toBe("revoke blob:test");
  });

  for (const failure of ["append", "click"]) {
    test(`cleans up URLs when ${failure} fails`, () => {
      const env = downloadEnvironment(failure);
      expect(() => env.sandbox.ContactFiles.downloadBlob(new Blob(["x"]), "x.vcf"))
        .toThrow(`${failure} failed`);
      expect(env.events.at(-1)).toBe("remove");
      env.timers[0].callback();
      expect(env.events.at(-1)).toBe("revoke blob:test");
    });
  }
});

describe("ZIP serializer", () => {
  test("writes an empty archive", async () => {
    const zip = await context().ContactFiles.createZip([]);
    const bytes = new DataView(await zip.arrayBuffer());
    expect(zip.type).toBe("application/zip");
    expect(zip.size).toBe(22);
    expect(bytes.getUint32(0, true)).toBe(0x06054b50);
    expect(bytes.getUint16(8, true)).toBe(0);
  });

  test("writes the standard CRC-32 check value and STORE method", async () => {
    const zip = await context().ContactFiles.createZip([{ name: "x.vcf", content: "123456789" }]);
    const bytes = new DataView(await zip.arrayBuffer());
    expect(bytes.getUint32(14, true)).toBe(0xcbf43926);
    expect(bytes.getUint16(8, true)).toBe(0);
    expect(bytes.getUint16(6, true) & 0x800).toBe(0x800);
  });

  test("reports unrepresentable filenames instead of emitting truncated ZIP headers", async () => {
    await expect(context().ContactFiles.createZip([{ name: "é".repeat(32768), content: "x" }]))
      .rejects.toThrow("filename is too long");
  });

  test("closes both message ports after each cooperative yield", async () => {
    let clock = 0;
    let channels = 0;
    let closed = 0;
    class Clock extends Date {
      static now() { clock += 3; return clock; }
    }
    class Channel {
      constructor() {
        channels++;
        this.port1 = { close() { closed++; } };
        this.port2 = {
          close() { closed++; },
          postMessage: () => queueMicrotask(() => this.port1.onmessage()),
        };
      }
    }
    const sandbox = context({ Date: Clock, MessageChannel: Channel });
    const archive = await sandbox.ContactFiles.createZip([{ name: "x.vcf", content: "hello" }]);
    expect(archive.size).toBeGreaterThan(0);
    expect(channels).toBeGreaterThan(0);
    expect(closed).toBe(channels * 2);
  });
});
