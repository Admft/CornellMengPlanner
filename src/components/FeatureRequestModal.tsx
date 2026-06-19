import { useEffect, useRef, useState } from 'react'
import { submitFeatureRequest } from '../lib/submitFeatureRequest'

const CATEGORIES = [
  'Add an advisor',
  'Update curriculum / courses',
  'New feature',
  'Bug report',
  'Other',
] as const

interface FeatureRequestModalProps {
  open: boolean
  onClose: () => void
}

export function FeatureRequestModal({ open, onClose }: FeatureRequestModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function resetForm() {
    setName('')
    setReplyTo('')
    setCategory(CATEGORIES[0])
    setMessage('')
    setFiles([])
    setError('')
    setSuccess(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      setError('Please describe what you would like changed or added.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await submitFeatureRequest({
        name: name.trim(),
        replyTo: replyTo.trim(),
        category,
        message: message.trim(),
        files,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="req-dialog" onClose={handleClose}>
      <form className="req-modal" onSubmit={handleSubmit}>
        <div className="req-hdr">
          <div>
            <h2 className="req-title">Request a change</h2>
            <p className="req-sub">
              Suggest new advisors, curriculum updates, or other improvements. Attach
              files if helpful (e.g. a new proposal spreadsheet).
            </p>
          </div>
          <button type="button" className="req-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        {success ? (
          <div className="req-success">
            <div className="req-success-icon">✓</div>
            <p>
              <strong>Request sent.</strong> Thanks — we&apos;ll review it and follow up
              if needed.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="req-grid">
              <div className="fg">
                <label htmlFor="reqName">Your name</label>
                <input
                  id="reqName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="fg">
                <label htmlFor="reqReply">Your email</label>
                <input
                  id="reqReply"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="So we can reply (optional)"
                />
              </div>
            </div>

            <div className="fg">
              <label htmlFor="reqCategory">Request type</label>
              <select
                id="reqCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="fg">
              <label htmlFor="reqMessage">Details</label>
              <textarea
                id="reqMessage"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what you'd like added or changed…"
                required
              />
            </div>

            <div className="fg">
              <label htmlFor="reqFiles">Attachments</label>
              <input
                ref={fileInputRef}
                id="reqFiles"
                type="file"
                multiple
                accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv"
                onChange={handleFileChange}
              />
              <span className="hint">
                Up to 5 files, 4 MB total (.xlsx, .pdf, images, etc.)
              </span>
              {files.length > 0 && (
                <ul className="req-file-list">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>

            {error && <div className="val-msg show">⚠ {error}</div>}

            <div className="req-actions">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  )
}
