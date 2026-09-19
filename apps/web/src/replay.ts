export class ReplayGuard {
  private readonly accepted = new Set<string>();
  private readonly pending = new Set<string>();

  constructor(private readonly limit = 10000) {}

  markLocal(messageId: string): void {
    if (this.accepted.size >= this.limit) {
      throw new Error("Message replay limit reached.");
    }
    this.accepted.add(messageId);
  }

  async accept(messageId: string, verify: () => Promise<void>): Promise<boolean> {
    if (this.accepted.has(messageId) || this.pending.has(messageId)) {
      return false;
    }
    this.pending.add(messageId);
    try {
      await verify();
      this.markLocal(messageId);
      return true;
    } finally {
      this.pending.delete(messageId);
    }
  }
}
