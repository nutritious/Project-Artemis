export interface Rarity { name: string; color: string; weight: number; dupe: number }
export interface Cosmetic { id: string; name: string; rarity: string; limited?: string; cat?: string; desc?: string; color?: string; c?: string[] }
export interface PackDef { id: string; kind: string; name: string; cost: number; count: number; boost: number; desc: string; color: string; guarantee?: string; cat?: string; pool?: string[]; chromaBoost?: number }
export interface PackItem { type: "effect" | "tag" | "theme" | "bg"; id: string; name: string; rarity: string; dupe: boolean; refund: number }
export interface GameDef { id: string; name: string; desc: string; per: number; add: number; coinDiv: number }
export const RARITY: Record<string, Rarity>;
export const EFFECTS: Cosmetic[];
export const TAGS: Cosmetic[];
export const BASE_THEMES: string[];
export const THEMES: Cosmetic[];
export const PACKS: PackDef[];
export const BGS: Cosmetic[];
export const DAILY_CAP: number;
export const COIN_RATES: Record<"chat" | "search" | "browse", { coins: number; gap: number }>;
export const WHEEL_MS: number;
export const WHEEL: { label: string; coins?: number; pack?: number; w: number; color: string }[];
export interface Achievement { id: string; name: string; desc: string; stat: string; goal: number; coins: number; icon: string }
export const ACHIEVEMENTS: Achievement[];
export const achMap: Map<string, Achievement>;
export const bgMap: Map<string, Cosmetic>;
export const EVENTS: Record<string, { name: string; tag: string; effect: string; color: string; blurb: string }>;
export const GAMES: GameDef[];
export const QUICK_EVENTS: { id: string; name: string; desc: string; icon: string }[];
export const CUTSCENES: { id: string; name: string }[];
export const effectMap: Map<string, Cosmetic>;
export const tagMap: Map<string, Cosmetic>;
export const themeMap: Map<string, Cosmetic>;
export const packMap: Map<string, PackDef>;
export function rollPack(pack: PackDef, have: { effects: string[]; tags: string[]; themes: string[]; bgs?: string[] }, rand: () => number, luck?: number): PackItem[];

export function packContents(pack: PackDef, luck?: number): { items: (Record<string, any> & { type: string })[]; odds: Record<string, number>; chromaPack: number };
export const PHASE_KINDS: Record<string, { name: string; icon: string; arena: boolean; blurb: string }>;
export const EVENT_PRESETS: Record<string, { kind: string; mins: number }[]>;
export const QUICK_PRESETS: { id: string; name: string; sched: { kind: string; mins: number }[] }[];
export const DUPE_COINS: number;
export const DEFAULT_CFG: { bots: number; loot: string; boss: string; loop: boolean };
export function cleanSchedule(list: unknown): { kind: string; mins: number }[];
export const scheduleMins: (s: { kind: string; mins: number }[]) => number;

export interface UpgradeDef { id: string; kind: "level" | "pass"; icon: string; name: string; desc: string; base?: number; grow?: number; max?: number; cost?: number; effect?: (l: number) => string }
export const UPGRADES: UpgradeDef[];
export const upgradeMap: Map<string, UpgradeDef>;
export const luckStep: (l: number) => number;
export const chromaLuck: (l: number) => number;
export const speedMult: (l: number) => number;
export const refundMult: (l: number) => number;
export const upCost: (def: UpgradeDef, lvl: number) => number;
export const noUps: () => { luck: number; speed: number; refund: number; cash: number; dbl: number; pass: string[] };
