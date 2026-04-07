import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Badge, prioVariant, estadoVariant } from '@/components/ui/Badge'
import { useStore } from '@/store/useStore'
import type { Incumprimento } from '@/types'

export function ControloInterno() {
  const { incumprimentos, addIncumprimento, updateIncumprimento, deleteIncumprimento } = useStore()
  const [tab, setTab] = useState(0)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<Incumprimento, 'id'>>({ descricao:'', area:'', data:'', gravidade:'Média', estado:'Em análise' })

  const TABS = ['Organogramas', 'Plano de Formação', 'Registo de Incumprimentos', 'Relatório de Controlo']

  return (
    <div className="p-6 space-y-4">
      <div className="tab-list">
        {TABS.map((t, i) => (
          <button key={t} data-state={tab === i ? 'active' : ''} className="tab-trigger" onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <div className="card p-12 text-center">
          <div className="text-[13px] font-medium text-gray-700 mb-2">Organogramas</div>
          <div className="text-[12px] text-gray-400 mb-4">Carregue o organograma da organização em PDF ou imagem.</div>
          <button className="btn btn-outline btn-sm">Carregar ficheiro</button>
        </div>
      )}

      {tab === 1 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Plano Anual de Formação 2026</span>
            <button className="btn btn-primary btn-sm"><Plus size={12} /> Adicionar</button>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Ação de Formação</th><th>Área</th><th>Data Prevista</th><th>Destinatários</th><th>Estado</th></tr></thead>
            <tbody>
              {[
                ['Formação RGPD — Nível Base','Jurídico/RH','Abr 2026','Todos os colaboradores','Planeada'],
                ['PBC/FT — Atualização Legislativa','Compliance','Mai 2026','Equipa Compliance','Por iniciar'],
                ['Controlo Interno — Procedimentos','Operacional','Jun 2026','Gestores','Por iniciar'],
                ['DORA — Resiliência Digital','TI/Compliance','Set 2026','Todos','Por iniciar'],
              ].map(([a,ar,d,dest,e]) => (
                <tr key={a}>
                  <td className="font-medium">{a}</td><td>{ar}</td><td>{d}</td><td>{dest}</td>
                  <td><Badge variant={estadoVariant(e)}>{e}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 2 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Registo de Incumprimentos e Deficiências</span>
            <button onClick={() => setModal(true)} className="btn btn-primary btn-sm"><Plus size={12} /> Registar</button>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Ref.</th><th>Descrição</th><th>Área</th><th>Data</th><th>Gravidade</th><th>Estado</th><th></th><th></th></tr></thead>
            <tbody>
              {incumprimentos.map((i) => (
                <tr key={i.id}>
                  <td className="text-gray-400 font-mono text-[11px]">{i.id}</td>
                  <td className="font-medium">{i.descricao}</td>
                  <td>{i.area}</td>
                  <td className="text-gray-400 text-[11px]">{i.data}</td>
                  <td><Badge variant={prioVariant(i.gravidade)}>{i.gravidade}</Badge></td>
                  <td><Badge variant={estadoVariant(i.estado)}>{i.estado}</Badge></td>
                  <td>
                    <select className="form-input w-28 py-0.5 text-[11px]" value={i.estado}
                      onChange={(e) => updateIncumprimento(i.id, { estado: e.target.value as Incumprimento['estado'] })}>
                      <option>Em análise</option><option>Atribuída</option><option>Resolvida</option><option>Fechada</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => { if (confirm(`Eliminar incumprimento "${i.descricao}"?`)) deleteIncumprimento(i.id) }}
                      className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 3 && (
        <div className="card p-12 text-center">
          <div className="text-[13px] font-medium text-gray-700 mb-2">Relatório de Controlo Interno</div>
          <div className="text-[12px] text-gray-400 mb-4">Carregue ou gere o relatório anual de controlo interno.</div>
          <div className="flex gap-2 justify-center">
            <button className="btn btn-outline btn-sm">Carregar PDF</button>
            <button className="btn btn-primary btn-sm">Gerar Relatório</button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-5 w-[480px] shadow-xl">
            <div className="text-[14px] font-semibold mb-4">Novo Incumprimento</div>
            <div className="space-y-3">
              <div><label className="form-label">Descrição</label><input className="form-input" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Área</label><input className="form-input" value={form.area} onChange={(e) => setForm({...form, area: e.target.value})} /></div>
                <div><label className="form-label">Data</label><input className="form-input" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                <div><label className="form-label">Gravidade</label>
                  <select className="form-input" value={form.gravidade} onChange={(e) => setForm({...form, gravidade: e.target.value as Incumprimento['gravidade']})}>
                    <option>Alta</option><option>Média</option><option>Baixa</option>
                  </select>
                </div>
                <div><label className="form-label">Estado</label>
                  <select className="form-input" value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value as Incumprimento['estado']})}>
                    <option>Em análise</option><option>Atribuída</option><option>Resolvida</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
              <button onClick={() => setModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={() => { addIncumprimento(form); setModal(false) }} className="btn btn-primary btn-sm">Registar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
