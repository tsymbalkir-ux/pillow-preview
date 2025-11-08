// /api/events.js — віддає події з Vercel KV з базовими фільтрами і no-store кешем
// CommonJS (Pages API)

const { kv } = require("@vercel/kv");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
};

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS); return res.end();
  }
  if (req.method !== "GET") {
    res.writeHead(405, CORS); return res.end("Method Not Allowed");
  }

  const url = new URL(req.url, "http://localhost");
  const since  = Number(url.searchParams.get("since") || 0);
  const only   = (url.searchParams.get("only") || "").toLowerCase();     // "input"
  const status = (url.searchParams.get("status") || "").toLowerCase();   // "stored"
  const limit  = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)));

  // читаємо останні N (потім фільтруємо і реверсимо до старі→нові)
  const raw = await kv.lrange("events:list", 0, Math.max(500, limit));
  const all = raw.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);

  let out = all.filter(e => {
    if (since && (e.ts || 0) <= since) return false;
    if (only === "input" && !String(e.filename || "").toLowerCase().startsWith("input-")) return false;
    if (status === "stored" && e.type && !(String(e.type).includes("stored") || String(e.type).includes("ready"))) return false;
    return true;
  }).reverse();

  if (out.length > limit) out = out.slice(0, limit);

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS,
  });
  res.end(JSON.stringify(out));
};
