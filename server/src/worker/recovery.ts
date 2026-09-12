/** 两条恢复通道各自防重入；队列卡住不阻断 PG 的过期回复清理。 */
export function recoveryScanner(recover: () => Promise<void>, sweep: () => Promise<void>,
  report: (error: unknown) => void = (error) => console.error('[worker] 恢复扫描失败', error)) {
  const busy = [false, false];
  return async () => {
    await Promise.all([recover, sweep].map(async (work, index) => {
      if (busy[index]) return;
      busy[index] = true;
      try { await work(); } catch (error) { report(error); }
      finally { busy[index] = false; }
    }));
  };
}
