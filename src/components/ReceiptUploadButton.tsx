import { useEffect, useRef, useState, type ChangeEvent } from 'react'

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

/** Camera icon that opens an explicit "Take photo" / "Choose from gallery"
 * menu — two separate hidden file inputs (one with capture=environment,
 * one without) so the choice is deterministic across mobile browsers rather
 * than relying on a single input's native chooser. */
export function ReceiptUploadButton({
  idPrefix,
  hasFile,
  status,
  onFile,
}: {
  idPrefix: string
  hasFile: boolean
  status: string
  onFile: (file: File) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="receipt-upload" ref={rootRef}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        id={`${idPrefix}-camera`}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <input type="file" accept="image/*" id={`${idPrefix}-gallery`} style={{ display: 'none' }} onChange={handleChange} />
      <button
        type="button"
        className={hasFile ? 'icon-btn ok' : 'icon-btn'}
        title={status}
        aria-label={status}
        onClick={() => setOpen((v) => !v)}
      >
        <CameraIcon />
      </button>
      {open && (
        <ul className="receipt-upload-menu">
          <li
            onMouseDown={(e) => {
              e.preventDefault()
              document.getElementById(`${idPrefix}-camera`)?.click()
              setOpen(false)
            }}
          >
            Take photo
          </li>
          <li
            onMouseDown={(e) => {
              e.preventDefault()
              document.getElementById(`${idPrefix}-gallery`)?.click()
              setOpen(false)
            }}
          >
            Choose from gallery
          </li>
        </ul>
      )}
    </div>
  )
}
