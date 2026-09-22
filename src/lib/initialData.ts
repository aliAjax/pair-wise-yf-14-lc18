// 初始演示数据（首次打开时载入；之后以本机存档为准）

import type { ConsoleState } from "../types";

export const STORAGE_KEY = "lighting-cue-review-console:v1";

export function createInitialState(): ConsoleState {
  const fixtures = [
    { id: "FOH-01", channel: "CH 011", gel: "无", color: "#fef3c7", type: "面光" as const, x: 24, y: 8, brightness: 80, focus: "前台中区" },
    { id: "FOH-02", channel: "CH 012", gel: "无", color: "#fef3c7", type: "面光" as const, x: 50, y: 5, brightness: 75, focus: "台口正中" },
    { id: "FOH-03", channel: "CH 013", gel: "浅琥珀 L205", color: "#f59e0b", type: "追光" as const, x: 76, y: 8, brightness: 95, focus: "上场门口" },
    { id: "S-01", channel: "CH 021", gel: "冷蓝 L241", color: "#38bdf8", type: "侧光" as const, x: 6, y: 42, brightness: 65, focus: "二幕侧幕线" },
    { id: "S-02", channel: "CH 022", gel: "冷蓝 L241", color: "#38bdf8", type: "侧光" as const, x: 94, y: 42, brightness: 65, focus: "二幕侧幕线" },
    { id: "B-01", channel: "CH 031", gel: "品红 L327", color: "#e879f9", type: "逆光" as const, x: 30, y: 88, brightness: 55, focus: "后演区逆光" },
    { id: "B-02", channel: "CH 032", gel: "品红 L327", color: "#e879f9", type: "逆光" as const, x: 50, y: 92, brightness: 55, focus: "后演区逆光" },
    { id: "B-03", channel: "CH 033", gel: "品红 L327", color: "#e879f9", type: "逆光" as const, x: 70, y: 88, brightness: 55, focus: "后演区逆光" },
    { id: "FX-01", channel: "CH 041", gel: "深蓝 L120", color: "#06b6d4", type: "效果光" as const, x: 14, y: 70, brightness: 40, focus: "舞台地面光斑" },
    { id: "FX-02", channel: "CH 042", gel: "暖橙 L711", color: "#fb923c", type: "效果光" as const, x: 86, y: 70, brightness: 45, focus: "舞台地面光斑" },
  ];

  const cues = [
    {
      id: "cue-12",
      no: "Cue 12",
      name: "冷蓝侧光",
      order: 1,
      fixtureIds: ["S-01", "S-02", "B-01"],
      plannedAt: "00:04:30",
      memo: "二幕开场，CH 021-028 亮度 65%",
    },
    {
      id: "cue-18",
      no: "Cue 18",
      name: "追光入场",
      order: 2,
      fixtureIds: ["FOH-03"],
      plannedAt: "00:09:12",
      memo: "FOH-03 焦点门口，需演员走位确认",
    },
    {
      id: "cue-20",
      no: "Cue 20",
      name: "逆光群舞",
      order: 3,
      fixtureIds: ["B-01", "B-02", "B-03", "FX-01"],
      plannedAt: "00:14:05",
      memo: "群舞段落，品红逆光 55%",
    },
    {
      id: "cue-24",
      no: "Cue 24",
      name: "暖色谢幕",
      order: 4,
      fixtureIds: ["FOH-01", "FOH-02", "FOH-03"],
      plannedAt: "00:22:40",
      memo: "版本 B，全台面光 80%",
    },
  ];

  const iso = (y: number, mo: number, d: number, h: number, mi: number, s: number) =>
    new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString();

  const trials = [
    // Cue 12：上次排练偏差 11s，已走完全部复核流程（历史保留，当前已解锁）
    {
      id: "t-c12-flag",
      cueId: "cue-12",
      kind: "run" as const,
      plannedAt: "00:04:30",
      actualAt: "00:04:41",
      operator: "小林",
      reason: "侧光换色片延迟，机械推杆卡顿",
      deviationSec: 11,
      flagged: true,
      flagReasons: ["偏差 +11s，超过 8 秒"],
      review: {
        director: "导演·周",
        conclusion: "二幕前完成推杆检修，冷蓝侧光提前 2 拍预备，准予复演。",
        allowReplay: true,
        decidedAt: iso(2026, 9, 20, 16, 10, 0),
      },
      closesTrialId: null,
      createdAt: iso(2026, 9, 20, 15, 42, 0),
    },
    {
      id: "t-c12-replay",
      cueId: "cue-12",
      kind: "replay" as const,
      plannedAt: "00:04:30",
      actualAt: "00:04:32",
      operator: "小林",
      reason: "复演：按新预备点执行",
      deviationSec: 2,
      flagged: false,
      flagReasons: [],
      review: null,
      closesTrialId: "t-c12-flag",
      createdAt: iso(2026, 9, 20, 16, 25, 0),
    },
    // Cue 18：今晚试运行操作人漏登 -> 待复核（当前锁定 FOH-03）
    {
      id: "t-c18-flag",
      cueId: "cue-18",
      kind: "run" as const,
      plannedAt: "00:09:12",
      actualAt: "00:09:14",
      operator: "",
      reason: "",
      deviationSec: 2,
      flagged: true,
      flagReasons: ["操作人为空"],
      review: null,
      closesTrialId: null,
      createdAt: iso(2026, 9, 22, 19, 30, 0),
    },
    // Cue 20：正常通过
    {
      id: "t-c20-ok",
      cueId: "cue-20",
      kind: "run" as const,
      plannedAt: "00:14:05",
      actualAt: "00:14:06",
      operator: "阿敏",
      reason: "",
      deviationSec: 1,
      flagged: false,
      flagReasons: [],
      review: null,
      closesTrialId: null,
      createdAt: iso(2026, 9, 22, 19, 38, 0),
    },
  ];

  return {
    show: {
      showName: "《雾港之夜》",
      versionNote: "版本 B · 2026-09-22 联排，追光入场待导演复核",
    },
    fixtures,
    cues,
    trials,
    selectedCueId: "cue-18",
    activeTypes: [],
  };
}
