const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')

// ─── Supervisões ──────────────────────────────────────────────────────────────

router.get('/supervisoes', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT * FROM comp_cmvm_supervisoes ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/supervisoes', async (req, res) => {
  const { id, identificacao, data_comunicacao, assunto, detalhes,
          responsaveis, departamento, resposta_bc, data_resposta_bc,
          data_limite, estado, observacoes } = req.body
  if (!id) return res.status(400).json({ error: 'id obrigatório' })
  try {
    const { rows } = await compPool.query(`
      INSERT INTO comp_cmvm_supervisoes
        (id, identificacao, data_comunicacao, assunto, detalhes, responsaveis,
         departamento, resposta_bc, data_resposta_bc, data_limite, estado, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        identificacao=EXCLUDED.identificacao,
        data_comunicacao=EXCLUDED.data_comunicacao,
        assunto=EXCLUDED.assunto,
        detalhes=EXCLUDED.detalhes,
        responsaveis=EXCLUDED.responsaveis,
        departamento=EXCLUDED.departamento,
        resposta_bc=EXCLUDED.resposta_bc,
        data_resposta_bc=EXCLUDED.data_resposta_bc,
        data_limite=EXCLUDED.data_limite,
        estado=EXCLUDED.estado,
        observacoes=EXCLUDED.observacoes
      RETURNING *`,
      [id, identificacao||'', data_comunicacao||'', assunto||'', detalhes||'',
       responsaveis||'', departamento||'', resposta_bc||'', data_resposta_bc||'',
       data_limite||'', estado||'Pendente', observacoes||'']
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/supervisoes/bulk', async (req, res) => {
  const { rows: items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'rows deve ser array' })
  try {
    await compPool.query('DELETE FROM comp_cmvm_supervisoes')
    for (const s of items) {
      await compPool.query(`
        INSERT INTO comp_cmvm_supervisoes
          (id, identificacao, data_comunicacao, assunto, detalhes, responsaveis,
           departamento, resposta_bc, data_resposta_bc, data_limite, estado, observacoes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [s.id, s.identificacao||'', s.data_comunicacao||'', s.assunto||'', s.detalhes||'',
         s.responsaveis||'', s.departamento||'', s.resposta_bc||'', s.data_resposta_bc||'',
         s.data_limite||'', s.estado||'Pendente', s.observacoes||'']
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/supervisoes/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM comp_cmvm_supervisoes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Comunicações gerais ──────────────────────────────────────────────────────

router.get('/comunicacoes', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT * FROM comp_cmvm_comunicacoes ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/comunicacoes', async (req, res) => {
  const { id, ref, data, tipo, assunto, destinatario, responsavel, estado, observacoes } = req.body
  if (!id) return res.status(400).json({ error: 'id obrigatório' })
  try {
    const { rows } = await compPool.query(`
      INSERT INTO comp_cmvm_comunicacoes
        (id, ref, data, tipo, assunto, destinatario, responsavel, estado, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        ref=EXCLUDED.ref, data=EXCLUDED.data, tipo=EXCLUDED.tipo,
        assunto=EXCLUDED.assunto, destinatario=EXCLUDED.destinatario,
        responsavel=EXCLUDED.responsavel, estado=EXCLUDED.estado,
        observacoes=EXCLUDED.observacoes
      RETURNING *`,
      [id, ref||'', data||'', tipo||'Ofício', assunto||'', destinatario||'',
       responsavel||'', estado||'Em preparação', observacoes||'']
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/comunicacoes/bulk', async (req, res) => {
  const { rows: items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'rows deve ser array' })
  try {
    await compPool.query('DELETE FROM comp_cmvm_comunicacoes')
    for (const c of items) {
      await compPool.query(`
        INSERT INTO comp_cmvm_comunicacoes
          (id, ref, data, tipo, assunto, destinatario, responsavel, estado, observacoes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [c.id, c.ref||'', c.data||'', c.tipo||'Ofício', c.assunto||'', c.destinatario||'',
         c.responsavel||'', c.estado||'Em preparação', c.observacoes||'']
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/comunicacoes/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM comp_cmvm_comunicacoes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Comunicações de supervisão (sup_coms) ────────────────────────────────────

router.get('/sup-coms', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT * FROM comp_cmvm_sup_coms ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/sup-coms', async (req, res) => {
  const { id, supervisao_id, ref, data, tipo, assunto, responsavel, estado, observacoes } = req.body
  if (!id) return res.status(400).json({ error: 'id obrigatório' })
  try {
    const { rows } = await compPool.query(`
      INSERT INTO comp_cmvm_sup_coms
        (id, supervisao_id, ref, data, tipo, assunto, responsavel, estado, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        supervisao_id=EXCLUDED.supervisao_id, ref=EXCLUDED.ref, data=EXCLUDED.data,
        tipo=EXCLUDED.tipo, assunto=EXCLUDED.assunto, responsavel=EXCLUDED.responsavel,
        estado=EXCLUDED.estado, observacoes=EXCLUDED.observacoes
      RETURNING *`,
      [id, supervisao_id||'', ref||'', data||'', tipo||'Ofício', assunto||'',
       responsavel||'', estado||'Em preparação', observacoes||'']
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/sup-coms/bulk', async (req, res) => {
  const { rows: items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'rows deve ser array' })
  try {
    await compPool.query('DELETE FROM comp_cmvm_sup_coms')
    for (const c of items) {
      await compPool.query(`
        INSERT INTO comp_cmvm_sup_coms
          (id, supervisao_id, ref, data, tipo, assunto, responsavel, estado, observacoes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [c.id, c.supervisao_id||'', c.ref||'', c.data||'', c.tipo||'Ofício',
         c.assunto||'', c.responsavel||'', c.estado||'Em preparação', c.observacoes||'']
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/sup-coms/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM comp_cmvm_sup_coms WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Respostas ────────────────────────────────────────────────────────────────

router.get('/respostas', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT * FROM comp_cmvm_respostas ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/respostas', async (req, res) => {
  const { id, supervisao_ids, data, descricao, responsavel, ficheiros } = req.body
  if (!id) return res.status(400).json({ error: 'id obrigatório' })
  try {
    const { rows } = await compPool.query(`
      INSERT INTO comp_cmvm_respostas
        (id, supervisao_ids, data, descricao, responsavel, ficheiros)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        supervisao_ids=EXCLUDED.supervisao_ids, data=EXCLUDED.data,
        descricao=EXCLUDED.descricao, responsavel=EXCLUDED.responsavel,
        ficheiros=EXCLUDED.ficheiros
      RETURNING *`,
      [id, supervisao_ids||[], data||'', descricao||'', responsavel||'',
       JSON.stringify(ficheiros||[])]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/respostas/bulk', async (req, res) => {
  const { rows: items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'rows deve ser array' })
  try {
    await compPool.query('DELETE FROM comp_cmvm_respostas')
    for (const r of items) {
      await compPool.query(`
        INSERT INTO comp_cmvm_respostas
          (id, supervisao_ids, data, descricao, responsavel, ficheiros)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.id, r.supervisao_ids||[], r.data||'', r.descricao||'',
         r.responsavel||'', JSON.stringify(r.ficheiros||[])]
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/respostas/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM comp_cmvm_respostas WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
