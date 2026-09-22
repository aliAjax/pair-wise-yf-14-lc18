// 排练偏差复核台 —— 领域模型
// 灯具、Cue、试运行记录、导演处理结论

export type FixtureType = "面光" | "侧光" | "逆光" | "效果光" | "追光";

export const FIXTURE_TYPES: FixtureType[] = ["面光", "侧光", "逆光", "效果光", "追光"];

/** 灯具（灯位） */
export interface Fixture {
  id: string; // 灯具编号，如 FOH-03
  channel: string; // 通道号，如 CH 021
  gel: string; // 色片
  color: string; // 舞台图上的呈现色
  type: FixtureType; // 灯位类型（筛选维度）
  /** 舞台平面坐标，0-100（百分比） */
  x: number;
  y: number;
  brightness: number; // 亮度预设 0-100
  focus: string; // 焦点位置描述
}

/** Cue（触发点） */
export interface Cue {
  id: string;
  no: string; // Cue 12
  name: string; // 冷蓝侧光
  order: number; // 触发顺序
  fixtureIds: string[]; // 本 Cue 涉及的灯具
  plannedAt: string; // 计划触发时间（排练时钟 HH:MM:SS）
  memo: string; // 版本备注
}

/** 导演处理结论（待复核 Cue 放行前必须存在） */
export interface ReviewConclusion {
  director: string; // 导演签名
  conclusion: string; // 处理结论
  allowReplay: boolean; // 导演是否准予复演
  decidedAt: string; // ISO 时间
}

export type TrialKind = "run" | "replay"; // 试运行 / 复演

/** 一次试运行（或复演）登记，历史记录不可删除 */
export interface TrialRun {
  id: string;
  cueId: string;
  kind: TrialKind;
  plannedAt: string; // 计划触发时间
  actualAt: string; // 实际触发时间
  operator: string; // 操作人（可能为空字符串 -> 待复核）
  reason: string; // 偏差原因
  deviationSec: number; // 偏差秒数（实际 - 计划，状态计算层写入）
  flagged: boolean; // 是否待复核（状态计算层写入）
  flagReasons: string[]; // 命中的待复核规则
  review: ReviewConclusion | null; // 导演处理结论
  closesTrialId: string | null; // 复演通过时关闭的那条待复核记录
  createdAt: string; // 登记时间 ISO
}

export interface ShowProfile {
  showName: string; // 演出名称
  versionNote: string; // 演出版本备注
}

export interface ConsoleState {
  show: ShowProfile;
  fixtures: Fixture[];
  cues: Cue[];
  trials: TrialRun[];
  selectedCueId: string;
  activeTypes: FixtureType[];
}

/** 试运行登记表单输入 */
export interface TrialInput {
  cueId: string;
  kind: TrialKind;
  plannedAt: string;
  actualAt: string;
  operator: string;
  reason: string;
}

/** 导演处理结论表单输入 */
export interface ReviewInput {
  cueId: string;
  director: string;
  conclusion: string;
  allowReplay: boolean;
}
