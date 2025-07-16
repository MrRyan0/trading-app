/* ---------- Token-bucket 限流队列（60 req/min 默认） ---------- */
export class ApiQueue {
  private capacity: number;
  private tokens: number;
  private queue: {
    fn: () => Promise<any>;
    resolve: (v: any) => void;
    reject: (err?: any) => void;
  }[] = [];

  constructor(ratePerMin = 60) {
    this.capacity = ratePerMin;
    this.tokens = ratePerMin;
    setInterval(() => this.refill(), 1_000);
  }

  private refill() {
    if (this.tokens < this.capacity) this.tokens++;
    this.process();
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  private process() {
    if (!this.queue.length || this.tokens <= 0) return;

    const task = this.queue.shift()!;
    this.tokens--;

    (async () => {
      try {
        const res = await task.fn();
        task.resolve(res);
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        if (status === 429) {
          // 命中限速，15 秒后重排队
          setTimeout(
            () => this.enqueue(task.fn).then(task.resolve).catch(task.reject),
            15_000
          );
        } else {
          task.reject(err);
        }
      } finally {
        this.process();
      }
    })();
  }
}

export const apiQueue = new ApiQueue(); 