import { useEffect, useId, useRef, useState } from 'react'
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode'
import { Camera, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface QrScannerModalProps {
  open: boolean
  onClose: () => void
  onScan: (text: string) => void
  title?: string
}

// Reads a QR code through the device camera and hands the decoded text
// back to the caller — used to auto-fill the pickup code a subscriber
// shows on their phone, instead of the partner typing it in by hand.
export function QrScannerModal({ open, onClose, onScan, title = 'Escanear QR Code' }: QrScannerModalProps) {
  const rawId = useId()
  const elementId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const scannerRef = useRef<Html5QrcodeType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    let done = false
    let scanner: Html5QrcodeType | null = null

    // Loaded on demand — the camera/decoding engine is a heavy dependency
    // that only the partner's "confirmar entrega" flow needs, so it
    // shouldn't sit in that page's main bundle for everyone who never taps
    // the scan button.
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (done) return
      scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (done) return
            done = true
            onScan(decodedText.trim())
            scanner!.stop().catch(() => {}).finally(() => {
              try { scanner!.clear() } catch { /* noop */ }
            })
            onClose()
          },
          () => {
            // Fires continuously while no code is in frame — not an error, ignore.
          },
        )
        .catch(() => {
          if (!done) setError('Não foi possível acessar a câmera. Verifique a permissão do navegador para este site.')
        })
    })

    return () => {
      done = true
      scanner?.stop().catch(() => {}).finally(() => {
        try { scanner?.clear() } catch { /* noop */ }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, elementId])

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div id={elementId} className="rounded-xl overflow-hidden bg-black min-h-[220px]" />
        {error ? (
          <p className="text-sm text-red-600 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}</p>
        ) : (
          <p className="text-xs text-black/50 flex items-center gap-1.5"><Camera size={14} /> Aponte a câmera para o QR code na tela do assinante.</p>
        )}
      </div>
    </Modal>
  )
}
