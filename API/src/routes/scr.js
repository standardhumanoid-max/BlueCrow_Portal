const express      = require('express')
const router       = express.Router()
const { compPool } = require('../db')
const { decrypt }  = require('../cryptoUtils')

// Load SDK once at startup
let Anthropic = null
try {
  Anthropic = require('@anthropic-ai/sdk')
  if (Anthropic.default) Anthropic = Anthropic.default
} catch { /* SDK not installed */ }

// ── POST /api/scr/chat ────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { messages, fundName, pdfBase64, pdfMimeType } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obrigatório' })
  }
  if (!Anthropic) {
    return res.status(500).json({ error: 'SDK Anthropic não instalado no servidor' })
  }

  try {
    const { rows } = await compPool.query(
      'SELECT settings FROM portal_users WHERE id=$1',
      [req.user.id]
    )
    const settings = rows[0]?.settings ?? {}
    if (!settings.apikey) {
      return res.status(403).json({
        error: 'Chave API não configurada. Configure a sua chave nas definições do perfil (ícone no hub).',
      })
    }

    const apiKey = decrypt(settings.apikey)
    if (!apiKey) return res.status(500).json({ error: 'Erro ao desencriptar chave API' })

    const client = new Anthropic({ apiKey })

    const claudeMessages = messages.map((msg, i) => {
      if (i === 0 && pdfBase64) {
        return {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: pdfMimeType || 'application/pdf',
                data: pdfBase64,
              },
            },
            { type: 'text', text: msg.content },
          ],
        }
      }
      return { role: msg.role, content: msg.content }
    })

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: `És um assistente especializado em fundos de investimento da BlueCrow Capital. O utilizador vai fazer perguntas sobre o fundo "${fundName || 'desconhecido'}". Responde em Português de Portugal, de forma precisa e concisa, com base nos documentos fornecidos. Não inventes informação que não esteja no documento.`,
      messages: claudeMessages,
    })

    const text = response.content.find(c => c.type === 'text')?.text ?? ''
    res.json({ response: text })
  } catch (e) {
    if (e?.status === 401) {
      return res.status(401).json({ error: 'Chave API inválida. Verifique a chave nas definições do perfil.' })
    }
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
