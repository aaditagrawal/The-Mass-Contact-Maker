import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import XLSX from '../lib/xlsx.full.min.js';

async function page() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test' });
  const { window } = dom;
  window.XLSX = XLSX;
  window.Blob = globalThis.Blob;
  window.TextEncoder = globalThis.TextEncoder;
  window.setInterval = () => 0;
  const files = [];
  window.eval(readFileSync(new URL('../scripts/export-files.js', import.meta.url), 'utf8'));
  window.ContactFiles.downloadBlob = (blob, name) => files.push({ blob, name });
  const form = window.document.getElementById('contact-form');
  const listen = form.addEventListener.bind(form);
  let submission;
  form.addEventListener = (type, listener, options) => listen(type, type === 'submit'
    ? event => { submission = listener(event); } : listener, options);
  const submit = async () => {
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    await submission;
  };
  const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
  window.eval(source.replace(/\n}\);\s*$/, '\nwindow.api = { handleFile, createVcfContacts, formatPhone, escapeVcard, columnLabel };\n});'));
  await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  window.document.getElementById('group-name').value = 'Team';
  return { window, files, submit, api: window.api, close: () => window.close() };
}

async function selectCsv(p, csv) {
  await p.api.handleFile({ name: 'contacts.CSV', text: async () => csv });
  p.window.document.getElementById('phone-column-selector').value = '0';
  p.window.document.getElementById('first-name-column-selector').value = '1';
  p.window.document.getElementById('phone-column-selector').dispatchEvent(new p.window.Event('change'));
}

test('dropped CSV exports the same quoted and multiline data as the preview', async () => {
  const p = await page();
  await selectCsv(p, 'Phone,Name\n1234567890,"Alice, \"\"Example\"\""\n2345678901,"Two\nLines"');
  await p.submit();
  expect(p.files).toHaveLength(1);
  expect(await p.files[0].blob.text()).toContain('Alice\\, "Example"');
  expect(await p.files[0].blob.text()).toContain('Two\\nLines');
  p.close();
});

test('imported names cannot create preview markup', async () => {
  const p = await page();
  await selectCsv(p, 'Phone,Name\n1234567890,<img src=x onerror=alert(1)>');
  const preview = p.window.document.getElementById('preview-list');
  expect(preview.textContent).toContain('<img');
  expect(preview.querySelector('img')).toBeNull();
  p.close();
});

test('international phones retain their country prefix and national phones gain the selected one', async () => {
  const p = await page();
  expect(p.api.formatPhone('+44 1234567890', '+91')).toBe('+441234567890');
  expect(p.api.formatPhone('0044 1234567890', '+91')).toBe('+441234567890');
  expect(p.api.formatPhone('09123456789', '+91')).toBe('+919123456789');
  expect(p.api.columnLabel(26)).toBe('AA');
  expect(p.api.escapeVcard('A;B,C\nEND:VCARD')).toBe('A\\;B\\,C\\nEND:VCARD');
  p.close();
});

test('blank phone rows keep source row numbering consistent with export', async () => {
  const p = await page();
  await selectCsv(p, 'Phone,Name\n,Blank\n1234567890,');
  p.window.document.querySelector('input[name="naming-strategy"][value="sequential"]').checked = true;
  await p.submit();
  expect(await p.files[0].blob.text()).toContain('Team_002');
  p.close();
});


test('invalid-only batches do not prevent valid later batches from exporting', async () => {
  const p = await page();
  await selectCsv(p, 'Phone,Name\n123,Invalid\n1234567890,Valid');
  p.window.document.querySelector('input[name="batch-type"][value="batch"]').checked = true;
  p.window.document.getElementById('batch-size').value = '1';
  await p.submit();
  expect(p.files).toHaveLength(1);
  expect(p.files[0].blob.type).toBe('application/zip');
  const archive = await p.files[0].blob.text();
  expect(archive).toContain('Team_batch2_contacts.vcf');
  expect(archive).not.toContain('Team_batch1_contacts.vcf');
  expect(archive).toContain('FN:Valid');
  p.close();
});

test('column selectors include columns beyond Z', async () => {
  const p = await page();
  await p.api.handleFile({ name: 'wide.csv', text: async () => Array.from({length: 28}, (_, i) => `Header${i}`).join(',') + '\n' + Array(28).fill('1234567890').join(',') });
  const selector = p.window.document.getElementById('phone-column-selector');
  expect(selector.querySelector('option[value="26"]').textContent).toContain('Column AA');
  p.close();
});

for (const mode of ['single', 'range', 'batch']) {
  test(`${mode} exports preserve Unicode, MIME types and source numbering`, async () => {
    const p = await page();
    try {
      await selectCsv(p, 'Phone,Name\n1234567890,A\n2345678901,B\n3456789012,C');
      p.window.document.getElementById('group-name').value = 'équipe/班';
      p.window.document.querySelector('input[name="naming-strategy"][value="sequential"]').checked = true;
      p.window.document.querySelector(`input[name="batch-type"][value="${mode}"]`).checked = true;
      p.window.document.getElementById('range-start').value = '2';
      p.window.document.getElementById('range-end').value = '3';
      p.window.document.getElementById('batch-size').value = '2';
      await p.submit();
      expect(p.files).toHaveLength(1);
      const { blob, name } = p.files[0];
      const text = await blob.text();
      expect(blob.type).toBe(mode === 'batch' ? 'application/zip' : 'text/vcard;charset=utf-8');
      expect(name).toBe(mode === 'batch' ? 'équipe/班_contacts.zip' : mode === 'range' ? 'équipe/班_2-3_contacts.vcf' : 'équipe/班_contacts.vcf');
      expect(text.match(/BEGIN:VCARD/g)).toHaveLength(mode === 'range' ? 2 : 3);
      expect(text).toContain('FN:équipe_班_003');
      if (mode === 'range') expect(text).not.toContain('FN:équipe_班_001');
      if (mode === 'batch') {
        expect(text).toContain('équipe/班_batch1_contacts.vcf');
        expect(text).toContain('équipe/班_batch2_contacts.vcf');
      }
      expect(p.window.document.getElementById('submit-btn').disabled).toBe(false);
    } finally {
      p.close();
    }
  });
}

test('failed exports restore the button and show the existing error status', async () => {
  const p = await page();
  try {
    await selectCsv(p, 'Phone,Name\n1234567890,A');
    p.window.document.querySelector('input[name="batch-type"][value="range"]').checked = true;
    p.window.document.getElementById('range-end').value = '99';
    await p.submit();
    expect(p.files).toHaveLength(0);
    expect(p.window.document.getElementById('status-alert').textContent).toBe('Invalid range values');
    expect(p.window.document.getElementById('submit-btn').disabled).toBe(false);
  } finally {
    p.close();
  }
});
