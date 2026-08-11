// scripts/make-icons.mjs — 1x1 solid PNG üretici (bağımlılıksız)
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function crc32(buf) { let c, table = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } let crc = 0xffffffff; for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function zlibStored(raw) { const len = raw.length; const buf = Buffer.alloc(len + 11); buf[0] = 0x78; buf[1] = 0x01; buf[2] = 0x01; buf.writeUInt16LE(len & 0xffff, 3); buf.writeUInt16LE(0xffff - (len & 0xffff), 5); raw.copy(buf, 7); let a = 1, b = 0; for (const byte of raw) { a = (a + byte) % 65521; b = (b + a) % 65521; } buf.writeUInt32BE(((b << 16) | a) >>> 0, len + 7); return buf; }
function png(size) { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; const raw = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).fill(Buffer.from([0, 122, 255]))]))); const idat = zlibStored(raw); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]); }
mkdirSync("public/icons", { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(resolve("public/icons/icon" + s + ".png"), png(s));
console.log("icons written");
