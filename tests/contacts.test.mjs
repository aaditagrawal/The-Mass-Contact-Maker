import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as XLSX from 'xlsx';

function page() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test' });
  const { window } = dom;
  window.XLSX = XLSX;
  window.Blob = globalThis.Blob;
  window.setInterval = () => 0;
  const files = [];
  window.saveAs = (blob, name) => files.push({ blob, name });
  window.JSZip = class {
    entries = [];
    file(name, text) { this.entries.push({ name, text }); }
    async generateAsync() { return this.entries; }
  };
  const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
  window.eval(source.replace(/\n}\);\s*$/, '\nwindow.api = { handleFile, createVcfContacts, formatPhone, escapeVcard, columnLabel };\n});'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  window.document.getElementById('group-name').value = 'Team';
  return { window, files, api: window.api, close: () => window.close() };
}

async function selectCsv(p, csv) {
  await p.api.handleFile({ name: 'contacts.CSV', text: async () => csv });
  p.window.document.getElementById('phone-column-selector').value = '0';
  p.window.document.getElementById('first-name-column-selector').value = '1';
  p.window.document.getElementById('phone-column-selector').dispatchEvent(new p.window.Event('change'));
}

test('dropped CSV exports the same quoted and multiline data as the preview', async () => {
  const p = page();
  await selectCsv(p, 'Phone,Name\n1234567890,"Alice, \"\"Example\"\""\n2345678901,"Two\nLines"');
  p.window.document.getElementById('contact-form').dispatchEvent(new p.window.Event('submit', { cancelable: true }));
  await Promise.resolve();
  expect(p.files).toHaveLength(1);
  expect(await p.files[0].blob.text()).toContain('Alice\\, "Example"');
  expect(await p.files[0].blob.text()).toContain('Two\\nLines');
  p.close();
});

test('imported names cannot create preview markup', async () => {
  const p = page();
  await selectCsv(p, 'Phone,Name\n1234567890,<img src=x onerror=alert(1)>');
  const preview = p.window.document.getElementById('preview-list');
  expect(preview.textContent).toContain('<img');
  expect(preview.querySelector('img')).toBeNull();
  p.close();
});

test('international phones retain their country prefix and national phones gain the selected one', () => {
  const p = page();
  expect(p.api.formatPhone('+44 1234567890', '+91')).toBe('+441234567890');
  expect(p.api.formatPhone('0044 1234567890', '+91')).toBe('+441234567890');
  expect(p.api.formatPhone('09123456789', '+91')).toBe('+919123456789');
  expect(p.api.columnLabel(26)).toBe('AA');
  expect(p.api.escapeVcard('A;B,C\nEND:VCARD')).toBe('A\\;B\\,C\\nEND:VCARD');
  p.close();
});

test('blank phone rows keep source row numbering consistent with export', async () => {
  const p = page();
  await selectCsv(p, 'Phone,Name\n,Blank\n1234567890,');
  p.window.document.querySelector('input[name="naming-strategy"][value="sequential"]').checked = true;
  p.window.document.getElementById('contact-form').dispatchEvent(new p.window.Event('submit', { cancelable: true }));
  await Promise.resolve();
  expect(await p.files[0].blob.text()).toContain('Team_002');
  p.close();
});


test('invalid-only batches do not prevent valid later batches from exporting', async () => {
  const p = page();
  await selectCsv(p, 'Phone,Name\n123,Invalid\n1234567890,Valid');
  p.window.document.querySelector('input[name="batch-type"][value="batch"]').checked = true;
  p.window.document.getElementById('batch-size').value = '1';
  p.window.document.getElementById('contact-form').dispatchEvent(new p.window.Event('submit', { cancelable: true }));
  await Bun.sleep(0);
  expect(p.files).toHaveLength(1);
  expect(p.files[0].blob).toHaveLength(1);
  expect(p.files[0].blob[0].name).toContain('batch2');
  p.close();
});

test('column selectors include columns beyond Z', async () => {
  const p = page();
  await p.api.handleFile({ name: 'wide.csv', text: async () => Array.from({length: 28}, (_, i) => `Header${i}`).join(',') + '\n' + Array(28).fill('1234567890').join(',') });
  const selector = p.window.document.getElementById('phone-column-selector');
  expect(selector.querySelector('option[value="26"]').textContent).toContain('Column AA');
  p.close();
});
