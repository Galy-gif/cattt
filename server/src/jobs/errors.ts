/** 永久失败由 async_jobs 终止重试，与投递库无关。 */
export class UnrecoverableError extends Error {
  constructor(message: string) { super(message); this.name = 'UnrecoverableError'; }
}
