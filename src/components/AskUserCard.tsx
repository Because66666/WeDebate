/**
 * 询问用户卡片（内嵌在 Agent 消息正文中的交互卡片）。
 *
 * Agent 需要向用户提问时调用 ask_user 工具，前端将本卡片嵌入对应消息正文：
 * - pending：逐题切换展示（顶部显示"第 N/M 题"进度），footer 提供
 *   「上一个问题 / 下一题 / 提交（最后一题）」；
 *   单选/多选题渲染选项按钮组（末尾固定追加"其他"选项，选中时出现文本输入框）；
 *   自由回答题渲染 textarea。
 *   提交为 fire-and-forget，卡片状态由 askUserService 驱动变更为 resolved。
 * - resolved：默认折叠，Header 仅显示结果（已提交 / 已被新指令取代 / 用户已中断），
 *   点击 Header 可展开逐题回放用户答案。
 *
 * ask_user 工具会自动在每个提问末尾追加一个 id="__supplement__" 的
 * 自由回答题"补充说明（可选）"（见 services/tools/ask-user.ts）。
 *
 * 视觉风格：圆角 / 边框 / 阴影 / 字号与全局设计令牌一致。
 */
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, ChevronDown } from 'lucide-react';
import type { AskUserAnswer, AskUserQuestion, InteractionCard } from '../types';
import { askUserService } from '../services/ask-user';

/** 选项按钮组中追加的"其他"选项展示文案 */
const OTHER_OPTION_LABEL = '其他';

interface AskUserCardProps {
  /** 询问用户交互卡片数据（kind === 'ask_user'） */
  interaction: InteractionCard;
}

/** 判断某个问题是否已作答（用于禁用"下一题"/"提交"） */
function isAnswered(question: AskUserQuestion, answer: AskUserAnswer | undefined): boolean {
  if (!answer) return false;
  if (question.type === 'free') {
    return Boolean(answer.text?.trim());
  }
  // 选择题：至少选中一个选项；选中"其他"时必须填写文本
  const choices = Array.isArray(answer.choice) ? answer.choice : answer.choice ? [answer.choice] : [];
  if (choices.length === 0) return false;
  if (choices.includes(OTHER_OPTION_LABEL) && !answer.other_text?.trim()) return false;
  return true;
}

export function AskUserCard({ interaction }: AskUserCardProps) {
  const resolved = interaction.status === 'resolved';
  const disabled = interaction.disabled === true;
  const superseded = Boolean(interaction.supersededByMessage);
  const questions = interaction.questions ?? [];

  // 当前展示的问题下标
  const [currentIndex, setCurrentIndex] = useState(0);
  // 本地作答缓存（按问题 id 存取，切题不丢失）
  const [answers, setAnswers] = useState<Record<string, AskUserAnswer>>({});
  // 提交中状态（防止重复点击）
  const [submitting, setSubmitting] = useState(false);
  // resolved 时默认折叠，点击 Header 展开回放答案
  const [expanded, setExpanded] = useState(false);

  // 下标兜底：问题列表变化（如历史回放）时防止越界
  const safeIndex = Math.min(currentIndex, Math.max(questions.length - 1, 0));
  const question = questions[safeIndex];
  const isLast = safeIndex === questions.length - 1;
  const currentAnswer = question ? answers[question.id] : undefined;
  const currentAnswered = question ? isAnswered(question, currentAnswer) : false;

  /** 更新某题的作答（局部合并） */
  const patchAnswer = (qid: string, patch: Partial<AskUserAnswer>) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  };

  /** 单选题：点选某选项（再次点击已选中的选项不取消，保证必答语义清晰） */
  const handleSingleSelect = (qid: string, option: string) => {
    patchAnswer(qid, { choice: option, ...(option !== OTHER_OPTION_LABEL ? { other_text: undefined } : {}) });
  };

  /** 多选题：切换某选项选中态 */
  const handleMultiToggle = (qid: string, option: string) => {
    const prev = answers[qid];
    const prevChoices = Array.isArray(prev?.choice) ? prev.choice : [];
    const next = prevChoices.includes(option)
      ? prevChoices.filter((c) => c !== option)
      : [...prevChoices, option];
    patchAnswer(qid, { choice: next, ...(option === OTHER_OPTION_LABEL && !next.includes(OTHER_OPTION_LABEL) ? { other_text: undefined } : {}) });
  };

  /** 提交全部答案（fire-and-forget：组件不乐观更新，由 askUserService 驱动 resolved；
   *  提交后保持 submitting 防重复点击，卡片转 resolved 时 pending UI 随之卸载） */
  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    askUserService.submitAnswers(interaction.id, answers);
  };

  /** 渲染单个选项按钮（选中高亮） */
  const renderOptionButton = (q: AskUserQuestion, option: string, selected: boolean) => (
    <button
      key={option}
      onClick={() => (q.type === 'single' ? handleSingleSelect(q.id, option) : handleMultiToggle(q.id, option))}
      className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none transition-all duration-150"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid',
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        backgroundColor: selected ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
        color: 'var(--foreground)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      {option}
    </button>
  );

  /** resolved 状态：回放单题答案文本 */
  const renderAnswerReplay = (q: AskUserQuestion, answer: AskUserAnswer | undefined) => {
    if (!answer) {
      return <span style={{ color: 'var(--foreground-secondary)' }}>未作答</span>;
    }
    if (q.type === 'free') {
      return <span className="whitespace-pre-wrap">{answer.text || '未作答'}</span>;
    }
    const choices = Array.isArray(answer.choice) ? answer.choice : answer.choice ? [answer.choice] : [];
    const parts: string[] = [...choices];
    if (choices.includes(OTHER_OPTION_LABEL) && answer.other_text) {
      parts.push(`（${answer.other_text}）`);
    }
    return (
      <>
        <span>{parts.length > 0 ? parts.join('、') : '未作答'}</span>
      </>
    );
  };

  // 当前题选中的选项集合（用于选项按钮高亮与"其他"输入框显隐）
  const selectedChoices = currentAnswer
    ? Array.isArray(currentAnswer.choice)
      ? currentAnswer.choice
      : currentAnswer.choice
        ? [currentAnswer.choice]
        : []
    : [];
  const otherSelected = selectedChoices.includes(OTHER_OPTION_LABEL);
  // 选择题候选选项：后端 options 末尾追加"其他"（options 已含时去重，避免重复 key）
  const baseOptions = question && question.type !== 'free' ? (question.options ?? []) : [];
  const optionList = baseOptions.includes(OTHER_OPTION_LABEL)
    ? baseOptions
    : [...baseOptions, OTHER_OPTION_LABEL];

  // 提交/下一题按钮禁用条件：提交中、当前题未作答（补充说明题除外，允许跳过）
  const actionDisabled = submitting || (!currentAnswered && question?.id !== '__supplement__');

  return (
    <div
      className="w-full overflow-hidden aml-fade-in-up"
      style={{
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 200ms',
      }}
      role="dialog"
      aria-label="询问用户"
    >
      {/* Header：pending 显示进度；resolved 显示结果，点击可展开/折叠答案回放 */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          cursor: resolved ? 'pointer' : 'default',
        }}
        onClick={resolved ? () => setExpanded((v) => !v) : undefined}
      >
        <h3
          className="font-semibold"
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground)' }}
        >
          询问用户
        </h3>
        {resolved ? (
          <span
            className="flex items-center gap-1.5"
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              padding: '2px 10px',
              backgroundColor: superseded || disabled
                ? 'color-mix(in srgb, var(--destructive) 10%, transparent)'
                : 'color-mix(in srgb, var(--primary) 10%, transparent)',
            }}
          >
            {superseded || disabled ? (
              <XCircle size={14} style={{ color: 'var(--destructive)' }} />
            ) : (
              <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />
            )}
            <span style={{ color: superseded || disabled ? 'var(--destructive)' : 'var(--primary)' }}>
              {superseded ? '已被新指令取代' : disabled ? '用户已中断' : '已提交'}
            </span>
            {expanded ? (
              <ChevronDown size={14} style={{ color: 'var(--icon-muted)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--icon-muted)' }} />
            )}
          </span>
        ) : (
          questions.length > 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>
               {safeIndex + 1}/{questions.length}
            </span>
          )
        )}
      </div>

      {/* Body：resolved 且折叠时隐藏 */}
      {(!resolved || expanded) && (
      <div className="px-5 py-4">
        {resolved ? (
          // resolved：被取代/中断时仅显示提示，否则逐题回放答案
          superseded || disabled ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)', lineHeight: '1.5' }}>
              {superseded
                ? '本次询问已被挂起期间的用户新指令取代，无需作答。'
                : '本次询问因会话中断而失效，无需作答。'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {questions.map((q, idx) => (
                <div key={q.id}>
                  <p
                    className="mb-1 whitespace-pre-wrap"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.5' }}
                  >
                    {idx + 1}. {q.question}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground)', lineHeight: '1.5' }}>
                    {renderAnswerReplay(q, interaction.askAnswers?.[q.id])}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : question ? (
          // pending：逐题展示当前题
          <div>
            <p
              className="mb-3 whitespace-pre-wrap"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.5' }}
            >
              {question.question}
            </p>

            {question.type === 'free' ? (
              // 自由回答题：textarea
              <textarea
                value={currentAnswer?.text ?? ''}
                onChange={(e) => patchAnswer(question.id, { text: e.target.value })}
                placeholder="请输入..."
                rows={4}
                className="w-full resize-y outline-none"
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--foreground)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  lineHeight: '1.5',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow =
                    '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            ) : (
              // 单选/多选题：选项按钮组 + "其他"文本输入
              <div className="flex flex-col gap-2">
                {optionList.map((option) =>
                  renderOptionButton(question, option, selectedChoices.includes(option)),
                )}
                {otherSelected && (
                  <input
                    type="text"
                    value={currentAnswer?.other_text ?? ''}
                    onChange={(e) => patchAnswer(question.id, { other_text: e.target.value })}
                    placeholder="请输入..."
                    className="w-full outline-none"
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--foreground)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                      lineHeight: '1.5',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow =
                        '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          // 兜底：无问题数据
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>暂无问题</p>
        )}
      </div>
      )}

      {/* Footer：pending 时展示切题/提交操作区；resolved 时隐藏 */}
      {!resolved && questions.length > 0 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            disabled={safeIndex === 0}
            className="flex h-8 items-center px-3 outline-none transition-all duration-150"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              opacity: safeIndex === 0 ? 0.4 : 1,
              cursor: safeIndex === 0 ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (safeIndex > 0) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
          >
            上一个问题
          </button>
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={actionDisabled}
              className="flex h-8 items-center px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                opacity: actionDisabled ? 0.4 : 1,
                cursor: actionDisabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!actionDisabled)
                  e.currentTarget.style.backgroundColor =
                    'color-mix(in srgb, var(--primary) 88%, black)';
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              {submitting ? '提交中…' : '提交'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
              disabled={!currentAnswered}
              className="flex h-8 items-center px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                opacity: !currentAnswered ? 0.4 : 1,
                cursor: !currentAnswered ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (currentAnswered)
                  e.currentTarget.style.backgroundColor =
                    'color-mix(in srgb, var(--primary) 88%, black)';
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              下一个
            </button>
          )}
        </div>
      )}
    </div>
  );
}
