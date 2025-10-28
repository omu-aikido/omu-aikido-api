import { Context } from "hono";

interface WbgtEntry {
  key: string;
  value: string;
}

async function fetchWbgtData(params: string | null): Promise<WbgtEntry[]> {
  const point = params || "62091";
  const response = await fetch(
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`,
  );

  if (!response.ok) {
    console.error(
      `Failed to fetch WBGT data: ${response.status} - ${response.statusText}`,
    );
    const errorText = await response.text();
    console.error(`Error response body: ${errorText}`);
    return [];
  }

  const csvText = await response.text();
  const lines = csvText.split("\n");

  if (lines.length < 2) {
    console.error("CSV data is too short.");
    return [];
  }

  const headerLine = lines[0];
  const dataLine = lines[1];

  const timeHeaders = headerLine
    .split(",")
    .slice(2)
    .map((h) => h.trim());
  const wbgtValues = dataLine
    .split(",")
    .slice(2)
    .map((v) => v.trim());

  // UTC時刻をJSTに変換（UTC+9）
  const nowUTC = new Date();
  const nowJST = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);

  const todayJST = new Date(
    nowJST.getFullYear(),
    nowJST.getMonth(),
    nowJST.getDate(),
  );
  const tomorrowJST = new Date(todayJST.getTime() + 24 * 60 * 60 * 1000);

  const targetTimes = [
    { date: todayJST, hour: 15 },
    { date: todayJST, hour: 18 },
    { date: tomorrowJST, hour: 15 },
    { date: tomorrowJST, hour: 18 },
  ];

  const entries: WbgtEntry[] = [];

  for (const target of targetTimes) {
    const targetDate = target.date;
    const targetHour = target.hour;

    const year = targetDate.getFullYear();
    const month = (targetDate.getMonth() + 1).toString().padStart(2, "0");
    const day = targetDate.getDate().toString().padStart(2, "0");
    const hour = targetHour.toString().padStart(2, "0");
    const searchTime = `${year}${month}${day}${hour}`;

    let wbgtValue: number | null = null;

    for (let i = 0; i < timeHeaders.length; i++) {
      if (timeHeaders[i] === searchTime) {
        const valueStr = wbgtValues[i];
        if (valueStr) {
          wbgtValue = parseInt(valueStr, 10) / 10;
        }
        break;
      }
    }

    if (wbgtValue !== null) {
      const kvKey = `WBGT_${year}${month}${day}_${hour}`;
      entries.push({ key: kvKey, value: wbgtValue.toString() });
    }
  }
  return entries;
}

async function saveWbgtDataToKV(
  entries: WbgtEntry[],
  env: { WBGT_KV: KVNamespace },
): Promise<void> {
  for (const entry of entries) {
    const existingValue = await env.WBGT_KV.get(entry.key);
    if (existingValue !== entry.value) {
      await env.WBGT_KV.put(entry.key, entry.value, { expirationTtl: 86400 });
    }
  }
}

async function saveWbgt(
  params: string | null,
  env: { WBGT_KV: KVNamespace },
): Promise<void> {
  const entries = await fetchWbgtData(params);
  await saveWbgtDataToKV(entries, env);
}

export async function wbgt(c: Context) {
  const point = new URL(c.req.url).searchParams.get("point");
  const env = c.env;

  const nowUTC = new Date();
  const nowJST = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);

  const todayJST = new Date(
    nowJST.getFullYear(),
    nowJST.getMonth(),
    nowJST.getDate(),
  );
  const tomorrowJST = new Date(todayJST.getTime() + 24 * 60 * 60 * 1000);

  const targetTimes = [
    { date: todayJST, hour: 15 },
    { date: todayJST, hour: 18 },
    { date: tomorrowJST, hour: 15 },
    { date: tomorrowJST, hour: 18 },
  ];

  let shouldUpdateKV = false;
  const kvData: { [key: string]: string | null } = {};

  for (const target of targetTimes) {
    const year = target.date.getFullYear();
    const month = (target.date.getMonth() + 1).toString().padStart(2, "0");
    const day = target.date.getDate().toString().padStart(2, "0");
    const h = target.hour.toString().padStart(2, "0");
    const kvKey = `WBGT_${year}${month}${day}_${h}`;

    const { value, metadata } = await env.WBGT_KV_NAMESPACE.getWithMetadata(
      kvKey,
      { type: "text" },
    );

    if (
      !value ||
      !metadata ||
      (metadata as any).expiration < Math.floor(Date.now() / 1000)
    ) {
      shouldUpdateKV = true;
    }
    kvData[kvKey] = value;
  }

  if (shouldUpdateKV) {
    await saveWbgt(point, { WBGT_KV: env.WBGT_KV_NAMESPACE });
    for (const target of targetTimes) {
      const year = target.date.getFullYear();
      const month = (target.date.getMonth() + 1).toString().padStart(2, "0");
      const day = target.date.getDate().toString().padStart(2, "0");
      const h = target.hour.toString().padStart(2, "0");
      const kvKey = `WBGT_${year}${month}${day}_${h}`;
      kvData[kvKey] = await env.WBGT_KV_NAMESPACE.get(kvKey, { type: "text" });
    }
  }

  return kvData;
}
