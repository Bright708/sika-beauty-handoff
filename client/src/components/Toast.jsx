import { useToastStore } from '../stores/useToastStore'

// Bottom centre on phones, top right on desktop. Ink bg, paper text, 20px radius.
export default function Toast() {
  const toast = useToastStore((s) => s.toast)
  const hide = useToastStore((s) => s.hide)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-40 left-4 right-4 bottom-4 flex justify-center pointer-events-none md:left-auto md:bottom-auto md:top-6 md:right-6"
    >
      {toast && (
        <div
          key={toast.key}
          className="pointer-events-auto flex items-center gap-1 bg-ink text-paper rounded-admin shadow-float pl-5 pr-2 min-h-14 text-[15px] font-semibold"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <>
              <span aria-hidden="true" className="px-1">·</span>
              <button
                type="button"
                onClick={() => {
                  toast.action.onClick()
                  hide()
                }}
                className="min-h-11 px-3 font-extrabold text-rose-light underline underline-offset-4 cursor-pointer rounded-full"
              >
                {toast.action.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
