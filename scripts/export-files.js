// Original browser export helpers. No spreadsheet parsing or contact formatting lives here.
globalThis.ContactFiles = (() => {
  const encoder = new TextEncoder();
  const max32 = 0xffffffff;
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return value >>> 0;
  });

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    try {
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Revoking immediately can cancel a download before the browser reads it.
      setTimeout(() => URL.revokeObjectURL(url), 40000);
    }
  }

  function write64(view, offset, value) {
    view.setUint32(offset, value % 0x100000000, true);
    view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
  }

  function yieldToBrowser() {
    return new Promise(resolve => {
      if (typeof MessageChannel === "undefined") {
        setTimeout(resolve, 0);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }

  async function createZip(files) {
    const entries = new Map();
    for (const { name, content } of files) {
      // Match the existing batch export's automatic directory entries.
      const parents = [];
      let path = name;
      let slash = path.lastIndexOf("/");
      while (slash > 0) {
        path = path.slice(0, slash);
        const parent = path.endsWith("/") ? path : `${path}/`;
        if (entries.has(parent)) break;
        parents.unshift(parent);
        if (path.endsWith("/")) path = path.slice(0, -1);
        slash = path.lastIndexOf("/");
      }
      for (const parent of parents) entries.set(parent, "");
      entries.set(name, content);
    }

    const now = new Date();
    const date = ((Math.min(2107, Math.max(1980, now.getFullYear())) - 1980) << 9)
      | ((now.getMonth() + 1) << 5) | now.getDate();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5)
      | Math.floor(now.getSeconds() / 2);
    const parts = [];
    const directory = [];
    let offset = 0;
    let directorySize = 0;
    let count = 0;
    let yieldAt = Date.now() + 2;

    for (const [name, content] of entries) {
      const filename = encoder.encode(name);
      if (filename.length > 0xffff) {
        throw new Error("A batch filename is too long for ZIP export");
      }
      const chunks = [];
      let dataSize = 0;
      let crc = max32;
      for (let start = 0; start < content.length;) {
        let end = Math.min(start + 65536, content.length);
        // Never split a UTF-16 surrogate pair across independently encoded chunks.
        const last = content.charCodeAt(end - 1);
        if (end < content.length && last >= 0xd800 && last <= 0xdbff) end--;
        const data = encoder.encode(content.slice(start, end));
        for (let index = 0; index < data.length; index++) {
          crc = (crc >>> 8) ^ crcTable[(crc ^ data[index]) & 255];
        }
        chunks.push(data);
        dataSize += data.length;
        start = end;
        if (Date.now() >= yieldAt) {
          await yieldToBrowser();
          yieldAt = Date.now() + 2;
        }
      }
      crc = (crc ^ max32) >>> 0;

      const largeSize = dataSize >= max32;
      const largeOffset = offset >= max32;
      const localExtraSize = largeSize ? 20 : 0;
      const local = new Uint8Array(30 + filename.length + localExtraSize);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, largeSize ? 45 : 20, true);
      localView.setUint16(6, 0x800, true); // UTF-8 names, STORE method.
      localView.setUint16(10, time, true);
      localView.setUint16(12, date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, largeSize ? max32 : dataSize, true);
      localView.setUint32(22, largeSize ? max32 : dataSize, true);
      localView.setUint16(26, filename.length, true);
      localView.setUint16(28, localExtraSize, true);
      local.set(filename, 30);
      if (largeSize) {
        const start = 30 + filename.length;
        localView.setUint16(start, 1, true);
        localView.setUint16(start + 2, 16, true);
        write64(localView, start + 4, dataSize);
        write64(localView, start + 12, dataSize);
      }

      const extraSize = (largeSize ? 16 : 0) + (largeOffset ? 8 : 0);
      const central = new Uint8Array(46 + filename.length + (extraSize ? extraSize + 4 : 0));
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true); // DOS filesystem attributes.
      centralView.setUint16(6, largeSize || largeOffset ? 45 : 20, true);
      centralView.setUint16(8, 0x800, true);
      centralView.setUint16(12, time, true);
      centralView.setUint16(14, date, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, largeSize ? max32 : dataSize, true);
      centralView.setUint32(24, largeSize ? max32 : dataSize, true);
      centralView.setUint16(28, filename.length, true);
      centralView.setUint16(30, extraSize ? extraSize + 4 : 0, true);
      centralView.setUint32(38, name.endsWith("/") ? 0x10 : 0, true);
      centralView.setUint32(42, largeOffset ? max32 : offset, true);
      central.set(filename, 46);
      if (extraSize) {
        let start = 46 + filename.length;
        centralView.setUint16(start, 1, true);
        centralView.setUint16(start + 2, extraSize, true);
        start += 4;
        if (largeSize) {
          write64(centralView, start, dataSize);
          write64(centralView, start + 8, dataSize);
          start += 16;
        }
        if (largeOffset) write64(centralView, start, offset);
      }
      parts.push(local);
      for (const chunk of chunks) parts.push(chunk);
      directory.push(central);
      offset += local.length + dataSize;
      directorySize += central.length;
      count++;
      if (!Number.isSafeInteger(offset + directorySize)) {
        throw new Error("ZIP export exceeds the browser's supported size");
      }
      if (Date.now() >= yieldAt) {
        await yieldToBrowser();
        yieldAt = Date.now() + 2;
      }
    }

    for (const record of directory) parts.push(record);
    if (count >= 0xffff || offset >= max32 || directorySize >= max32) {
      const zip64 = new DataView(new ArrayBuffer(76));
      zip64.setUint32(0, 0x06064b50, true);
      write64(zip64, 4, 44);
      zip64.setUint16(12, 45, true);
      zip64.setUint16(14, 45, true);
      write64(zip64, 24, count);
      write64(zip64, 32, count);
      write64(zip64, 40, directorySize);
      write64(zip64, 48, offset);
      zip64.setUint32(56, 0x07064b50, true);
      write64(zip64, 64, offset + directorySize);
      zip64.setUint32(72, 1, true);
      parts.push(zip64.buffer);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, Math.min(count, 0xffff), true);
    end.setUint16(10, Math.min(count, 0xffff), true);
    end.setUint32(12, Math.min(directorySize, max32), true);
    end.setUint32(16, Math.min(offset, max32), true);
    parts.push(end.buffer);
    return new Blob(parts, { type: "application/zip" });
  }

  return { downloadBlob, createZip };
})();
