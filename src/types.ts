/** 排练偏差复核台 · 数据模型 */

/** 灯具类别（用于筛选与舞台图着色） */
export type FixtureCategory = "面光" | "侧光" | "逆光" | "效果光";

/** 灯具 */
export interface Fixture {
  id: string;
  /** 灯具编号，如 FOH-03 */
  code: string;
  /** 通道号，如 CH 021 */
  channel: string;
  category: FixtureCategory;
  /** 色片，如 L201 冷蓝 */
  gel: string;
  /** 舞台平面灯位图坐标（百分比 0-100） */
  x: number;
  y: number;
}

/** 一次试运行登记（含正式复演，isRerun 区分） */
export interface RunRecord {
  id: string;
  /** 计划触发时间，格式 mm:ss（演出内时间码） */
  plannedTime: string;
  /** 实际触发时间，格式 mm:ss */
  actualTime: string;
  /** 偏差秒数（实际 - 计划，保留符号），登记时计算 */
  deviationSec: number;
  /** 操作人；为空是登记即待复核的条件之一 */
  operator: string;
  /** 偏差原因 */
  reason: string;
  /** 是否为复演（导演结论后重跑） */
  isRerun: boolean;
  /** 真实登记时间戳，用于排序展示 */
  createdAt: string;
}

/** 导演处理结论 */
export interface DirectorReview {
  /** 导演填写的处理结论（非空才允许调整灯位与复演） */
  conclusion: string;
  /** 填写导演姓名 */
  director: string;
  filledAt: string;
}

/** Cue 复核状态 */
export type CueStatus =
  | "normal" // 最近一次试运行偏差合规且有操作人
  | "pending_review" // 偏差 > 8s 或操作人为空，等待导演结论
  | "awaiting_rerun" // 已有导演结论，等待复演
  | "released"; // 复演通过，仅当前 Cue 解除锁定

/** 单个 Cue */
export interface Cue {
  id: string;
  /** Cue 编号，如 Cue 12 */
  code: string;
  name: string;
  /** Cue 触发顺序 */
  order: number;
  /** 该 Cue 涉及的灯具 id */
  fixtureIds: string[];
  /** 亮度预设 0-100 */
  brightness: number;
  /** 焦点位置（舞台坐标百分比），锁定期间不可调整 */
  focusX: number;
  focusY: number;
  /** 试运行历史，按登记顺序追加，永不删除（历史偏差保留） */
  runs: RunRecord[];
  /** 导演对最近一次待复核偏差的处理结论 */
  review: DirectorReview | null;
  /** 已放行（复演通过）的那次试运行 id */
  releasedRunId: string | null;
  note: string;
}

/** Cue 列表的复核状态筛选键 */
export type CueFilterKey =
  | "all"
  | "locked"
  | "pending_review"
  | "awaiting_rerun"
  | "released"
  | "normal";

/** 演出版本备注 */
export interface VersionNote {
  id: string;
  version: string;
  content: string;
  updatedAt: string;
}

/** 整个排练台状态（持久化到 localStorage） */
export interface RehearsalState {
  showName: string;
  fixtures: Fixture[];
  cues: Cue[];
  notes: VersionNote[];
}
