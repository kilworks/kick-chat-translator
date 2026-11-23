interface QueuedJob<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class ConcurrencyQueue {
  private active = 0;
  private queue: QueuedJob<unknown>[] = [];

  constructor(private limit: number) {}

  size(): number {
    return this.queue.length + this.active;
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: task as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this.active += 1;
      job
        .run()
        .then((v) => job.resolve(v))
        .catch((e: unknown) => job.reject(e))
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

// Token-bucket per channel
export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private capacity: number,
    private refillPerMin: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  setRate(capacity: number, refillPerMin: number): void {
    this.capacity = capacity;
    this.refillPerMin = refillPerMin;
  }

  tryTake(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMin = (now - this.lastRefillMs) / 60_000;
    if (elapsedMin <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMin * this.refillPerMin);
    this.lastRefillMs = now;
  }
}
