export function nowISO(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}

export function elapsed(startMs: number): number {
  return Date.now() - startMs;
}
