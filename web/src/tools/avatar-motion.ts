/** 离线头像动作，端点回到原姿势；不改变世界层的动作与时钟。 */
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * x * (x * (x * 6 - 15) + 10); };
export function avatarBlink(time: number) {
  return time < .10 ? smooth(time / .10) : time < .13 ? 1 : 1 - smooth((time - .13) / .17);
}
export function avatarMotion(kind: 'blink' | 'look', time: number) {
  // 歪向同一侧，短暂停留，再慢慢回正；不做左右摇头。
  const envelope = time < .8 ? smooth(time / .8) : time < 1.45 ? 1 : 1 - smooth((time - 1.45) / .95);
  return {
    blink: kind === 'blink' ? avatarBlink(time) : avatarBlink(time - .20),
    yaw: 0,
    roll: kind === 'look' ? 8 * Math.PI / 180 * envelope : 0,
    pitch: kind === 'look' ? -.6 * Math.PI / 180 * envelope : 0,
  };
}
