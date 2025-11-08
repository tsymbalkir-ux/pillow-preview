// /api/uc-hook.js — приймає вебхук Uploadcare і кладе подію у Vercel KV
// CommonJS (Pages API). Потрібні ENV: UC_SIGNING_SECRET + KV_* (Vercel KV)
// npm i @vercel/kv

const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const KEY_LIST = "events:list";          // LPUSH останніх подій
const KEY_SEEN = (uuid) => `events:seen:${uuid}`; // маркер від дублювання
const LIST_MAX = 1000;

// вимикаємо bodyParser — нам треба сире тіло для підпису
module.exports.config = { api: { bodyParser: false } };

function safeJson(text) { try { return text ? JSON.parse(text) : {}; } catch { return {}; } }
function normEvent(payload) {
  const data = payload?.data || payload?.file || payload || {};
  const filenameRaw = (data.filename || data.original_filename || data.name || "").toString();
  const type = String(payload.event || data.type || data.kind || data.event || "").toLowerCase();
  const uuid = String(data.uuid || data.file_id || data.id || "").trim();
  const cdn_url = data.cdn_url || data.original_file_url || data.url || "";

  // unix time (ms)
  const tsRaw = data.ts || data.timestamp || data.time || Date.now();
  const ts = typeof tsRaw === "number" && tsRaw < 2e12 ? tsRaw : Date.now();

  return { uuid, filename: filenameRaw, type, cdn_url, ts };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // 1) сире тіло для перевірки підпису
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const rawBody = Buffer.concat(chunks);
  const ct = (req.headers["content-type"] || "").toLowerCase();

  // 2) перевірка підпису UC (X-Uc-Signature: v1=<hmac sha256>)
  try {
    const sig = req.headers["x-uc-signature"] || "";
    const expected = "v1=" + crypto.createHmac("sha256", process.env.UC_SIGNING_SECRET || "")
                                   .update(rawBody).digest("hex");
    if (sig !== expected) return res.status(401).end("bad signature");
  } catch (e) {
    console.warn("uc-hook: signature verify error", e);
    return res.status(401).end("bad signature");
  }

  // 3) парсимо payload (json / x-www-form-urlencoded)
  let payload = {};
  if (ct.includes("application/json")) {
    payload = safeJson(rawBody.toString());
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody.toString());
    payload = { event: params.get("event") || params.get("Event"),
                data: safeJson(params.get("data") || params.get("Data") || "{}") };
  } else {
    payload = safeJson(rawBody.toString());
  }

  // 4) нормалізація і фільтри
  const e = normEvent(payload);
  if (!e.uuid) return res.status(200).end("skip: no uuid");
  if (!e.filename || !e.filename.toLowerCase().startsWith("input-"))
    return res.status(200).end("skip: not input-*");
  if (!e.cdn_url || !e.cdn_url.includes("ucarecdn.com"))
    return res.status(200).end("skip: no cdn_url");
  // якщо приходить тип — пропустимо тільки stored/ready
  if (e.type && !(e.type.includes("stored") || e.type.includes("ready")))
    return res.status(200).end("skip: not stored/ready");

  // 5) ідемпотентне збереження в KV
  const seenKey = KEY_SEEN(e.uuid);
  const already = await kv.get(seenKey);
  if (!already) {
    await kv.set(seenKey, 1, { ex: 60 * 60 * 24 * 7 }); // 7 днів
    await kv.lpush(KEY_LIST, JSON.stringify(e));
    await kv.ltrim(KEY_LIST, 0, LIST_MAX - 1);
  }

  console.log("uc-hook: stored", e.uuid, e.filename);
  res.status(200).end("ok");
};
