import type { getWorldState } from '../world/service.ts';

/** 开发者版先按北京时间；以后按用户时区 */
const TIME_ZONE = 'Asia/Shanghai';

export type YardState = Awaited<ReturnType<typeof getWorldState>>;

const PLACE_NAMES: Record<string, string> = { house: '蘑菇屋门口', tree: '树屋', bed: '猫窝', grass: '草丛', pond: '池塘', fence: '栅栏边' };
const PHASE_NAMES: Record<string, string> = { dawn: '清晨', day: '白天', dusk: '黄昏', evening: '傍晚', night: '夜里' };
const MOOD_NAMES: Record<string, string> = { calm: '平常', happy: '开心', sulk: '不高兴', sad: '委屈' };

/**
 * 院子里今天发生的事，只读（性格系统优化方案第 2.3 节）。
 * 全是已经存下来的事实：模型说"碗空了一整天"必须是因为它真的空着。
 * 不写进记忆，也不改 Soul —— 这些都是短期状态。
 */
export function yardBlock(world: YardState | null): string | null {
  if (!world || !world.available || !world.currentDestinationId) {
    return '## 院子里\n当前没有可用的院子观察，当前位置和移动结果均未确认。日常作息只是习惯，不能据此猜当前位置；不要说自己已经从某处走来、挪到对方身边、趴下或完成其他院内动作。通过对话陪伴即可，例如“我在听”“你慢慢说”；不用向对方解释内部技术原因。即使对方邀请靠近，不能执行时也不要假装已经移动或到达。';
  }
  const moving = ['moving', 'approaching', 'exiting'].includes(world.phase ?? '');
  const lines = [
    `- 你在${PLACE_NAMES[world.currentDestinationId] ?? world.currentDestinationId}${moving ? `，正往${PLACE_NAMES[world.targetDestinationId!] ?? world.targetDestinationId}走` : ''}。`,
    `- ${PHASE_NAMES[world.dayPhase ?? 'day']}，${world.weather === 'rain' ? '在下雨' : '天晴'}。`,
    `- 碗里${world.bowlFilledToday ? '今天倒过水' : '今天还没有水'}；${world.lastDrinkAt ? `你上次喝水是${formatInstant(new Date(world.lastDrinkAt))}` : '你今天还没喝过水'}。`,
  ];
  if (world.activityFallback) lines.push(`- 当前活动意图是${world.activity ?? '休息'}，画面使用基础动作降级（实际动作：${world.action}）。只可描述实际位置和动作，不能据此说已睡着、已理毛或已喝水；喝水事实只取上面的饮水记录。`);
  if (world.placesToday?.length) lines.push(`- 今天去过：${[...new Set(world.placesToday)].join('、')}。`);
  if (world.mood && world.mood !== 'calm') lines.push(`- 你现在${MOOD_NAMES[world.mood]}${world.moodReason ? `：${world.moodReason}` : ''}。`);
  return `## 院子里\n对方看得见这些，说起来要对得上；不用逐条报告，也别把没发生的事说成发生了。\n${lines.join('\n')}`;
}

function formatInstant(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: TIME_ZONE, month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
