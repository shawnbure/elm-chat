export interface ReplayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type StoredReplayState = { version: 1; entries: [string, number | null][] };

export class ReplayGuard {
  private readonly accepted = new Map<string, number | null>();
  private readonly pending = new Set<string>();

  constructor(
    private readonly limit = 10000,
    private readonly storage?: ReplayStorage,
    private readonly storageKey?: string
  ) {
    this.restore();
  }

  markLocal(messageId: string, expiresAt: number | null = null): void {
    this.prune();
    if (!this.accepted.has(messageId) && this.accepted.size >= this.limit) {
      throw new Error("Message replay limit reached.");
    }
    this.accepted.set(messageId, expiresAt);
    this.persist();
  }

  async accept(messageId: string, verify: () => Promise<void>): Promise<boolean>;
  async accept(messageId: string, expiresAt: number | null, verify: () => Promise<void>): Promise<boolean>;
  async accept(
    messageId: string,
    expiresAtOrVerify: number | null | (() => Promise<void>),
    maybeVerify?: () => Promise<void>
  ): Promise<boolean> {
    this.prune();
    const expiresAt = typeof expiresAtOrVerify === "function" ? null : expiresAtOrVerify;
    const verify = typeof expiresAtOrVerify === "function" ? expiresAtOrVerify : maybeVerify;
    if (!verify) throw new Error("Replay verification callback is required.");
    if (this.accepted.has(messageId) || this.pending.has(messageId)) {
      return false;
    }
    this.pending.add(messageId);
    try {
      await verify();
      this.markLocal(messageId, expiresAt);
      return true;
    } finally {
      this.pending.delete(messageId);
    }
  }

  clear(): void {
    this.accepted.clear();
    this.pending.clear();
    if (!this.storage || !this.storageKey) return;
    try { this.storage.removeItem(this.storageKey); } catch { /* optional storage */ }
  }

  private prune(now = Date.now()): void {
    let changed = false;
    for (const [id, expiresAt] of this.accepted) {
      if (expiresAt !== null && expiresAt <= now) {
        this.accepted.delete(id);
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  private restore(): void {
    if (!this.storage || !this.storageKey) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as StoredReplayState;
      if (state.version !== 1 || !Array.isArray(state.entries)) throw new Error("bad state");
      for (const entry of state.entries.slice(-this.limit)) {
        if (Array.isArray(entry) && typeof entry[0] === "string" &&
          (entry[1] === null || Number.isSafeInteger(entry[1]))) {
          this.accepted.set(entry[0], entry[1]);
        }
      }
      this.prune();
    } catch {
      this.accepted.clear();
      try { this.storage.removeItem(this.storageKey); } catch { /* optional storage */ }
    }
  }

  private persist(): void {
    if (!this.storage || !this.storageKey) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify({
        version: 1,
        entries: [...this.accepted]
      } satisfies StoredReplayState));
    } catch {
      // In-memory replay protection remains active when storage is unavailable.
    }
  }
}
