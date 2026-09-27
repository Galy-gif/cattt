/** 院内活动面平缓，院外沿用原有远处抬升；远山本体不缩放。 */
export function groundHeight(x: number, z: number) {
  const outside = Math.hypot(Math.max(0, Math.abs(x - .2) - 4.6), Math.max(0, Math.abs(z - .25) - 3.95));
  const rise = z < 0 ? Math.min(2.4, outside * outside * .03) : 0;
  const roll = Math.sin(x * .5) * Math.cos(z * .4) * .14 * Math.min(1, outside);
  return rise + roll;
}
