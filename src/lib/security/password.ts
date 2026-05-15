// Alfabeto sin caracteres ambiguos (0, O, 1, l, I) para facilitar lectura
// y dictado por canal seguro.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$'
const SECURE_ALPHABET = LETTERS + DIGITS + SYMBOLS

function csprngBytes(count: number): Uint32Array {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error(
      'No hay generador de aleatoriedad criptográfica disponible en este entorno; ' +
        'no se puede generar una contraseña segura.',
    )
  }
  const arr = new Uint32Array(count)
  crypto.getRandomValues(arr)
  return arr
}

/** Devuelve un carácter aleatorio criptográficamente seguro del alfabeto dado. */
function pickFrom(alphabet: string): string {
  const [n] = csprngBytes(1)
  return alphabet[n % alphabet.length]
}

/** Fisher-Yates shuffle in-place usando CSPRNG. */
function shuffle<T>(arr: T[]): T[] {
  const rnd = csprngBytes(arr.length)
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Genera una contraseña segura que GARANTIZA cumplir los requisitos del
 * schema (`passwordSchema` en user-schemas):
 *   - mínimo 8 caracteres
 *   - al menos un dígito
 *   - al menos una letra
 *
 * Estrategia: pre-pone 1 letra + 1 dígito (CSPRNG), llena el resto con el
 * alfabeto completo, y mezcla con Fisher-Yates para que las posiciones
 * obligatorias queden indistinguibles del resto.
 */
export function generateSecurePassword(length = 16): string {
  if (length < 8) {
    throw new Error('La longitud mínima es 8')
  }

  const required: string[] = [pickFrom(LETTERS), pickFrom(DIGITS)]
  const rest: string[] = []
  const rnd = csprngBytes(length - required.length)
  for (const n of rnd) {
    rest.push(SECURE_ALPHABET[n % SECURE_ALPHABET.length])
  }
  return shuffle([...required, ...rest]).join('')
}

export { SECURE_ALPHABET }
