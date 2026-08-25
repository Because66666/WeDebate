/**
 * 询问用户交互服务（前端挂起-等待模型）。
 *
 * ask_user 工具执行时调用 request()：在对应 Agent 消息上创建一张
 * pending 状态的交互卡片，并挂起工具调用等待用户作答；
 * 用户在卡片上提交后由 submitAnswers() 将卡片置为 resolved 并回填答案，
 * 同时唤醒挂起的工具调用，答案作为工具结果送回模型继续生成。
 *
 * 两种提前结束（均返回 null，工具侧转为「用户未作答」提示）：
 * - cancelAll：用户点击「停止生成」中断会话，卡片标记 disabled；
 * - markSuperseded：挂起期间用户发送了新消息，卡片标记 supersededByMessage。
 */
import type { AskUserAnswer, AskUserQuestion, InteractionCard } from '../types';
import { useConversationStore } from '../stores/conversation';

interface PendingAskUser {
  interaction: InteractionCard;
  messageId: string;
  resolve: (answers: Record<string, AskUserAnswer> | null) => void;
}

class AskUserService {
  private pending = new Map<string, PendingAskUser>();

  /** 是否存在挂起中的询问（可用于 UI 提示） */
  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /**
   * 在指定消息上创建询问卡片并挂起等待用户作答。
   * @returns 用户答案；会话中断或被新指令取代时返回 null
   */
  request(messageId: string, questions: AskUserQuestion[]): Promise<Record<string, AskUserAnswer> | null> {
    const interaction: InteractionCard = {
      id: crypto.randomUUID(),
      kind: 'ask_user',
      status: 'pending',
      questions,
    };

    // 卡片追加到消息的 interactions，由 MessageItem 内联渲染
    const store = useConversationStore.getState();
    const msg = store.getCurrentConversation()?.messages.find((m) => m.id === messageId);
    if (msg) {
      store.patchMessage(messageId, { interactions: [...(msg.interactions ?? []), interaction] });
    }

    return new Promise((resolve) => {
      this.pending.set(interaction.id, { interaction, messageId, resolve });
    });
  }

  /** 用户提交答案：卡片 resolved + 回填答案，唤醒挂起的工具调用 */
  submitAnswers(interactionId: string, answers: Record<string, AskUserAnswer>): void {
    const entry = this.pending.get(interactionId);
    if (!entry) return;
    this.pending.delete(interactionId);
    this.patchInteraction(entry.messageId, interactionId, {
      status: 'resolved',
      askAnswers: answers,
    });
    entry.resolve(answers);
  }

  /** 会话中断（用户点击停止）：所有挂起卡片标记 disabled 并以 null 唤醒 */
  cancelAll(): void {
    for (const entry of this.pending.values()) {
      this.patchInteraction(entry.messageId, entry.interaction.id, {
        status: 'resolved',
        disabled: true,
      });
      entry.resolve(null);
    }
    this.pending.clear();
  }

  /** 挂起期间用户发送新消息：所有挂起卡片标记被取代并以 null 唤醒 */
  markSuperseded(newMessageId: string): void {
    for (const entry of this.pending.values()) {
      this.patchInteraction(entry.messageId, entry.interaction.id, {
        status: 'resolved',
        supersededByMessage: newMessageId,
      });
      entry.resolve(null);
    }
    this.pending.clear();
  }

  /** 局部更新某条消息上的交互卡片 */
  private patchInteraction(messageId: string, interactionId: string, patch: Partial<InteractionCard>): void {
    const store = useConversationStore.getState();
    const msg = store.getCurrentConversation()?.messages.find((m) => m.id === messageId);
    if (!msg?.interactions) return;
    store.patchMessage(messageId, {
      interactions: msg.interactions.map((it) =>
        it.id === interactionId ? { ...it, ...patch } : it,
      ),
    });
  }
}

export const askUserService = new AskUserService();
