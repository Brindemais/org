import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function ImageUpload({
  value, onChange, folder, label = 'Imagem', circular = false,
}: { value: string | null; onChange: (url: string) => void; folder: string; label?: string; circular?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('Imagem muito grande (máx. 4MB).')
      return
    }
    setError(null)
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${folder}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('public-images').upload(path, file, { upsert: false })
    setUploading(false)
    if (uploadError) {
      setError('Falha ao enviar a imagem.')
      return
    }
    const { data } = supabase.storage.from('public-images').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className={`bg-ink-950 border border-ink-700 overflow-hidden flex items-center justify-center shrink-0 ${
            circular ? 'w-16 h-16 rounded-full' : 'w-20 h-16 rounded-lg'
          }`}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-white/20" />
          )}
        </div>
        <div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-dark !py-2 !px-3 text-xs gap-1.5">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {uploading ? 'Enviando...' : value ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}
