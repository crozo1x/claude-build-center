const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="BasePlate app icon">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101826"/>
      <stop offset="0.55" stop-color="#172a45"/>
      <stop offset="1" stop-color="#0b5f78"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#36e58a"/>
      <stop offset="1" stop-color="#13a8d8"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="52" fill="url(#bg)"/>
  <rect x="24" y="24" width="208" height="208" rx="42" fill="none" stroke="#65f2c2" stroke-opacity="0.28" stroke-width="6"/>
  <path d="M55 178h146l20 26H35l20-26Z" fill="url(#plate)"/>
  <path d="M72 70h72c30 0 48 15 48 39 0 15-8 27-21 33 16 5 25 18 25 36 0 28-20 44-52 44H72V70Zm44 33v26h25c12 0 19-5 19-13s-7-13-19-13h-25Zm0 58v28h29c13 0 20-5 20-14s-7-14-20-14h-29Z" fill="#f7fbff"/>
  <path d="M54 177h148" stroke="#0b5f78" stroke-opacity="0.38" stroke-width="5"/>
</svg>
`;

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function blend(dst, index, r, g, b, a) {
  const alpha = a / 255;
  const inverse = 1 - alpha;
  dst[index] = Math.round(r * alpha + dst[index] * inverse);
  dst[index + 1] = Math.round(g * alpha + dst[index + 1] * inverse);
  dst[index + 2] = Math.round(b * alpha + dst[index + 2] * inverse);
  dst[index + 3] = 255;
}

function inRoundRect(px, py, x, y, w, h, radius) {
  const cx = Math.max(x + radius, Math.min(px, x + w - radius));
  const cy = Math.max(y + radius, Math.min(py, y + h - radius));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function drawRoundRect(buf, size, x, y, w, h, radius, color) {
  const scale = size / 256;
  const sx = Math.round(x * scale);
  const sy = Math.round(y * scale);
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  const sr = Math.round(radius * scale);
  for (let py = sy; py < sy + sh; py += 1) {
    for (let px = sx; px < sx + sw; px += 1) {
      if (inRoundRect(px, py, sx, sy, sw, sh, sr)) {
        blend(buf, (py * size + px) * 4, color[0], color[1], color[2], color[3]);
      }
    }
  }
}

function drawRect(buf, size, x, y, w, h, color) {
  const scale = size / 256;
  const sx = Math.round(x * scale);
  const sy = Math.round(y * scale);
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  for (let py = sy; py < sy + sh; py += 1) {
    for (let px = sx; px < sx + sw; px += 1) {
      blend(buf, (py * size + px) * 4, color[0], color[1], color[2], color[3]);
    }
  }
}

function makeIconPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (size * 2);
      const index = (y * size + x) * 4;
      rgba[index] = Math.round(16 + 5 * t);
      rgba[index + 1] = Math.round(24 + 72 * t);
      rgba[index + 2] = Math.round(38 + 82 * t);
      rgba[index + 3] = 255;
    }
  }

  drawRoundRect(rgba, size, 20, 20, 216, 216, 48, [101, 242, 194, 54]);
  drawRoundRect(rgba, size, 28, 28, 200, 200, 40, [10, 16, 28, 92]);
  drawRoundRect(rgba, size, 48, 176, 160, 34, 9, [38, 219, 147, 255]);
  drawRoundRect(rgba, size, 34, 198, 188, 18, 8, [19, 168, 216, 255]);

  const white = [247, 251, 255, 255];
  drawRect(rgba, size, 73, 68, 38, 126, white);
  drawRoundRect(rgba, size, 104, 68, 70, 34, 15, white);
  drawRoundRect(rgba, size, 104, 113, 78, 34, 15, white);
  drawRoundRect(rgba, size, 104, 160, 78, 34, 15, white);
  drawRect(rgba, size, 153, 89, 30, 38, white);
  drawRect(rgba, size, 157, 137, 30, 38, white);

  drawRect(rgba, size, 113, 101, 34, 13, [16, 31, 50, 255]);
  drawRect(rgba, size, 113, 147, 38, 13, [16, 31, 50, 255]);
  return writePng(size, size, rgba);
}

function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map((item) => item.data)]);
}

const sizes = [16, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => ({ size, data: makeIconPng(size) }));
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svg, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngs[pngs.length - 1].data);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), makeIco(pngs));
console.log('Generated assets/icon.svg, assets/icon.png, and assets/icon.ico');
