import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, X as XIcon } from 'lucide-react'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as a destructive action. */
  danger?: boolean
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

/**
 * Provides a designed confirmation dialog that replaces native window.confirm().
 * Consumers call `const confirm = useConfirm()` then `await confirm({ ... })`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmContextValue>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options ? (
        <div
          className="modal modal--confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="modal__backdrop" onClick={() => settle(false)} />
          <div className="modal__panel modal__panel--confirm">
            <header className="modal__head">
              <h3 id="confirm-title" className="confirm__title">
                {options.danger ? (
                  <AlertTriangle size={18} strokeWidth={2.2} aria-hidden="true" />
                ) : null}
                {options.title}
              </h3>
              <button
                type="button"
                className="modal__close"
                aria-label="닫기"
                onClick={() => settle(false)}
              >
                <XIcon size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </header>
            {options.message ? <p className="modal__sub">{options.message}</p> : null}
            <footer className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => settle(false)}>
                {options.cancelLabel ?? '취소'}
              </button>
              <button
                type="button"
                className={`btn ${options.danger ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => settle(true)}
                autoFocus
              >
                {options.confirmLabel ?? '확인'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx
}
