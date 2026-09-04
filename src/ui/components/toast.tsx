import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let toastSeq = 0;

type ToastProviderProps = {
  children: ReactNode;
  dismissMs?: number;
};

export function ToastProvider({
  children,
  dismissMs = 4000,
}: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = `toast-${++toastSeq}`;
      setItems((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, dismissMs);
    },
    [dismissMs],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  function dismiss(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast toast--${item.tone}`}
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <p className="toast__message">{item.message}</p>
            <button
              type="button"
              className="toast__dismiss"
              aria-label="Fechar"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
