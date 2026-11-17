import { appendTicketInput, startErrand } from './errands.ts';
import { cancelTicket, scheduleFollowup, updateTicket } from './tickets.ts';
import { TicketError } from './errors.ts';
import type { CommandOrigin } from './intake.ts';

export type TicketCommand =
  | { kind: 'schedule'; when: string; about: string }
  | { kind: 'start'; goal: string }
  | { kind: 'reschedule'; ticketId: string; when: string }
  | { kind: 'append'; ticketId: string; text: string }
  | { kind: 'cancel'; ticketId: string };

/** 聊天工具和HTTP仅翻译指令；身份由宿主传入，不接受模型或请求正文指定。 */
export async function dispatchTicketCommand(context: { catId: string; origin: CommandOrigin }, command: TicketCommand) {
  const { catId, origin } = context;
  const messageId = origin.source === 'chat' ? origin.messageId : undefined;
  const requestId = origin.source === 'app' ? origin.requestId : undefined;
  switch (command.kind) {
    case 'schedule':
      if (!messageId) throw new TicketError(400, '请在聊天中说清约定');
      return scheduleFollowup(catId, messageId, command.when, command.about);
    case 'start':
      if (!messageId) throw new TicketError(400, '请在聊天中说清托付');
      return startErrand(catId, messageId, command.goal);
    case 'reschedule':
      return updateTicket(catId, command.ticketId, command.when, messageId, undefined, requestId);
    case 'append':
      return appendTicketInput(catId, command.ticketId, command.text, messageId, requestId);
    case 'cancel':
      return cancelTicket(catId, command.ticketId, messageId, requestId);
  }
}
