const crypto = require('crypto')

const SECRET = process.env.ENCRYPTION_SECRET || 'bc_enc_fallback_2026_bluecrow'

// Derive once at startup — scryptSync is intentionally slow, cache the result
const KEY = crypto.scryptSync(SECRET, 'bc_salt_2026', 32)

function encrypt(text) {
  if (!text) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join('.')
}

function decrypt(enc) {
  if (!enc) return null
  try {
    const [ivHex, tagHex, dataHex] = enc.split('.')
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch {
    return null
  }
}

module.exports = { encrypt, decrypt }
