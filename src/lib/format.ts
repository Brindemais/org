export function formatBRL(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Espelha normalize_referral_code() no banco, só pra pré-visualização
// instantânea no front — a validação de verdade (unicidade, etc.) sempre
// roda no banco via referral_code_available/resolve_referral_code.
export function slugifyReferralCode(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function maskCPF(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function isValidCPF(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  if (rev !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  return rev === parseInt(cpf[10])
}

export function maskCNPJ(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function isValidCNPJ(cnpjRaw: string): boolean {
  const cnpj = cnpjRaw.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calcDigit = (len: number) => {
    let sum = 0
    let pos = len - 7
    for (let i = 0; i < len; i++) {
      sum += parseInt(cnpj[i]) * pos--
      if (pos < 2) pos = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  if (calcDigit(12) !== parseInt(cnpj[12])) return false
  return calcDigit(13) === parseInt(cnpj[13])
}

// Campo único de documento no cadastro de assinante: aceita CPF (11
// dígitos) ou CNPJ (14 dígitos), pra quem prefere receber valores altos
// por pessoa jurídica. O formato se ajusta sozinho pela quantidade de
// dígitos digitados.
export function maskCpfCnpj(v: string): string {
  const digits = v.replace(/\D/g, '')
  return digits.length > 11 ? maskCNPJ(v) : maskCPF(v)
}

export function isValidCpfCnpj(v: string): boolean {
  const digits = v.replace(/\D/g, '')
  return digits.length === 14 ? isValidCNPJ(v) : isValidCPF(v)
}

export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

// Espelha is_valid_br_phone() no banco — checagem de formato (DDD real,
// quantidade de dígitos, não é sequência repetida), não confirma que o
// número existe de verdade (isso exigiria envio de SMS).
export function isValidPhone(v: string): boolean {
  const digits = v.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return false
  const ddd = parseInt(digits.slice(0, 2), 10)
  if (!VALID_DDDS.has(ddd)) return false
  const local = digits.slice(2)
  if (/^(\d)\1+$/.test(local)) return false
  if (digits.length === 11 && local[0] !== '9') return false
  return true
}

export function isValidEmail(v: string): boolean {
  const trimmed = v.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254
}

export function maskCEP(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  return digits.replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskCardNumber(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function maskCardExpiry(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 4)
  return digits.replace(/(\d{2})(\d)/, '$1/$2')
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}
