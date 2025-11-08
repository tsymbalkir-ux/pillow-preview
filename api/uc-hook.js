// api/uc-hook.js — Vercel Serverless (Node, CommonJS). Без JSONBin.
// Зберігає останні події в пам'яті (globalThis.EVENTS) для читання через /api/events.

const crypto = require("crypto");

// локальний буфер подій (у пам'яті функції)
function BUF() { return (globalThis.EVENTS ||= []); }
function bumpVer() { globalThis.EV_VER = (globalThis.EV_VER || 0) + 1; } // для ETag у /api/events

function safeJsonParse(text) {
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // 1) Збираємо сире тіло (для перевірки підпису)
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const rawBody = Buffer.concat(chunks);
  const rawText = rawBody.toString() || "";
  const ct = (req.headers["content-type"] || "").toLowerCase();

  // 2) Перевіряємо підпис Uploadcare (X-Uc-Signature: v1=<hex>)
  try {
    const sig = req.headers["x-uc-signature"] || "";
    const expected =
      "v1=" +
      crypto
        .createHmac("sha256", process.env.UC_SIGNING_SECRET || "")
        .update(rawBody)
        .digest("hex");

    if (sig !== expected) {
      console.warn("uc-hook: bad signature");
      return res.status(401).end("bad signature");
    }
  } catch (e) {
    console.warn("uc-hook: signature verify error", e);
    return res.status(401).end("bad signature");
  }

  // 3) Парсимо payload (JSON або x-www-form-urlencoded)
  let payload = {};
  if (ct.includes("application/json")) {
    payload = safeJsonParse(rawText);
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawText);
    const event = params.get("event") || params.get("Event");
    const dataStr = params.get("data") || params.get("Data") || "{}";
    payload = { event, data: safeJsonParse(dataStr) };
  } else {
    payload = safeJsonParse(rawText);
  }

  // 4) Дістаємо корисні поля
  const data = payload?.data || payload?.file || payload || {};
  const uuid = data.uuid || data.file_id || null;
  const filenameRaw = (data.filename || data.original_filename || "").toString();
  const filename = filenameRaw.toLowerCase();
  const cdnUrl = data.cdn_url || data.original_file_url || null;

  // 5) Беремо лише вхідні файли (input-*), ігноруємо output/ready/порожні
  if (!filename || !filename.startsWith("input")) {
    console.log("uc-hook: skip non-input file:", filenameRaw || "(no name)");
    return res.status(200).end("skipped");
  }

  // 6) Записуємо подію у пам’ять
  const ev = {
    ts: Date.now(),
    event: payload.event || "file.uploaded",
    uuid: uuid || "",
    cdn_url: cdnUrl || "",
    filename: filenameRaw || "",
  };

  const buf = BUF();
  buf.unshift(ev);
  if (buf.length > 200) buf.length = 200; // тримаємо тільки останні 200
  bumpVer();

  console.log("uc-hook: stored event", ev.uuid, ev.filename);

  // 7) Готово
  res.status(200).end("ok");
};

// вимикаємо вбудований парсер, щоб мати сире тіло для підпису
module.exports.config = { api: { bodyParser: false } };
