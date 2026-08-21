import type { ArcJson, ArcUpstreamReq } from "./arc-types";

const ROOT = "https://three.arcprize.org";

function apiKey(): string {
  const key = process.env.ARC_API_KEY?.trim();
  if (!key) throw new Error("ARC_API_KEY is not set");
  return key;
}

function assertPath(path: string) {
  if (
    path === "/api/games" ||
    path.startsWith("/api/scorecard/") ||
    path.startsWith("/api/cmd/")
  ) {
    return;
  }
  throw new Error("blocked path");
}

function mergeCookie(prev: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of prev.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const sc of setCookies) {
    const pair = sc.split(";")[0]?.trim() ?? "";
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    map.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function arcUpstream(req: ArcUpstreamReq): Promise<{
  ok: boolean;
  status: number;
  json: ArcJson;
  cookie: string;
}> {
  assertPath(req.path);
  const method = req.method ?? (req.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Key": apiKey(),
  };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  if (req.cookie) headers.Cookie = req.cookie;

  const res = await fetch(`${ROOT}${req.path}`, {
    method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });

  const setCookies =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const text = await res.text();
  let json: ArcJson = null;
  if (text) {
    try {
      json = JSON.parse(text) as ArcJson;
    } catch {
      json = { error: "non-json", raw: text.slice(0, 400) };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    json,
    cookie: mergeCookie(req.cookie ?? "", setCookies),
  };
}
