export const SIZE: number;
export interface ArenaIO { send(id: string, msg: Record<string, unknown>): void; award(id: string, pts: number): void; coins(id: string, n: number): void; crate(id: string): void; name(id: string): string; feed(text: string): void }
export class ArenaWorld {
  constructor(io: ArenaIO);
  mode: string;
  setMode(mode: string, cfg?: Record<string, unknown>): void;
  join(id: string): void; leave(id: string): void; has(id: string): boolean;
  msg(id: string, m: Record<string, unknown>): void;
  tick(dt: number): void;
  humans(): { id: string }[];
}
