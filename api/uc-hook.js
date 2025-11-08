// api/uc-hook.js — Vercel Serverless Function (CommonJS)
const crypto = require("crypto");

/* ------------------- helpers ------------------- */
function safeJsonParse(text) {
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}
function normArray(rec) {
  // нормалізуємо будь-який вміст JSONBin до масиву
  if (Array.isArray(rec)) return rec;
  if (rec && typeof rec === "object" && ("uuid" in rec || "items" in rec)) {
    if (Array.isArray(rec.items)) return rec.items;
    if ("uuid" in rec) return [rec];
  }
  return [];
}
function dedupeByUuid(arr) {
  const by = new Map();
  for (const x of arr) if (x && x.uuid) by.set(String(x.uuid), { ...by.get(String(x.uuid)), ...x });
  return Array.from(by.values());
}
async function jsonbinLatest() {
  const url = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_ID}/latest?_t=${Date.now()}`;
  const r = await fetch(url, { headers: { "X-Master-Key": process.env.JSONBIN_KEY, "Cache-Control": "no-cache" } });
  if (!r.ok) throw new Error(`jsonbin latest ${r.status}`);
  const j = await r.json();
  return normArray(j.record);
}
async function jsonbinPut(arr) {
  const url = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_ID}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { "X-Master-Key": process.env.JSONBIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(arr),
  });
  if (!r.ok) throw new Error(`jsonbin put ${r.status}: ${await r.text()}`);
}
async function ucStoreIfNeeded(uuid, isStored) {
  if (!uuid || isStored) return;
  if (!process.env.UC_PUBLIC_KEY || !process.env.UC_SECRET_KEY) return;
  const r = await fetch(`https://api.uploadcare.com/files/${uuid}/storage/`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.uploadcare-v0.5+json",
      "Content-Type": "application/json",
      "Authorization": `Uploadcare.Simple ${process.env.UC_PUBLIC_KEY}:${process.env.UC_SECRET_KEY}`,
    },
  });
  if (!r.ok) {
    const t = await r.text();
    console.warn("store failed:", r.status, t);
  }
}

/* ------------------- handler ------------------- */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 1) Сире тіло (для підпису)
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const rawBody = Buffer.concat(chunks);
  const rawText = rawBody.toString() || "";
  const ct = (req.headers["content-type"] || "").toLowerCase();

  // 2) Перевірка підпису Uploadcare
  try {
    const sig = req.headers["x-uc-signature"]; // формат: v1=<hex>
    const expected = "v1=" + crypto.createHmac("sha256", process.env.UC_SIGNING_SECRET).update(rawBody).digest("hex");
    if (sig !== expected) {
      console.warn("bad signature");
      return res.status(401).end("bad signature");
    }
  } catch (e) {
    console.warn("signature verify error", e);
    return res.status(401).end("bad signature");
  }

  // 3) Відповідаємо миттєво (щоб не було ретраїв)
  res.status(200).end();

  // 4) Парсимо payload (JSON або x-www-form-urlencoded)
  let payload = {};
  if (ct.includes("application/json")) {
    payload = safeJsonParse(rawText);
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawText);
    const event = params.get("event") || params.get("Event");
    const dataStr = params.get("data") || params.get("Data") || "";
    const data = safeJsonParse(dataStr);
    payload = { event, data };
  } else {
    payload = safeJsonParse(rawText); // на всяк випадок
  }

  // 5) Дістаємо поля з різних форм
  const data = payload?.data || payload?.file || payload || {};
  const uuid = data.uuid || data.file_id || null;
  const filenameRaw = (data.filename || data.original_filename || "").toString();
  const filename = filenameRaw.toLowerCase();
  const cdnUrl = data.cdn_url || data.original_file_url || null;
  const isStored = !!data.is_stored;

  // 6) Фільтр: беремо тільки ВХІДНІ файли (input-*), ігноруємо output/ready
  if (!filename || !(filename.startsWith("input"))) {
    console.log("UC HOOK: skip non-input file:", filenameRaw || "(no name)");
    return;
  }

  console.log("UC EVENT:", payload.event || "no-event", uuid || "no-uuid", cdnUrl || "no-cdn", filenameRaw);

  // 7) (опція) автозберігання, якщо файл ще не stored
  try { await ucStoreIfNeeded(uuid, isStored); } catch (e) { console.warn("store error", e); }

  // 8) Оновлюємо JSONBin (масив), ідемпотентно по uuid
  if (!process.env.JSONBIN_ID || !process.env.JSONBIN_KEY || !uuid) return;

  try {
    const arr = await jsonbinLatest();

    const rec = {
      uuid,
      filename: filenameRaw,
      cdn_url: cdnUrl || null,
      is_stored: true,            // після auto-store гарантовано true (або лишиться true, якщо і так було)
      role: "input",              // маркуємо, що це саме вхідний файл
      ts: Date.now(),
    };

    // оновлюємо/додаємо
    const merged = dedupeByUuid([rec, ...arr]).slice(0, 100);
    await jsonbinPut(merged);
  } catch (e) {
    console.error("jsonbin write error", e);
  }
};

module.exports.config = { api: { bodyParser: false } };
