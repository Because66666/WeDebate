import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Check, Settings } from 'lucide-react';
import { useSettingsStore } from '../stores/settings';

export function SettingsPanel() {
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const setApiConfig = useSettingsStore((s) => s.setApiConfig);

  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsPanelOpen && apiConfig) {
      setApiKey(apiConfig.apiKey);
      setEndpoint(apiConfig.endpoint);
      setModel(apiConfig.model);
    }
  }, [settingsPanelOpen, apiConfig]);

  const handleSave = () => {
    setApiConfig({ apiKey, endpoint, model });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClose = () => {
    setSettingsPanelOpen(false);
  };

  if (!settingsPanelOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-96 max-w-full flex-col"
        style={{
          backgroundColor: 'var(--card)',
          borderLeft: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
        role="dialog"
        aria-label="设置面板"
      >
        {/* Header */}
        <div
          className="flex h-12 shrink-0 items-center justify-between px-4"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: 'var(--icon-muted)' }} />
            <h2
              className="font-semibold"
              style={{ fontSize: '13px', color: 'var(--foreground)' }}
            >
              设置
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="关闭设置"
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5">
            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="settings-api-key"
                className="font-semibold"
                style={{ fontSize: '12px', color: 'var(--foreground)' }}
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="settings-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full outline-none transition-all duration-150"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    border: '0.5px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                    padding: '9px 32px 9px 12px',
                  }}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer outline-none"
                  style={{ color: 'var(--icon-muted)' }}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* API Endpoint */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="settings-endpoint"
                className="font-semibold"
                style={{ fontSize: '12px', color: 'var(--foreground)' }}
              >
                API 端点
              </label>
              <input
                id="settings-endpoint"
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full outline-none transition-all duration-150"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                  padding: '9px 12px',
                }}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            {/* Model Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="settings-model"
                className="font-semibold"
                style={{ fontSize: '12px', color: 'var(--foreground)' }}
              >
                模型名称
              </label>
              <input
                id="settings-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full outline-none transition-all duration-150"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                  padding: '9px 12px',
                }}
                placeholder="gpt-4"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 p-4"
          style={{ borderTop: '0.5px solid var(--border)' }}
        >
          <button
            onClick={handleSave}
            aria-label="保存设置"
            className="flex w-full cursor-pointer items-center justify-center gap-2 outline-none transition-all duration-150"
            style={{
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              padding: '10px 0',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.92)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            {saved ? (
              <>
                <Check size={16} />
                已保存
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
