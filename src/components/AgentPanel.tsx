import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Users } from 'lucide-react';
import { useSettingsStore } from '../stores/settings';
import { useAgentStore } from '../stores/agent';
import type { AgentConfig } from '../types';
import { SCRIBE_AGENT_ID } from '../types';

const COLOR_PALETTE = ['#007AFF', '#34C759', '#FF9F0A', '#FF3B30', '#5E5CE6', '#FF2D55', '#64D2FF', '#30D158'];

function getNextColor(agents: AgentConfig[]): string {
  const usedColors = agents.map((a) => a.color);
  for (const c of COLOR_PALETTE) {
    if (!usedColors.includes(c)) return c;
  }
  return COLOR_PALETTE[agents.length % COLOR_PALETTE.length];
}

function PersonaEditorModal({
  agent,
  onSave,
  onCancel,
}: {
  agent: AgentConfig;
  onSave: (personaPrompt: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(agent.personaPrompt);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg overflow-hidden"
          style={{
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--card)',
            border: '0.5px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
          }}
          role="dialog"
          aria-label={`编辑 ${agent.name} 人设提示词`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '0.5px solid var(--border)' }}
          >
            <h3
              className="font-semibold"
              style={{
                fontSize: '13px',
                color: 'var(--foreground)',
              }}
            >
              编辑人设提示词 &mdash; {agent.name}
            </h3>
            <button
              onClick={onCancel}
              aria-label="关闭"
              className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
              style={{
                color: 'var(--icon-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <label
              htmlFor={`modal-persona-${agent.id}`}
              className="mb-1.5 block font-semibold"
              style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}
            >
              人设提示词
            </label>
            <textarea
              id={`modal-persona-${agent.id}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={8}
              className="w-full resize-y outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-sm)',
                border: '0.5px solid var(--border)',
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--foreground)',
                fontSize: '13px',
                padding: '10px 12px',
                lineHeight: '1.5',
              }}
              placeholder="输入人设提示词..."
            />
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3"
            style={{ borderTop: '0.5px solid var(--border)' }}
          >
            <button
              onClick={onCancel}
              className="flex h-8 cursor-pointer items-center px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-sm)',
                border: '0.5px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              取消
            </button>
            <button
              onClick={() => onSave(value)}
              className="flex h-8 cursor-pointer items-center px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.92)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function AgentCard({ agent }: { agent: AgentConfig }) {
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const toggleAgent = useAgentStore((s) => s.toggleAgent);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="overflow-hidden transition-all duration-150"
        style={{
          borderRadius: 'var(--radius-md)',
          border: '0.5px solid var(--border)',
          backgroundColor: 'var(--card)',
        }}
      >
        {/* Main row */}
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          {/* Color indicator */}
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: agent.color }}
            aria-hidden="true"
          />

          {/* Name input */}
          <input
            type="text"
            value={agent.name}
            onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
            aria-label={`智能体名称: ${agent.name}`}
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 outline-none transition-all duration-150 font-semibold"
            style={{
              fontSize: '13px',
              color: 'var(--foreground)',
              borderRadius: 'var(--radius-sm)',
            }}
          />

          {/* Edit persona button */}
          <button
            onClick={() => setModalOpen(true)}
            aria-label="编辑人设提示词"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{
              color: 'var(--icon-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="编辑人设"
          >
            <Pencil size={13} />
          </button>

          {/* Enable/Disable toggle (Apple-style switch) */}
          <label
            className="agent-toggle shrink-0"
            title={agent.enabled ? '禁用' : '启用'}
          >
            <input
              type="checkbox"
              checked={agent.enabled}
              onChange={() => toggleAgent(agent.id)}
              aria-label={agent.enabled ? '禁用智能体' : '启用智能体'}
            />
            <span className="slider" />
          </label>

          {/* Delete */}
          <button
            onClick={() => removeAgent(agent.id)}
            aria-label={`删除智能体 ${agent.name}`}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{
              color: 'var(--destructive)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 10%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="删除智能体"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Persona editor modal */}
      {modalOpen && (
        <PersonaEditorModal
          agent={agent}
          onSave={(personaPrompt) => {
            updateAgent(agent.id, { personaPrompt });
            setModalOpen(false);
          }}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export function AgentPanel() {
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const agents = useAgentStore((s) => s.agents);
  const addAgent = useAgentStore((s) => s.addAgent);

  const handleClose = () => {
    setAgentPanelOpen(false);
  };

  const handleAddAgent = () => {
    const newAgent: AgentConfig = {
      id: crypto.randomUUID(),
      name: '新智能体',
      color: getNextColor(agents),
      basePrompt: '',
      personaPrompt: '',
      enabled: true,
    };
    addAgent(newAgent);
  };

  const displayAgents = agents.filter((a) => a.id !== SCRIBE_AGENT_ID);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-[800ms] ease-in-out ${
          agentPanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-96 max-w-full flex-col transition-transform duration-[800ms] ease-in-out ${
          agentPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--card)',
          borderLeft: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
        role="dialog"
        aria-label="智能体管理面板"
        aria-hidden={!agentPanelOpen}
      >
        {/* Header */}
        <div
          className="flex h-12 shrink-0 items-center justify-between px-4"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: 'var(--icon-muted)' }} />
            <h2
              className="font-semibold"
              style={{ fontSize: '13px', color: 'var(--foreground)' }}
            >
              智能体管理
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddAgent}
              aria-label="添加智能体"
              className="flex h-7 cursor-pointer items-center gap-1 px-2.5 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.92)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              <Plus size={13} />
              添加
            </button>
            <button
              onClick={handleClose}
              aria-label="关闭智能体面板"
              className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
              style={{
                color: 'var(--icon-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2.5">
            {displayAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
            {displayAgents.length === 0 && (
              <p
                className="py-8 text-center text-sm"
                style={{ color: 'var(--foreground-secondary)' }}
              >
                暂无智能体，点击上方"添加"按钮创建
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
