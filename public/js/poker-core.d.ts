export const SB: number, BB: number, MAXSEATS: number;
export interface PSeat { id: string; name: string; bot: boolean; stack: number; cards: ({ r: number; u: string } | null)[]; bet: number; total: number; folded: boolean; allIn: boolean; acted: boolean; left: boolean; tag: string }
export interface PTable { id: string; host: string; practice: boolean; seats: PSeat[]; board: { r: number; u: string }[]; deck: unknown[]; phase: string; dealer: number; turn: number; bet: number; minRaise: number; pot: number; handNo: number; result: any; lastAct: string }
export function newTable(o: { id: string; host: string; practice?: boolean }): PTable;
export function addSeat(t: PTable, s: { id: string; name: string; bot?: boolean; stack: number }): void;
export function canStart(t: PTable): boolean;
export function startHand(t: PTable, rnd: () => number): { ok: boolean; dropped: PSeat[] };
export function act(t: PTable, id: string, action: string, amount?: number): void;
export function leaveSeat(t: PTable, id: string): void;
export function toCall(t: PTable, id: string): number;
export function botMove(t: PTable, id: string, rnd: () => number): [string, number?];
export function view(t: PTable, forId: string): Record<string, unknown>;
export function best(cards: { r: number; u: string }[]): number;
export function catOf(score: number): number;
export const HANDS: string[];
export function rankLabel(r: number): string;
