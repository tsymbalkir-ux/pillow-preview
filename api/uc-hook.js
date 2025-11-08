// /api/uc-hook.js — Uploadcare → Google Sheets (через Apps Script)
const TEXT_OK = (res, msg = "ok") => res.status(200).send(msg);
const TEXT_ERR = (res, code, msg) => res.status(code).send(msg);

// CORS (на випадок перевірок)
const setCORS = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
function pickEvent(body) {
  // Uploadcare надсилає {event, data:{...}} або одразу { ... }
  const src = body?.data || body?.file || body || {};
  const filename = String(src.filename || src.original_filename || src.name || "").trim();
  const uuid = String(src.uuid || src.id || src.file_id || "").trim();
  const cdn_url = String(src.cdn_url || src.original_file_url || src.url || "").trim();
  const type = String(body?.event || src.type || src.kind || src.event || "").toLowerCase();
  const tsRaw = src.ts || src.timestamp || src.time || Date.now();
  const ts = typeof tsRaw === "number" && tsRaw < 2e12 ? tsRaw : Date.now();
  return { uuid, filename, cdn_url, type, ts };
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return TEXT_ERR(res, 405, "Method Not Allowed");

  // 1) Парсимо тіло (Next Pages API вже розпарсить JSON; але підстрахуємось)
  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const e = pickEvent(body);

  // 2) Базові фільтри — щоб не плодити сміття
  if (!e.uuid)                   return TEXT_OK(res, "skip: no uuid");
  if (!e.filename || !e.filename.toLowerCase().startsWith("input-"))
                                return TEXT_OK(res, "skip: not input-*");
  if (!e.cdn_url || !e.cdn_url.includes("ucarecdn.com"))
                                return TEXT_OK(res, "skip: no cdn_url");
  if (e.type && !(e.type.includes("stored") || e.type.includes("ready")))
                                return TEXT_OK(res, "skip: not stored/ready");

  // 3) Надсилаємо в Google Apps Script Web App
  const WEBAPP = process.env.SHEET_WEBAPP_URL;
  const SHARED = process.env.SHEET_SHARED_SECRET || ""; // опційно

  if (!WEBAPP) return TEXT_ERR(res, 500, "SHEET_WEBAPP_URL is not set");

  const payload = {
    source: "uploadcare",
    ts: e.ts,
    uuid: e.uuid,
    filename: e.filename,
    cdn_url: e.cdn_url,
    type: e.type || "",
    secret: SHARED, // якщо хочеш просту перевірку на стороні скрипта
  };

  try {
    const resp = await fetch(WEBAPP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return TEXT_ERR(res, 502, "sheet error: " + t.slice(0, 200));
    }
    return TEXT_OK(res, "ok");
  } catch (err) {
    return TEXT_ERR(res, 500, "fetch error: " + (err?.message || String(err)));
  }
};
