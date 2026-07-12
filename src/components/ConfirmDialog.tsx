import { X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBg =
    variant === 'danger' ? 'var(--destructive)' : 'var(--primary)';

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
          className="w-full max-w-md overflow-hidden"
          style={{
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--card)',
            border: '0.5px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
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
              {title}
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
            <p
              style={{
                fontSize: '13px',
                color: 'var(--foreground-secondary)',
                lineHeight: '1.5',
              }}
            >
              {message}
            </p>
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
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex h-8 cursor-pointer items-center px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: confirmBg,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.92)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
