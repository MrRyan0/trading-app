/**
 * Token-bucket API 限流队列
 * 实现令牌桶算法来控制 API 请求速率，防止触发第三方 API 的速率限制
 */
export class ApiQueue {
  /** 令牌桶容量（最大令牌数） */
  private capacity: number;

  /** 当前可用令牌数 */
  private tokens: number;

  /** 等待执行的任务队列 */
  private queue: Array<{
    /** 要执行的异步函数 */
    fn: () => Promise<any>;
    /** 成功回调 */
    resolve: (value: any) => void;
    /** 失败回调 */
    reject: (error?: any) => void;
  }> = [];

  /** 令牌填充定时器 ID */
  private refillIntervalId: NodeJS.Timeout;

  /**
   * 创建一个 API 请求队列
   * @param ratePerMin 每分钟允许的请求数，默认为 60
   */
  constructor(ratePerMin = 60) {
    this.capacity = ratePerMin;
    this.tokens = ratePerMin;

    // 每秒添加一个令牌，直到达到容量上限
    this.refillIntervalId = setInterval(() => this.refill(), 1_000);
  }

  /**
   * 填充令牌桶
   * 每次调用添加一个令牌，直到达到容量上限
   */
  private refill(): void {
    if (this.tokens < this.capacity) {
      this.tokens++;
    }
    this.process();
  }

  /**
   * 将异步任务添加到队列
   * @param fn 要执行的异步函数
   * @returns 异步任务的结果 Promise
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  /**
   * 处理队列中的任务
   * 如果有可用令牌且队列不为空，则执行队列头部的任务
   */
  private process(): void {
    // 如果队列为空或没有可用令牌，则不执行任务
    if (!this.queue.length || this.tokens <= 0) return;

    // 取出队列头部的任务
    const task = this.queue.shift();
    if (!task) return;

    // 消耗一个令牌
    this.tokens--;

    // 执行任务
    (async () => {
      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err: unknown) {
        // 处理 429 Too Many Requests 错误
        const errorObj = err as { status?: number; response?: { status?: number } };
        const status = errorObj?.status ?? errorObj?.response?.status;

        if (status === 429) {
          // 命中限速，15 秒后重新入队
          console.warn('API 请求超过限制，15秒后重试');
          setTimeout(
            () => this.enqueue(task.fn).then(task.resolve).catch(task.reject),
            15_000
          );
        } else {
          // 其他错误直接拒绝
          task.reject(err);
        }
      } finally {
        // 无论成功或失败，继续处理队列中的下一个任务
        this.process();
      }
    })();
  }

  /**
   * 清理资源，停止令牌填充定时器
   */
  dispose(): void {
    if (this.refillIntervalId) {
      clearInterval(this.refillIntervalId);
    }
  }
}

/**
 * 全局 API 队列实例
 * 用于限制对外部 API 的请求速率
 */
export const apiQueue = new ApiQueue(); 