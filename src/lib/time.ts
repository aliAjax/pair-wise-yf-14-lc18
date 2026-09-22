// 时间码工具：排练时钟采用 HH:MM:SS（或 MM:SS）相对计时，不依赖真实日期。
// 状态计算层只依赖这里的纯函数，便于单独核对。

/** 解析排练时钟时间码为秒数；无法解析时返回 null */
export function parseClock(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/** 偏差秒数 = 实际 - 计划；任一缺失返回 null */
export function deviationSeconds(plannedAt: string, actualAt: string): number | null {
  const planned = parseClock(plannedAt);
  const actual = parseClock(actualAt);
  if (planned === null || actual === null) return null;
  return actual - planned;
}

/** 带符号的偏差展示，如 +9.0s / -3.5s / 0s */
export function formatSigned(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  if (rounded === 0) return "0s";
  return `${rounded > 0 ? "+" : ""}${rounded}s`;
}

/** HH:MM:SS 规范化展示 */
export function normalizeClock(value: string): string {
  const sec = parseClock(value);
  if (sec === null) return value;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
