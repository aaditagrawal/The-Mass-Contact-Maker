import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const sandbox = vm.createContext({ Blob, TextEncoder, setTimeout });
vm.runInContext(readFileSync(new URL("../scripts/export-files.js", import.meta.url), "utf8"), sandbox);
const files = [
  { name: "équipe/班_batch1_contacts.vcf", content: "BEGIN:VCARD\nFN:नमस्ते 😀\nEND:VCARD\n" },
  { name: "équipe/班_batch2_contacts.vcf", content: "BEGIN:VCARD\nFN:Zoë\nEND:VCARD\n" },
  { name: "/a//b.vcf", content: "slash" },
  { name: "a/../b.vcf", content: "dots" },
  { name: "a\\b.vcf", content: "backslash" },
  { name: "empty.vcf", content: "" },
  { name: "replacement.vcf", content: "old" },
  { name: "replacement.vcf", content: "new" },
  { name: "chunked.vcf", content: `${"a".repeat(65535)}😀नमस्ते${"b".repeat(65536)}😀` },
];
await Bun.write(join(process.argv[2], "contacts.zip"), await sandbox.ContactFiles.createZip(files));
for (const count of [65534, 65535, 65536]) {
  const entries = Array.from({ length: count }, (_, index) => ({ name: `${index}.vcf`, content: "123456789" }));
  await Bun.write(join(process.argv[2], `${count}.zip`), await sandbox.ContactFiles.createZip(entries));
}
