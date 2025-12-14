import { useEffect, useRef, ReactNode } from 'react'

interface ResponsiveDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  showCloseButton?: boolean
}

export function ResponsiveDialog({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
}: ResponsiveDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center sm:justify-center"
    >
      {/* Mobile: Bottom drawer, Desktop: Centered dialog */}
      <div className="
        w-full max-h-[85vh] overflow-hidden bg-zinc-950 border-zinc-800 safe-area-bottom
        sm:max-w-md sm:rounded-xl sm:border
        rounded-t-xl border-t
        animate-in
      ">
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden mx-auto mt-3 h-1 w-12 rounded-full bg-zinc-800" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-from-bottom {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slide-in-from-bottom {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }
        .animate-in {
          animation: slide-in-from-bottom 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
