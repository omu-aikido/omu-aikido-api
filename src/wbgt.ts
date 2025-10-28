/**
 * WBGT helper for fetching latest WBGT CSV data, caching to KV, and returning values.
 *
 * Goals for refactor:
 * - Improve error handling and logging.
 * - Deduplicate time-window logic (target times for today/tomorrow at 15:00/18:00 JST).
 * - Separate concerns: fetching, parsing, KV read/write, and orchestration.
 *
 * Notes:
 * - Exports `wbgt(c: Context)` which returns a map of KV keys -> string|null values.
 * - Uses `env.WBGT_KV_NAMESPACE` (KVNamespace) for storage and expects `c.env` to provide it.
 */

import { Context } from "hono";

interface WbgtEntry {
  key: string;
  value: string;
}

interface WbgtEnv {
  WBGT_KV_NAMESPACE: KVNamespace;
}

/**
 * Compute the target times in JST for which we want WBGT values:
 * - Today 15:00 JST
 * - Today 18:00 JST
 * - Tomorrow 15:00 JST
 * - Tomorrow 18:00 JST
 *
 * Returns an array of objects { date: Date, hour: number } where date is a local (JST) date with time zeroed.
 */
function computeTargetTimeWindows(
  nowUtc = new Date(),
): { date: Date; hour: number }[] {
  // Convert current UTC to JST by adding 9 hours
  const nowJst = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);

  const todayJst = new Date(
    nowJst.getFullYear(),
    nowJst.getMonth(),
    nowJst.getDate(),
  );
  const tomorrowJst = new Date(todayJst.getTime() + 24 * 60 * 60 * 1000);

  return [
    { date: todayJst, hour: 15 },
    { date: todayJst, hour: 18 },
    { date: tomorrowJst, hour: 15 },
    { date: tomorrowJst, hour: 18 },
  ];
}

/**
 * Format a target time into search string used by the CSV header, e.g. 2025101415
 */
function formatSearchTime(date: Date, hour: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

/**
 * Build KV key used to store WBGT values: `WBGT_YYYYMMDD_HH`
 */
function buildKvKey(date: Date, hour: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `WBGT_${y}${m}${d}_${h}`;
}

/**
 * Fetch CSV from remote WBGT source for a given point.
 * Returns raw CSV text.
 */
async function fetchWbgtCsv(point: string): Promise<string> {
  const url = `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(
      `Failed to fetch WBGT CSV (${res.status} ${res.statusText}): ${body}`,
    );
  }
  return await res.text();
}

/**
 * Parse CSV payload and return time headers and associated WBGT numeric strings.
 * Expected CSV shape: first line = header with times in columns from column index 2 onward,
 * second line = values correspondingly.
 *
 * Returns { headers: string[], values: string[] }
 * Throws an error when CSV is malformed.
 */
function parseWbgtCsv(csvText: string): {
  headers: string[];
  values: string[];
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("WBGT CSV: not enough lines");

  const headerLine = lines[0];
  const dataLine = lines[1];

  const headers = headerLine
    .split(",")
    .slice(2)
    .map((s) => s.trim());
  const values = dataLine
    .split(",")
    .slice(2)
    .map((s) => s.trim());

  if (headers.length === 0 || headers.length !== values.length) {
    throw new Error("WBGT CSV: header/value length mismatch");
  }

  return { headers, values };
}

/**
 * Given parsed CSV headers/values and desired search times, extract matching WBGT entries.
 * Returns array of { key, value } where value is string representation (e.g. '25.3')
 */
function extractEntriesFromCsv(
  headers: string[],
  values: string[],
  targets: { date: Date; hour: number }[],
): WbgtEntry[] {
  const entries: WbgtEntry[] = [];

  for (const t of targets) {
    const searchTime = formatSearchTime(t.date, t.hour);
    const idx = headers.indexOf(searchTime);
    if (idx === -1) continue;

    const raw = values[idx];
    if (!raw) continue;

    // Original CSV appears to store tenths; the original code divided by 10
    // Attempt parse and normalize to a human-friendly decimal
    const intVal = parseInt(raw, 10);
    if (isNaN(intVal)) continue;
    const wbgt = intVal / 10;
    const key = buildKvKey(t.date, t.hour);
    entries.push({ key, value: String(wbgt) });
  }

  return entries;
}

/**
 * Fetch WBGT entries (keys + values) for a given point param.
 * If fetch/parsing fails, this function throws.
 */
async function fetchWbgtData(params: string | null): Promise<WbgtEntry[]> {
  const point = params || "62091";
  const csvText = await fetchWbgtCsv(point);
  const { headers, values } = parseWbgtCsv(csvText);
  const targets = computeTargetTimeWindows();
  return extractEntriesFromCsv(headers, values, targets);
}

/**
 * Save entries to KV if they differ from existing values.
 * Uses TTL of 86400 seconds (1 day) consistent with original behavior.
 */
async function saveWbgtDataToKV(
  entries: WbgtEntry[],
  env: WbgtEnv,
): Promise<void> {
  const ttlSeconds = 86400; // 1 day
  for (const entry of entries) {
    try {
      const existing = await env.WBGT_KV_NAMESPACE.get(entry.key, {
        type: "text",
      });
      if (existing !== entry.value) {
        await env.WBGT_KV_NAMESPACE.put(entry.key, entry.value, {
          expirationTtl: ttlSeconds,
        });
      }
    } catch (err) {
      // Log and continue with other entries, do not fail the whole process
      console.error(`Failed to write KV key=${entry.key}`, err);
    }
  }
}

/**
 * Read KV values for target times and determine if an update is required.
 * Returns:
 * - kvData: map of key -> string|null
 * - shouldUpdate: boolean whether any missing/expired value found.
 *
 * We're conservative: if getWithMetadata isn't available or metadata lacks expiration,
 * we'll treat missing values as needing update.
 */
async function readKvForTargets(
  env: WbgtEnv,
): Promise<{ kvData: Record<string, string | null>; shouldUpdate: boolean }> {
  const targets = computeTargetTimeWindows();
  const kvData: Record<string, string | null> = {};
  let shouldUpdate = false;

  for (const t of targets) {
    const key = buildKvKey(t.date, t.hour);

    try {
      // Prefer getWithMetadata to inspect expiration (Cloudflare Worker KV includes metadata)
      // But fall back to simple get if unavailable.
      // @ts-ignore - allow optional getWithMetadata
      if (typeof env.WBGT_KV_NAMESPACE.getWithMetadata === "function") {
        // We expect getWithMetadata to return { value, metadata }
        // Use text type for value
        // @ts-ignore
        const result = await env.WBGT_KV_NAMESPACE.getWithMetadata(key, {
          type: "text",
        });
        const value = result?.value ?? null;
        const metadata = result?.metadata;
        kvData[key] = value;
        // If value is missing, mark update
        if (!value) {
          shouldUpdate = true;
          continue;
        }
        // If metadata contains expiration and it's in the past, mark update
        const expiration = metadata && (metadata as any).expiration;
        if (
          expiration &&
          typeof expiration === "number" &&
          expiration < Math.floor(Date.now() / 1000)
        ) {
          shouldUpdate = true;
        }
      } else {
        // Fallback: simple get
        const value = await env.WBGT_KV_NAMESPACE.get(key, { type: "text" });
        kvData[key] = value;
        if (!value) shouldUpdate = true;
      }
    } catch (err) {
      // If KV read errors, log and treat as needing update
      console.error(`Error reading KV for key=${key}`, err);
      kvData[key] = null;
      shouldUpdate = true;
    }
  }

  return { kvData, shouldUpdate };
}

/**
 * Orchestrator: ensure KV is up-to-date and return kvData for target times.
 * This function intentionally does not write HTTP responses; it returns plain data so callers decide behavior.
 */
export async function wbgt(c: Context): Promise<Record<string, string | null>> {
  const point = new URL(c.req.url).searchParams.get("point");
  const env = c.env as unknown as WbgtEnv;

  // Validate env
  if (!env || !env.WBGT_KV_NAMESPACE) {
    console.error("WBGT KV namespace not provided in env");
    throw new Error("WBGT KV not configured");
  }

  // Step 1: read existing KV values and determine if update necessary
  const { kvData: initialKvData, shouldUpdate } = await readKvForTargets(env);

  // If update is required, fetch remote CSV and write to KV, then re-read
  if (shouldUpdate) {
    try {
      const entries = await fetchWbgtData(point);
      if (entries.length > 0) {
        await saveWbgtDataToKV(entries, env);
      } else {
        // If fetch succeeded but no entries were found, log (but do not fail)
        console.warn(
          "WBGT fetch returned no entries for targets; KV not updated.",
        );
      }
    } catch (err) {
      // If fetching/parsing fails, log error and proceed to return whatever KV data we have.
      console.error("Failed to fetch or save WBGT data:", err);
    }

    // Re-read KV values after attempted update
    const { kvData: refreshedKvData } = await readKvForTargets(env);
    return refreshedKvData;
  }

  // No update required, return initial data
  return initialKvData;
}
