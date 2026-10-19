export const CAS: { MIN: number; MAX: number; DAILY_LOSS: number; GAP: number };
export function flip(bet: number, side: string, rnd: () => number): { out: string; win: boolean; payout: number };
export function slots(bet: number, rnd: () => number): { reels: string[]; mult: number; win: boolean; payout: number };
export function roulette(bet: number, kind: string, num: number, rnd: () => number): { n: number; color: string; win: boolean; payout: number };
export function rouletteKindOk(kind: string, num: number): boolean;
export interface BjState { bet: number; player: { r: number; u: string }[]; dealer: { r: number; u: string }[]; done: boolean; doubled: boolean; natural: boolean; result?: string; payout?: number }
export function bjDeal(bet: number, rnd: () => number): BjState;
export function bjHit(st: BjState, rnd: () => number): BjState;
export function bjStand(st: BjState, rnd: () => number): BjState;
export function bjDouble(st: BjState, rnd: () => number): BjState;
export function bjView(st: BjState): Record<string, unknown>;
export function total(hand: { r: number; u: string }[]): number;
