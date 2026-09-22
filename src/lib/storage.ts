// 本机持久化：刷新后待复核状态、历史偏差仍在
// （纯 localStorage 读写 + 形状校验，不掺杂业务规则）

import type { ConsoleState } from "../types";
import { STORAGE_KEY, createInitialState } from "./initialData";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** 宽松校验：关键字段齐全才采用存档，防止旧版本/脏数据导致页面崩溃 */
export function isValidState(v: unknown): v is ConsoleState {
  if (!isRecord(v)) return false;
  return (
    isRecord(v.show) &&
    Array.isArray(v.fixtures) &&
    Array.isArray(v.cues) &&
    Array.isArray(v.trials) &&
    typeof v.selectedCueId === "string" &&
    Array.isArray(v.activeTypes)
  );
}

export function loadState(): ConsoleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed: unknown = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
    return createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: ConsoleState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 私密模式等场景下静默失败，不影响当前会话
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
