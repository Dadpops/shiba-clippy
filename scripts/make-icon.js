// Generates a minimal 16x16 + 32x32 orange .ico file
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeColorPNG(w, h, r, g, b) {
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  function crc32(buf) {
    let c = -1;
    for (const byte of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ byte) & 0xff];
    return (c ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcBuf]);
  }
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const base = y * (1 + w * 3);
    raw[base] = 0;
    for (let x = 0; x < w; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeICO(sizes, r, g, b) {
  const images = sizes.map(size => makeColorPNG(size, size, r, g, b));

  // ICO header: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  // Directory entries: 16 bytes each
  const dirSize = sizes.length * 16;
  let offset = 6 + dirSize;
  const dirs = images.map((img, i) => {
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;   // width (0 = 256)
    entry[1] = size >= 256 ? 0 : size;   // height
    entry[2] = 0;                         // color count
    entry[3] = 0;                         // reserved
    entry.writeUInt16LE(1, 4);            // planes
    entry.writeUInt16LE(32, 6);           // bit count
    entry.writeUInt32LE(img.length, 8);   // size of image data
    entry.writeUInt32LE(offset, 12);      // offset
    offset += img.length;
    return entry;
  });

  return Buffer.concat([header, ...dirs, ...images]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

fs.writeFileSync(
  path.join(assetsDir, 'icon.ico'),
  makeICO([16, 32, 48, 256], 0xe6, 0x8a, 0x00)
);

console.log('Generated assets/icon.ico');
