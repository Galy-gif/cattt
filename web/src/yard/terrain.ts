const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 保留全部院内路线的零高程平台；左侧山肩围合，后侧和右侧缓降入谷。 */
export function groundHeight(x: number, z: number) {
  const outside = Math.hypot(Math.max(0, Math.abs(x - .2) - 4.6), Math.max(0, Math.abs(z - .25) - 3.95));
  if (outside === 0) return 0;
  const transition = smooth(0, 7.5, outside);
  const shoulder = 3.6 * Math.exp(-(((x + 11) / 7) ** 2)) * smooth(1, 9, -z);
  const valley = -3.8 * smooth(0, 12, outside) - Math.min(5, Math.max(0, -z - 18) * .10) * transition;
  const roll = Math.sin(x * .32 + z * .18) * Math.cos(z * .25) * .36;
  return valley + (shoulder + roll) * transition;
}
