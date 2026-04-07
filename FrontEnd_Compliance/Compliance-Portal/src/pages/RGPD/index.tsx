import { useState, useMemo, useEffect } from 'react'
import { sbLoad, sbSave, sbSaveAll, sbDelete } from '@/services/supabaseStore'
import { Plus, Download, AlertTriangle, FileText, Save, ChevronLeft, Trash2, Link2 } from 'lucide-react'
import { Badge, prioVariant, estadoVariant } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { useStore } from '@/store/useStore'
import { useExport } from '@/hooks/useExport'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { MatrizTratamento, DPIA } from '@/types'
import { DPIAEditor, emptyDPIA } from './DPIAEditor'
import type { DPIAFull } from './DPIAEditor'

// ─── DPIAFull persistence ──────────────────────────────────────────────────────
const DPIA_FULL_KEY = 'rgpd_dpias_full'
import clsx from 'clsx'

// ── Avaliação Inicial types & helpers ─────────────────────────────────────────
const AVAL_CRITERIOS = [
  'Os dados afetados são de natureza sensível (Art.º 9.º RGPD — saúde, origens raciais, dados biométricos, etc.)?',
  'O número de titulares afetados é elevado (superior a 500 pessoas)?',
  'Existe potencial para danos financeiros, discriminação ou roubo de identidade dos titulares?',
  'A violação envolve dados de populações vulneráveis (menores, idosos, pessoas com doença)?',
  'Os dados foram acedidos ou exfiltrados por terceiros não autorizados?',
  'Os dados foram tornados públicos ou amplamente difundidos (redes sociais, media)?',
  'É provável que os titulares sofram danos físicos, materiais ou morais irreversíveis?',
  'Existe risco de estigmatização social, chantagem ou dano reputacional grave?',
]

const AVAL_MEDIDAS_SEED = [
  { medida: 'Contenção imediata (isolamento de sistemas, revogação de acessos)',         resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Avaliação do impacto e extensão da violação',                               resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Notificação interna (DPO, Segurança da Informação, Jurídico)',              resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Notificação à CNPD — Art.º 33.º RGPD (prazo 72h)',                         resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Comunicação aos titulares afetados — Art.º 34.º RGPD (se aplicável)',      resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Recolha de evidências e análise forense',                                   resp: '', prazo: '', estado: 'Pendente' },
  { medida: 'Medidas corretivas e preventivas para evitar recorrência',                  resp: '', prazo: '', estado: 'Pendente' },
] as const

const AVAL_ASSIN_SEED = [
  { papel: 'Encarregado de Proteção de Dados (DPO)',   nome: '', cargo: '', data: '' },
  { papel: 'Responsável de Segurança da Informação',   nome: '', cargo: '', data: '' },
  { papel: 'Responsável do Departamento Afetado',      nome: '', cargo: '', data: '' },
  { papel: 'Responsável de Compliance / Jurídico',     nome: '', cargo: '', data: '' },
  { papel: 'Diretor / Conselho de Administração',      nome: '', cargo: '', data: '' },
]

type MedidaEstado = 'Pendente' | 'Em curso' | 'Concluída'

interface AvaliacaoMedida { medida: string; resp: string; prazo: string; estado: MedidaEstado }
interface AvaliacaoAssinatura { papel: string; nome: string; cargo: string; data: string }

interface AvaliacaoInicial {
  id: string; created_at: string
  s1_ref: string; s1_data_det: string; s1_hora_det: string; s1_data_ocorr: string; s1_hora_ocorr: string
  s1_detetado_por: string; s1_departamento: string; s1_data_preen: string; s1_responsavel: string
  s2_tipo: string[]; s2_origem: string; s2_causa: string; s2_descricao: string; s2_sistemas: string
  s3_categorias: string[]; s3_dados_esp: string[]; s3_n_titulares: string; s3_perfil: string[]; s3_extensao: string
  s4_respostas: string[]; s4_justificacoes: string[]; s4_risco: string
  s5_notif_cnpd: string; s5_cnpd_prazo: string; s5_cnpd_resp: string
  s5_notif_tit: string; s5_tit_just: string; s5_tit_data: string; s5_tit_resp: string
  s6_medidas: AvaliacaoMedida[]
  s7_ref_livro: string; s7_data_reg: string; s7_resp_reg: string
  s8_assinaturas: AvaliacaoAssinatura[]
  s9_obs: string
}

const AVAL_KEY = 'compliance_avaliacoes_iniciais'

function emptyAval(): Omit<AvaliacaoInicial,'id'|'created_at'> {
  return {
    s1_ref:'', s1_data_det:'', s1_hora_det:'', s1_data_ocorr:'', s1_hora_ocorr:'',
    s1_detetado_por:'', s1_departamento:'', s1_data_preen: new Date().toLocaleDateString('pt-PT'), s1_responsavel:'',
    s2_tipo:[], s2_origem:'', s2_causa:'', s2_descricao:'', s2_sistemas:'',
    s3_categorias:[], s3_dados_esp:[], s3_n_titulares:'', s3_perfil:[], s3_extensao:'',
    s4_respostas: Array(8).fill(''), s4_justificacoes: Array(8).fill(''), s4_risco:'',
    s5_notif_cnpd:'', s5_cnpd_prazo:'', s5_cnpd_resp:'',
    s5_notif_tit:'', s5_tit_just:'', s5_tit_data:'', s5_tit_resp:'',
    s6_medidas: AVAL_MEDIDAS_SEED.map(m => ({ ...m, estado: 'Pendente' as MedidaEstado })),
    s7_ref_livro:'', s7_data_reg:'', s7_resp_reg:'',
    s8_assinaturas: AVAL_ASSIN_SEED.map(a => ({ ...a })),
    s9_obs:'',
  }
}

function calcAvalRisco(r: string[]): string {
  const n = r.filter(x => x === 'Sim').length
  if (n >= 6) return 'Muito Elevado'; if (n >= 4) return 'Elevado'; if (n >= 2) return 'Médio'; return 'Baixo'
}

const AVAL_RISCO_CLS: Record<string,string> = {
  'Baixo':        'bg-green-50 border-green-200 text-green-700',
  'Médio':        'bg-amber-50 border-amber-200 text-amber-700',
  'Elevado':      'bg-orange-50 border-orange-200 text-orange-700',
  'Muito Elevado':'bg-red-50 border-red-200 text-red-700',
}

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

function CheckGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange(v:string[]):void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" className="w-3.5 h-3.5 rounded accent-blue-600"
            checked={selected.includes(opt)} onChange={() => onChange(toggleArr(selected, opt))} />
          <span className="text-[12px] text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange(v:string):void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" className="w-3.5 h-3.5 accent-blue-600"
            checked={value === opt} onChange={() => onChange(opt)} />
          <span className="text-[12px] text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function SectionBox({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
        <span className="text-[13px] font-semibold text-gray-900">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function exportAvalPDF(av: AvaliacaoInicial) {
  // dynamic import to avoid circular issues
  Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([{ default: jsPDF }]) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const autoTable = (doc as any).autoTable.bind(doc)
    const W = 210; const M = 14; let y = 18

    const addTitle = (t: string) => { doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95); doc.text(t, M, y); y += 7 }
    const addSub = (t: string) => { doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(120); doc.text(t, M, y); y += 6 }
    const addSection = (n: number, title: string) => {
      if (y > 250) { doc.addPage(); y = 18 }
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
      doc.text(`${n}. ${title}`, M, y); y += 1
      doc.setDrawColor(30,58,95); doc.setLineWidth(0.3); doc.line(M, y+1, W-M, y+1); y += 5
    }
    const addKV = (label: string, value: string, x2 = 80) => {
      if (y > 270) { doc.addPage(); y = 18 }
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(80); doc.text(`${label}:`, M, y)
      doc.setFont('helvetica','normal'); doc.setTextColor(30)
      const lines = doc.splitTextToSize(value || '—', W - M - x2)
      doc.text(lines, M + x2 - 20, y); y += Math.max(5, lines.length * 4.5)
    }

    addTitle('Avaliação Inicial de Violação de Dados Pessoais')
    addSub(`Artigos 33.º e 34.º do RGPD (UE) 2016/679  ·  Gerado em ${new Date().toLocaleDateString('pt-PT')}`)
    y += 2

    addSection(1, 'Identificação do Incidente')
    const s1rows = [
      ['N.º Referência', av.s1_ref, 'Data/Hora Deteção', `${av.s1_data_det} ${av.s1_hora_det}`],
      ['Data/Hora Ocorrência', `${av.s1_data_ocorr} ${av.s1_hora_ocorr}`, 'Detetado por', av.s1_detetado_por],
      ['Departamento', av.s1_departamento, 'Responsável Preenchimento', av.s1_responsavel],
      ['Data Preenchimento', av.s1_data_preen, '', ''],
    ]
    autoTable({ startY: y, margin: { left: M }, tableWidth: W - 2*M,
      body: s1rows, styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0:{fontStyle:'bold',fillColor:[239,246,255],cellWidth:40}, 2:{fontStyle:'bold',fillColor:[239,246,255],cellWidth:40} },
      theme:'grid', didDrawPage: (d: any) => { y = d.cursor.y + 4 } })
    y = (doc as any).lastAutoTable.finalY + 4

    addSection(2, 'Descrição da Violação')
    addKV('Tipo', av.s2_tipo.join(', '))
    addKV('Origem', av.s2_origem)
    addKV('Causa Provável', av.s2_causa)
    addKV('Descrição Detalhada', av.s2_descricao)
    addKV('Sistemas/Processos Afetados', av.s2_sistemas)
    y += 2

    addSection(3, 'Dados e Titulares Afetados')
    addKV('Categorias de Dados', av.s3_categorias.join(', '))
    addKV('Dados Especiais (Art.º 9.º)', av.s3_dados_esp.join(', ') || 'Não aplicável')
    addKV('N.º Titulares Afetados', av.s3_n_titulares)
    addKV('Perfil dos Titulares', av.s3_perfil.join(', '))
    addKV('Extensão Geográfica', av.s3_extensao)
    y += 2

    addSection(4, 'Avaliação Preliminar do Risco')
    autoTable({ startY: y, margin: { left: M }, tableWidth: W - 2*M,
      head: [['Critério','Resposta','Justificação']],
      body: AVAL_CRITERIOS.map((c,i) => [c, av.s4_respostas[i] || '—', av.s4_justificacoes[i] || '']),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor:[30,58,95], textColor:255, fontStyle:'bold' },
      columnStyles: { 0:{cellWidth:90}, 1:{cellWidth:20,halign:'center'}, 2:{cellWidth:'auto'} },
      theme:'grid' })
    y = (doc as any).lastAutoTable.finalY + 3
    if (y > 260) { doc.addPage(); y = 18 }
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,58,95)
    doc.text(`Nível de Risco Calculado: ${av.s4_risco || calcAvalRisco(av.s4_respostas)}`, M, y); y += 8

    addSection(5, 'Obrigações de Notificação')
    addKV('Notificar CNPD (Art.º 33.º)?', av.s5_notif_cnpd)
    addKV('Data Limite CNPD (72h)', av.s5_cnpd_prazo)
    addKV('Responsável CNPD', av.s5_cnpd_resp)
    addKV('Comunicar Titulares (Art.º 34.º)?', av.s5_notif_tit)
    addKV('Justificação', av.s5_tit_just)
    addKV('Data Prevista', av.s5_tit_data)
    addKV('Responsável Titulares', av.s5_tit_resp)
    y += 2

    addSection(6, 'Medidas de Contenção e Remediação')
    autoTable({ startY: y, margin: { left: M }, tableWidth: W - 2*M,
      head: [['Medida','Responsável','Prazo','Estado']],
      body: av.s6_medidas.map(m => [m.medida, m.resp || '—', m.prazo || '—', m.estado]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor:[30,58,95], textColor:255, fontStyle:'bold' },
      columnStyles: { 0:{cellWidth:80}, 3:{cellWidth:22,halign:'center'} },
      theme:'grid' })
    y = (doc as any).lastAutoTable.finalY + 4

    addSection(7, 'Registo no Livro de Incidentes')
    addKV('Ref. Livro de Incidentes', av.s7_ref_livro)
    addKV('Data do Registo', av.s7_data_reg)
    addKV('Responsável pelo Registo', av.s7_resp_reg)
    y += 2

    addSection(8, 'Aprovação e Assinaturas')
    autoTable({ startY: y, margin: { left: M }, tableWidth: W - 2*M,
      head: [['Papel','Nome','Cargo','Data']],
      body: av.s8_assinaturas.map(a => [a.papel, a.nome || '___________________', a.cargo || '___________________', a.data || '___/___/_____']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor:[30,58,95], textColor:255, fontStyle:'bold' },
      theme:'grid' })
    y = (doc as any).lastAutoTable.finalY + 4

    if (av.s9_obs) {
      addSection(9, 'Observações Adicionais')
      doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(50)
      const lines = doc.splitTextToSize(av.s9_obs, W - 2*M)
      doc.text(lines, M, y)
    }

    doc.save(`Avaliacao-Inicial-${av.s1_ref || av.id}.pdf`)
  })
}

function AvaliacaoInicialTab() {
  const [list, setList]     = useState<AvaliacaoInicial[]>([])
  const [view, setView]     = useState<'list'|'form'>('list')
  useEffect(() => { sbLoad<AvaliacaoInicial>('rgpd_avaliacoes_iniciais', AVAL_KEY, []).then(setList) }, [])
  const [editing, setEditing] = useState<AvaliacaoInicial | null>(null)
  const [form, setForm]     = useState(emptyAval())

  const risco = useMemo(() => calcAvalRisco(form.s4_respostas), [form.s4_respostas])

  function openNew() { setForm(emptyAval()); setEditing(null); setView('form') }
  function openEdit(av: AvaliacaoInicial) {
    const { id, created_at, ...rest } = av
    setForm(rest); setEditing(av); setView('form')
  }
  function saveForm() {
    const now = new Date().toISOString()
    const updated = editing
      ? list.map(a => a.id === editing.id ? { ...editing, ...form, s4_risco: risco } : a)
      : [...list, { id: `AVI-${Date.now()}`, created_at: now, ...form, s4_risco: risco }]
    sbSaveAll('rgpd_avaliacoes_iniciais', AVAL_KEY, updated); setList(updated); setView('list')
  }
  function deleteAval(id: string) {
    if (!confirm('Eliminar esta avaliação?')) return
    const updated = list.filter(a => a.id !== id)
    sbSaveAll('rgpd_avaliacoes_iniciais', AVAL_KEY, updated); setList(updated)
  }

  const upd = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const updR = (i: number, v: string) => { const a = [...form.s4_respostas]; a[i]=v; upd({ s4_respostas: a }) }
  const updJ = (i: number, v: string) => { const a = [...form.s4_justificacoes]; a[i]=v; upd({ s4_justificacoes: a }) }
  const updM = (i: number, patch: Partial<AvaliacaoMedida>) => {
    const m = form.s6_medidas.map((x,j) => j===i ? {...x,...patch} : x)
    upd({ s6_medidas: m })
  }
  const updA = (i: number, patch: Partial<AvaliacaoAssinatura>) => {
    const a = form.s8_assinaturas.map((x,j) => j===i ? {...x,...patch} : x)
    upd({ s8_assinaturas: a })
  }

  if (view === 'list') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Avaliações Iniciais de Violações de Dados</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Art.º 33.º e 34.º RGPD · Conservação mínima 3 anos</p>
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={12} /> Nova Avaliação</button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500 font-medium">Nenhuma avaliação registada</p>
          <p className="text-[11px] text-gray-400 mt-1">Clique em «Nova Avaliação» para iniciar o preenchimento</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Referência</th>
                <th className="px-4 py-3 text-left font-medium">Data Deteção</th>
                <th className="px-4 py-3 text-left font-medium">Responsável</th>
                <th className="px-4 py-3 text-left font-medium">Tipo Violação</th>
                <th className="px-4 py-3 text-center font-medium">N.º Titulares</th>
                <th className="px-4 py-3 text-center font-medium">Risco</th>
                <th className="px-4 py-3 text-center font-medium">Notif. CNPD</th>
                <th className="px-4 py-3 text-left font-medium">Registado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map(av => (
                <tr key={av.id} className="border-b border-gray-50 hover:bg-gray-50 text-[11px]">
                  <td className="px-4 py-2.5 font-medium text-blue-700">{av.s1_ref || av.id}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{av.s1_data_det}</td>
                  <td className="px-4 py-2.5">{av.s1_responsavel}</td>
                  <td className="px-4 py-2.5">{av.s2_tipo.join(', ')}</td>
                  <td className="px-4 py-2.5 text-center">{av.s3_n_titulares || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {av.s4_risco && <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', AVAL_RISCO_CLS[av.s4_risco])}>{av.s4_risco}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      av.s5_notif_cnpd === 'Sim' ? 'bg-green-100 text-green-700' : av.s5_notif_cnpd === 'Não' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700')}>
                      {av.s5_notif_cnpd || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(av.created_at).toLocaleDateString('pt-PT')}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(av)} className="text-[11px] text-blue-600 hover:text-blue-800">Editar</button>
                      <button onClick={() => exportAvalPDF(av)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"><FileText size={11}/> PDF</button>
                      <button onClick={() => deleteAval(av.id)}><Trash2 size={12} className="text-red-400 hover:text-red-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800">
          <ChevronLeft size={14}/> Voltar à lista
        </button>
        <div className="flex gap-2">
          <button onClick={saveForm} className="btn btn-primary btn-sm"><Save size={12}/> Guardar</button>
          {editing && <button onClick={() => exportAvalPDF({ ...editing, ...form, s4_risco: risco })} className="btn btn-outline btn-sm"><FileText size={12}/> Exportar PDF</button>}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-[11px] text-blue-700">
        <strong>Avaliação Inicial de Violação de Dados Pessoais</strong> — Artigos 33.º e 34.º do RGPD (UE) 2016/679
      </div>

      {/* S1 — Identificação */}
      <SectionBox n={1} title="Identificação do Incidente">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="form-label">N.º de Referência</label><input className="form-input" placeholder="Ex: INC-2026-0001" value={form.s1_ref} onChange={e=>upd({s1_ref:e.target.value})} /></div>
          <div><label className="form-label">Data de Deteção</label><input className="form-input" placeholder="DD/MM/AAAA" value={form.s1_data_det} onChange={e=>upd({s1_data_det:e.target.value})} /></div>
          <div><label className="form-label">Hora de Deteção</label><input className="form-input" placeholder="HH:MM" value={form.s1_hora_det} onChange={e=>upd({s1_hora_det:e.target.value})} /></div>
          <div><label className="form-label">Data de Ocorrência</label><input className="form-input" placeholder="DD/MM/AAAA" value={form.s1_data_ocorr} onChange={e=>upd({s1_data_ocorr:e.target.value})} /></div>
          <div><label className="form-label">Hora de Ocorrência</label><input className="form-input" placeholder="HH:MM" value={form.s1_hora_ocorr} onChange={e=>upd({s1_hora_ocorr:e.target.value})} /></div>
          <div><label className="form-label">Detetado por</label><input className="form-input" placeholder="Nome / Função" value={form.s1_detetado_por} onChange={e=>upd({s1_detetado_por:e.target.value})} /></div>
          <div><label className="form-label">Departamento / Área</label><input className="form-input" placeholder="Ex: Compliance" value={form.s1_departamento} onChange={e=>upd({s1_departamento:e.target.value})} /></div>
          <div><label className="form-label">Data de Preenchimento</label><input className="form-input" value={form.s1_data_preen} onChange={e=>upd({s1_data_preen:e.target.value})} /></div>
          <div><label className="form-label">Responsável pelo Preenchimento</label><input className="form-input" placeholder="Nome / Cargo" value={form.s1_responsavel} onChange={e=>upd({s1_responsavel:e.target.value})} /></div>
        </div>
      </SectionBox>

      {/* S2 — Descrição */}
      <SectionBox n={2} title="Descrição da Violação">
        <div className="space-y-3">
          <div>
            <label className="form-label">Tipo de Violação</label>
            <CheckGroup options={['Confidencialidade','Integridade','Disponibilidade']} selected={form.s2_tipo} onChange={v=>upd({s2_tipo:v})} />
          </div>
          <div>
            <label className="form-label">Origem</label>
            <RadioGroup options={['Interna','Externa','Desconhecida']} value={form.s2_origem} onChange={v=>upd({s2_origem:v})} />
          </div>
          <div><label className="form-label">Causa Provável</label>
            <select className="form-input w-60" value={form.s2_causa} onChange={e=>upd({s2_causa:e.target.value})}>
              <option value="">Selecionar...</option>
              <option>Ataque externo (phishing, ransomware, intrusão)</option>
              <option>Erro humano (envio indevido, perda de dispositivo)</option>
              <option>Falha técnica (sistema, backup, encriptação)</option>
              <option>Ato malicioso interno</option>
              <option>Acesso não autorizado interno</option>
              <option>Outra / Desconhecida</option>
            </select>
          </div>
          <div><label className="form-label">Descrição Detalhada</label>
            <textarea className="form-input" rows={3} placeholder="Descreva o incidente com o máximo detalhe possível..." value={form.s2_descricao} onChange={e=>upd({s2_descricao:e.target.value})} />
          </div>
          <div><label className="form-label">Sistemas / Processos Afetados</label>
            <input className="form-input" placeholder="Ex: CRM, servidor de e-mail, base de dados de clientes..." value={form.s2_sistemas} onChange={e=>upd({s2_sistemas:e.target.value})} />
          </div>
        </div>
      </SectionBox>

      {/* S3 — Dados e Titulares */}
      <SectionBox n={3} title="Dados e Titulares Afetados">
        <div className="space-y-3">
          <div>
            <label className="form-label">Categorias de Dados Pessoais</label>
            <CheckGroup options={['Identificação (nome, morada, e-mail)','Dados de Contacto','Dados Financeiros / Bancários','Dados de Saúde','Dados de Localização','Dados Profissionais','Dados de Navegação / IP','Outros']} selected={form.s3_categorias} onChange={v=>upd({s3_categorias:v})} />
          </div>
          <div>
            <label className="form-label">Dados de Categorias Especiais — Art.º 9.º RGPD</label>
            <CheckGroup options={['Dados de saúde','Dados genéticos','Dados biométricos','Origem racial ou étnica','Opiniões políticas','Crenças religiosas ou filosóficas','Filiação sindical','Vida ou orientação sexual','Condenações penais']} selected={form.s3_dados_esp} onChange={v=>upd({s3_dados_esp:v})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">N.º de Titulares Afetados (estimativa)</label>
              <input className="form-input" placeholder="Ex: 250 ou Desconhecido" value={form.s3_n_titulares} onChange={e=>upd({s3_n_titulares:e.target.value})} />
            </div>
            <div><label className="form-label">Extensão Geográfica</label>
              <input className="form-input" placeholder="Ex: Nacional, Portugal e Espanha..." value={form.s3_extensao} onChange={e=>upd({s3_extensao:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="form-label">Perfil dos Titulares</label>
            <CheckGroup options={['Clientes','Colaboradores','Investidores','Menores de idade','Pessoas vulneráveis','Prestadores de serviço','Outros']} selected={form.s3_perfil} onChange={v=>upd({s3_perfil:v})} />
          </div>
        </div>
      </SectionBox>

      {/* S4 — Avaliação de Risco */}
      <SectionBox n={4} title="Avaliação Preliminar do Risco">
        <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden mb-4">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left font-medium">Critério de Avaliação</th>
              <th className="px-4 py-3 text-center font-medium w-14">Sim</th>
              <th className="px-4 py-3 text-center font-medium w-14">Não</th>
              <th className="px-4 py-3 text-center font-medium w-14">N.A.</th>
              <th className="px-4 py-3 text-left font-medium">Justificação</th>
            </tr>
          </thead>
          <tbody>
            {AVAL_CRITERIOS.map((c,i) => (
              <tr key={i} className={clsx('border-b border-gray-50', i%2===0?'bg-white':'bg-gray-50/40')}>
                <td className="px-4 py-3 text-[12px] text-gray-700">{c}</td>
                {(['Sim','Não','N.A.'] as const).map(opt => (
                  <td key={opt} className="px-4 py-3 text-center">
                    <button onClick={()=>updR(i,form.s4_respostas[i]===opt?'':opt)}
                      className={clsx('w-5 h-5 rounded border-2 transition-colors flex items-center justify-center mx-auto',
                        form.s4_respostas[i]===opt
                          ? opt==='Sim'?'bg-green-500 border-green-500':opt==='Não'?'bg-red-400 border-red-400':'bg-gray-400 border-gray-400'
                          : 'border-gray-300 hover:border-gray-400')}>
                      {form.s4_respostas[i]===opt && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </button>
                  </td>
                ))}
                <td className="px-4 py-3">
                  <input className="form-input py-1 text-[11px]" placeholder="Justificação..." value={form.s4_justificacoes[i]} onChange={e=>updJ(i,e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={clsx('rounded-xl border px-5 py-4', AVAL_RISCO_CLS[risco] || 'bg-gray-50 border-gray-100')}>
          <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-1">Nível de Risco Calculado</div>
          <div className="text-2xl font-bold">{risco}</div>
          {(risco === 'Médio' || risco === 'Elevado' || risco === 'Muito Elevado') && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium">Notificação à CNPD obrigatória em 72h — Art.º 33.º RGPD</span>
            </div>
          )}
        </div>
      </SectionBox>

      {/* S5 — Obrigações de Notificação */}
      <SectionBox n={5} title="Obrigações de Notificação">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-[12px] font-semibold text-gray-800">Art.º 33.º — Notificação à Autoridade de Controlo (CNPD)</div>
            <div>
              <label className="form-label">Necessidade de Notificar</label>
              <RadioGroup options={['Sim','Não','Em avaliação']} value={form.s5_notif_cnpd} onChange={v=>upd({s5_notif_cnpd:v})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Data Limite (72h após deteção)</label>
                <input className="form-input" placeholder="DD/MM/AAAA HH:MM" value={form.s5_cnpd_prazo} onChange={e=>upd({s5_cnpd_prazo:e.target.value})} />
              </div>
              <div><label className="form-label">Responsável pela Notificação</label>
                <input className="form-input" placeholder="Nome / Cargo" value={form.s5_cnpd_resp} onChange={e=>upd({s5_cnpd_resp:e.target.value})} />
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-[12px] font-semibold text-gray-800">Art.º 34.º — Comunicação aos Titulares dos Dados</div>
            <div>
              <label className="form-label">Necessidade de Comunicar</label>
              <RadioGroup options={['Sim','Não','Em avaliação']} value={form.s5_notif_tit} onChange={v=>upd({s5_notif_tit:v})} />
            </div>
            <div><label className="form-label">Justificação</label>
              <textarea className="form-input" rows={2} placeholder="Fundamento legal ou justificação para a decisão..." value={form.s5_tit_just} onChange={e=>upd({s5_tit_just:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Data Prevista de Comunicação</label>
                <input className="form-input" placeholder="DD/MM/AAAA" value={form.s5_tit_data} onChange={e=>upd({s5_tit_data:e.target.value})} />
              </div>
              <div><label className="form-label">Responsável pela Comunicação</label>
                <input className="form-input" placeholder="Nome / Cargo" value={form.s5_tit_resp} onChange={e=>upd({s5_tit_resp:e.target.value})} />
              </div>
            </div>
          </div>
        </div>
      </SectionBox>

      {/* S6 — Medidas */}
      <SectionBox n={6} title="Medidas de Contenção e Remediação">
        <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left font-medium">Medida</th>
              <th className="px-4 py-3 text-left font-medium w-40">Responsável</th>
              <th className="px-4 py-3 text-left font-medium w-36">Prazo</th>
              <th className="px-4 py-3 text-center font-medium w-28">Estado</th>
            </tr>
          </thead>
          <tbody>
            {form.s6_medidas.map((m,i) => (
              <tr key={i} className={clsx('border-b border-gray-50', i%2===0?'bg-white':'bg-gray-50/40')}>
                <td className="px-4 py-2.5 text-[12px] text-gray-700">{m.medida}</td>
                <td className="px-4 py-2.5"><input className="form-input py-1 text-[11px]" placeholder="Responsável" value={m.resp} onChange={e=>updM(i,{resp:e.target.value})} /></td>
                <td className="px-4 py-2.5"><input className="form-input py-1 text-[11px]" placeholder="DD/MM/AAAA" value={m.prazo} onChange={e=>updM(i,{prazo:e.target.value})} /></td>
                <td className="px-4 py-2.5">
                  <select className="form-input py-1 text-[11px]" value={m.estado} onChange={e=>updM(i,{estado:e.target.value as MedidaEstado})}>
                    <option>Pendente</option><option>Em curso</option><option>Concluída</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBox>

      {/* S7 — Registo */}
      <SectionBox n={7} title="Registo no Livro de Incidentes">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="form-label">Ref. no Livro de Incidentes</label><input className="form-input" placeholder="INC-2026-0001" value={form.s7_ref_livro} onChange={e=>upd({s7_ref_livro:e.target.value})} /></div>
          <div><label className="form-label">Data do Registo</label><input className="form-input" placeholder="DD/MM/AAAA" value={form.s7_data_reg} onChange={e=>upd({s7_data_reg:e.target.value})} /></div>
          <div><label className="form-label">Responsável pelo Registo</label><input className="form-input" placeholder="Nome / Cargo" value={form.s7_resp_reg} onChange={e=>upd({s7_resp_reg:e.target.value})} /></div>
        </div>
      </SectionBox>

      {/* S8 — Assinaturas */}
      <SectionBox n={8} title="Aprovação e Assinaturas">
        <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left font-medium w-56">Papel</th>
              <th className="px-4 py-3 text-left font-medium">Nome</th>
              <th className="px-4 py-3 text-left font-medium">Cargo</th>
              <th className="px-4 py-3 text-left font-medium w-36">Data</th>
            </tr>
          </thead>
          <tbody>
            {form.s8_assinaturas.map((a,i) => (
              <tr key={i} className={clsx('border-b border-gray-50', i%2===0?'bg-white':'bg-gray-50/40')}>
                <td className="px-4 py-2.5 text-[12px] font-medium text-gray-700">{a.papel}</td>
                <td className="px-4 py-2.5"><input className="form-input py-1 text-[11px]" placeholder="Nome completo" value={a.nome} onChange={e=>updA(i,{nome:e.target.value})} /></td>
                <td className="px-4 py-2.5"><input className="form-input py-1 text-[11px]" placeholder="Cargo" value={a.cargo} onChange={e=>updA(i,{cargo:e.target.value})} /></td>
                <td className="px-4 py-2.5"><input className="form-input py-1 text-[11px]" placeholder="DD/MM/AAAA" value={a.data} onChange={e=>updA(i,{data:e.target.value})} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBox>

      {/* S9 — Observações */}
      <SectionBox n={9} title="Observações Adicionais">
        <textarea className="form-input" rows={4} placeholder="Informações adicionais, notas, referências a documentos externos..." value={form.s9_obs} onChange={e=>upd({s9_obs:e.target.value})} />
      </SectionBox>

      <div className="flex justify-end gap-2 pb-4">
        <button onClick={() => setView('list')} className="btn btn-outline btn-sm">Cancelar</button>
        <button onClick={saveForm} className="btn btn-primary btn-sm"><Save size={12}/> Guardar Avaliação</button>
      </div>
    </div>
  )
}

// ── Incidentes types ──────────────────────────────────────────────────────────
interface Incidente {
  id: string
  data_detecao: string
  data_ocorrencia: string
  responsavel: string
  tipo: 'Confidencialidade' | 'Integridade' | 'Disponibilidade'
  causa: string
  descricao: string
  n_titulares: string
  categorias_dados: string
  risco: 'Baixo' | 'Médio' | 'Elevado' | 'Muito Elevado'
  estado: 'Aberto' | 'Em Curso' | 'Notificado CNPD' | 'Fechado'
  notificacao_cnpd: 'Notificado' | 'Pendente' | 'Não aplicável'
  data_notif_cnpd: string
  medidas: string
  observacoes: string
  data_registo: string
}

const CRITERIOS_RISCO = [
  'Os dados afetados são de natureza sensível (categorias especiais, Art.º 9.º RGPD)?',
  'O número de titulares afetados é elevado (superior a 500)?',
  'Há potencial para danos financeiros, discriminação ou roubo de identidade?',
  'Envolve dados de populações vulneráveis (menores, idosos, doentes)?',
  'Os dados foram acedidos por terceiros não autorizados?',
  'Os dados foram tornados públicos ou amplamente difundidos?',
  'É provável que os titulares sofram danos irreversíveis?',
  'Existe risco de estigmatização social ou dano reputacional grave?',
  'A violação está associada a um ataque dirigido (ransomware, APT)?',
  'Existem medidas técnicas que mitigam parcialmente o impacto (ex.: encriptação)?',
]

function calcRisco(sims: boolean[]): Incidente['risco'] {
  const score = sims.filter(Boolean).length
  if (score >= 7) return 'Muito Elevado'
  if (score >= 5) return 'Elevado'
  if (score >= 3) return 'Médio'
  return 'Baixo'
}

// ── Plano de Implementação ────────────────────────────────────────────────────
interface PlanoItem {
  id: string
  fase: string
  tarefa: string
  resp: string
  prazo: string
  estado: string
}

// ── Retenção e Eliminação ─────────────────────────────────────────────────────
interface RetencaoItem {
  id: string
  tratamento: string
  departamento: string
  tipo_dados: string
  prazo_retencao: string
  base_legal: string
  metodo_eliminacao: string
}

const SEED_INCIDENTES: Incidente[] = [
  {
    id:'INC-2025-0001', data_detecao:'15/01/2025', data_ocorrencia:'14/01/2025', data_registo:'15/01/2025',
    responsavel:'Ana Silva / DPO', tipo:'Confidencialidade', causa:'Ataque externo',
    descricao:'Acesso não autorizado à base de dados de clientes via phishing. Detetado pelo SIEM às 09:32h.',
    n_titulares:'1.250', categorias_dados:'Nome, E-mail, NIF, Dados financeiros',
    risco:'Elevado', estado:'Fechado', notificacao_cnpd:'Notificado', data_notif_cnpd:'17/01/2025',
    medidas:'Bloqueio imediato da conta comprometida; reset de credenciais; notificação à CNPD em 48h.',
    observacoes:'Investigação forense concluída. Sem evidência de exfiltração de dados.',
  },
  {
    id:'INC-2025-0002', data_detecao:'03/03/2025', data_ocorrencia:'', data_registo:'03/03/2025',
    responsavel:'João Ferreira / IT Security', tipo:'Disponibilidade', causa:'Falha técnica',
    descricao:'Falha no servidor de backup resultou em perda temporária de acesso a ficheiros de RH.',
    n_titulares:'85', categorias_dados:'Dados de colaboradores, Dados salariais',
    risco:'Médio', estado:'Fechado', notificacao_cnpd:'Não aplicável', data_notif_cnpd:'',
    medidas:'Restauro a partir de backup secundário em 4h. Revisão dos procedimentos de backup.',
    observacoes:'Risco baixo para titulares; dados não foram acedidos por terceiros.',
  },
  {
    id:'INC-2025-0003', data_detecao:'10/06/2025', data_ocorrencia:'10/06/2025', data_registo:'10/06/2025',
    responsavel:'Carla Matos / RH', tipo:'Confidencialidade', causa:'Erro humano',
    descricao:'Envio acidental de ficheiro com dados pessoais de 30 colaboradores para endereço externo errado.',
    n_titulares:'30', categorias_dados:'Nome, Morada, Salário, Data de nascimento',
    risco:'Elevado', estado:'Notificado CNPD', notificacao_cnpd:'Notificado', data_notif_cnpd:'12/06/2025',
    medidas:'Solicitação imediata de eliminação ao destinatário. Sensibilização da equipa de RH.',
    observacoes:'Destinatário confirmou eliminação do e-mail. CNPD notificada dentro do prazo de 72h.',
  },
  {
    id:'INC-2025-0004', data_detecao:'18/09/2025', data_ocorrencia:'', data_registo:'18/09/2025',
    responsavel:'Pedro Costa / TI', tipo:'Integridade', causa:'Ato malicioso interno',
    descricao:'Modificação não autorizada de registos de clientes por ex-colaborador com acesso ativo.',
    n_titulares:'Desconhecido', categorias_dados:'Nome, Morada, Dados de conta',
    risco:'Muito Elevado', estado:'Em Curso', notificacao_cnpd:'Pendente', data_notif_cnpd:'18/09/2025',
    medidas:'Revogação imediata de acessos. Análise forense em curso. Participação criminal em preparação.',
    observacoes:'Investigação interna e forense em curso. Comunicação aos titulares a considerar.',
  },
  {
    id:'INC-2026-0001', data_detecao:'20/03/2026', data_ocorrencia:'', data_registo:'20/03/2026',
    responsavel:'Sofia Lopes / Compliance', tipo:'Confidencialidade', causa:'Desconhecida',
    descricao:'Suspeita de acesso indevido a dados de saúde de pacientes. Origem ainda não determinada.',
    n_titulares:'Desconhecido', categorias_dados:'Dados de saúde (Art.º 9.º RGPD)',
    risco:'Muito Elevado', estado:'Aberto', notificacao_cnpd:'Pendente', data_notif_cnpd:'20/03/2026',
    medidas:'Isolamento do sistema afetado. Auditoria de acessos em curso.',
    observacoes:'Incidente detetado por alerta de segurança. Em avaliação urgente.',
  },
]

const RISCO_COLORS: Record<Incidente['risco'], string> = {
  'Baixo':        'bg-green-100 text-green-700',
  'Médio':        'bg-amber-100 text-amber-700',
  'Elevado':      'bg-orange-100 text-orange-700',
  'Muito Elevado':'bg-red-100 text-red-700',
}

const ESTADO_COLORS: Record<Incidente['estado'], string> = {
  'Aberto':          'bg-red-100 text-red-700',
  'Em Curso':        'bg-amber-100 text-amber-700',
  'Notificado CNPD': 'bg-blue-100 text-blue-700',
  'Fechado':         'bg-gray-100 text-gray-500',
}

const CNPD_COLORS: Record<Incidente['notificacao_cnpd'], string> = {
  'Notificado':   'bg-green-100 text-green-700',
  'Pendente':     'bg-amber-100 text-amber-700',
  'Não aplicável':'bg-gray-100 text-gray-500',
}

// ── Incidentes sub-component ──────────────────────────────────────────────────
function IncidentesTab() {
  const [subTab, setSubTab] = useState(0)
  const [incidentes, setIncidentes] = useState<Incidente[]>([])
  const [modal, setModal] = useState(false)
  useEffect(() => { sbLoad<Incidente>('rgpd_incidentes', 'rgpd_incidentes', SEED_INCIDENTES).then(setIncidentes) }, [])
  const [avalRef, setAvalRef] = useState('')
  const [respostas, setRespostas] = useState<(boolean | null)[]>(Array(10).fill(null))
  const [obs, setObs] = useState<string[]>(Array(10).fill(''))

  const emAberto  = incidentes.filter(i => i.estado === 'Aberto' || i.estado === 'Em Curso').length
  const riscoAlto = incidentes.filter(i => i.risco === 'Elevado' || i.risco === 'Muito Elevado').length
  const notifCNPD = incidentes.filter(i => i.notificacao_cnpd === 'Notificado').length

  const estadoStats = ['Aberto','Em Curso','Notificado CNPD','Fechado'].map(e => ({
    estado: e, n: incidentes.filter(i => i.estado === e).length,
    pct: incidentes.length ? Math.round(incidentes.filter(i => i.estado === e).length / incidentes.length * 100) : 0
  }))
  const riscoStats = ['Baixo','Médio','Elevado','Muito Elevado'].map(r => ({
    risco: r, n: incidentes.filter(i => i.risco === r).length,
    pct: incidentes.length ? Math.round(incidentes.filter(i => i.risco === r).length / incidentes.length * 100) : 0
  }))

  const simCount  = respostas.filter(r => r === true).length
  const riscoCalc = calcRisco(respostas.map(r => r === true))

  const emptyForm: Omit<Incidente,'id'> = {
    data_detecao:'', data_ocorrencia:'', data_registo:'', responsavel:'', tipo:'Confidencialidade',
    causa:'', descricao:'', n_titulares:'', categorias_dados:'', risco:'Baixo',
    estado:'Aberto', notificacao_cnpd:'Pendente', data_notif_cnpd:'', medidas:'', observacoes:'',
  }
  const [form, setForm] = useState<Omit<Incidente,'id'>>(emptyForm)

  function addIncidente() {
    const year = new Date().getFullYear()
    const seq  = String(incidentes.length + 1).padStart(4, '0')
    const novo: Incidente = { ...form, id: `INC-${year}-${seq}` }
    const next = [...incidentes, novo]
    setIncidentes(next)
    sbSave<Incidente>('rgpd_incidentes', 'rgpd_incidentes', novo)
    setForm(emptyForm)
    setModal(false)
  }

  function deleteIncidente(id: string) {
    if (!confirm(`Eliminar incidente "${id}"?`)) return
    const next = incidentes.filter(x => x.id !== id)
    setIncidentes(next)
    sbDelete('rgpd_incidentes', 'rgpd_incidentes', id)
  }

  const SUB = ['Sumário','Registo de Incidentes','Avaliação de Risco','Avaliação Inicial']

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {SUB.map((s, i) => (
          <button key={s} onClick={() => setSubTab(i)}
            className={clsx('text-[12px] font-medium px-4 py-1.5 rounded-lg transition-colors',
              subTab === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Sumário ── */}
      {subTab === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total de Incidentes"          value={incidentes.length} sub="registados"          color="blue" />
            <KpiCard label="Em Aberto / Em Curso"         value={emAberto}          sub="por resolver"        color="amber" />
            <KpiCard label="Risco Elevado / Muito Elevado" value={riscoAlto}        sub="incidentes"          color="red" trend="neutral" />
            <KpiCard label="Notificados à CNPD"           value={notifCNPD}         sub="notificações 72h"    color="blue" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Estado */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Por Estado</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2.5 text-left font-medium">Estado</th>
                    <th className="px-5 py-2.5 text-center font-medium">N.º Incidentes</th>
                    <th className="px-5 py-2.5 text-center font-medium">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoStats.map(s => (
                    <tr key={s.estado} className="border-b border-gray-50">
                      <td className="px-5 py-2.5">
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', ESTADO_COLORS[s.estado as Incidente['estado']])}>{s.estado}</span>
                      </td>
                      <td className="px-5 py-2.5 text-center font-semibold text-gray-900">{s.n}</td>
                      <td className="px-5 py-2.5 text-center text-gray-500">{s.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold text-[12px]">
                    <td className="px-5 py-2.5 text-gray-900">TOTAL</td>
                    <td className="px-5 py-2.5 text-center text-gray-900">{incidentes.length}</td>
                    <td className="px-5 py-2.5 text-center text-gray-900">100,0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Risco */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Por Nível de Risco</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2.5 text-left font-medium">Nível de Risco</th>
                    <th className="px-5 py-2.5 text-center font-medium">N.º</th>
                    <th className="px-5 py-2.5 text-center font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {riscoStats.map(s => (
                    <tr key={s.risco} className="border-b border-gray-50">
                      <td className="px-5 py-2.5">
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', RISCO_COLORS[s.risco as Incidente['risco']])}>{s.risco}</span>
                      </td>
                      <td className="px-5 py-2.5 text-center font-semibold text-gray-900">{s.n}</td>
                      <td className="px-5 py-2.5 text-center text-gray-500">{s.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold text-[12px]">
                    <td className="px-5 py-2.5 text-gray-900">TOTAL</td>
                    <td className="px-5 py-2.5 text-center text-gray-900">{incidentes.length}</td>
                    <td className="px-5 py-2.5 text-center text-gray-900">100,0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 text-[12px] text-blue-700">
            Registo interno de conformidade com o RGPD · Artigo 33.º, n.º 5 — Atualizado automaticamente com base nos incidentes registados.
          </div>
        </div>
      )}

      {/* ── Registo ── */}
      {subTab === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-900">Livro de Incidentes — Violações de Dados Pessoais</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Art.º 33.º, n.º 5 RGPD · Conservação mínima 3 anos</p>
            </div>
            <button onClick={() => setModal(true)} className="btn btn-primary btn-sm"><Plus size={12} /> Novo Incidente</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Deteção</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Ocorrência</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Responsável</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Causa</th>
                  <th className="px-3 py-3 text-left font-medium">Descrição</th>
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">N.º Tit.</th>
                  <th className="px-3 py-3 text-left font-medium">Categorias</th>
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">Risco</th>
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">Estado</th>
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">Notif. CNPD</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Data Notif.</th>
                  <th className="px-3 py-3 text-left font-medium">Medidas Adotadas</th>
                  <th className="px-3 py-3 text-left font-medium">Observações</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Registo</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {incidentes.map(inc => (
                  <tr key={inc.id} className="border-b border-gray-50 hover:bg-gray-50 text-[11px]">
                    <td className="px-3 py-2.5 whitespace-nowrap">{inc.data_detecao}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">{inc.data_ocorrencia || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium">{inc.responsavel}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{inc.tipo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{inc.causa}</td>
                    <td className="px-3 py-2.5 max-w-[180px]"><div className="truncate" title={inc.descricao}>{inc.descricao}</div></td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{inc.n_titulares}</td>
                    <td className="px-3 py-2.5 max-w-[140px] text-gray-500"><div className="truncate" title={inc.categorias_dados}>{inc.categorias_dados}</div></td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', RISCO_COLORS[inc.risco])}>{inc.risco}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', ESTADO_COLORS[inc.estado])}>{inc.estado}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', CNPD_COLORS[inc.notificacao_cnpd])}>{inc.notificacao_cnpd}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{inc.data_notif_cnpd || '—'}</td>
                    <td className="px-3 py-2.5 max-w-[160px] text-gray-500"><div className="truncate" title={inc.medidas}>{inc.medidas}</div></td>
                    <td className="px-3 py-2.5 max-w-[160px] text-gray-500"><div className="truncate" title={inc.observacoes}>{inc.observacoes}</div></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">{inc.data_registo}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => deleteIncidente(inc.id)}
                        className="text-[11px] text-red-500 hover:text-red-700 whitespace-nowrap">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Avaliação de Risco ── */}
      {subTab === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Avaliação Preliminar de Risco — Por Incidente</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Preencha um formulário por incidente para calcular automaticamente o nível de risco</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Referência do Incidente</label>
                <input className="form-input w-64" placeholder="INC-2025-0001"
                  value={avalRef} onChange={e => setAvalRef(e.target.value)} />
              </div>

              <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium">Critério de Avaliação de Risco</th>
                    <th className="px-4 py-3 text-center font-medium w-16">Sim</th>
                    <th className="px-4 py-3 text-center font-medium w-16">Não</th>
                    <th className="px-4 py-3 text-left font-medium">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIOS_RISCO.map((c, i) => (
                    <tr key={i} className={clsx('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <td className="px-4 py-3 text-[12px] text-gray-700">{c}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setRespostas(r => r.map((v,j) => j===i ? true : v))}
                          className={clsx('w-5 h-5 rounded border-2 transition-colors flex items-center justify-center mx-auto',
                            respostas[i] === true ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400')}>
                          {respostas[i] === true && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setRespostas(r => r.map((v,j) => j===i ? false : v))}
                          className={clsx('w-5 h-5 rounded border-2 transition-colors flex items-center justify-center mx-auto',
                            respostas[i] === false ? 'bg-red-400 border-red-400' : 'border-gray-300 hover:border-red-300')}>
                          {respostas[i] === false && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <input className="form-input py-1 text-[11px]" placeholder="Observações..."
                          value={obs[i]} onChange={e => setObs(o => o.map((v,j) => j===i ? e.target.value : v))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Result */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4">
                  <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-1">Total de respostas «Sim»</div>
                  <div className="text-3xl font-bold text-gray-900">{simCount}</div>
                  <div className="text-[11px] text-gray-400 mt-1">de {CRITERIOS_RISCO.length} critérios</div>
                </div>
                <div className={clsx('rounded-xl border px-5 py-4', {
                  'bg-green-50 border-green-100': riscoCalc === 'Baixo',
                  'bg-amber-50 border-amber-100': riscoCalc === 'Médio',
                  'bg-orange-50 border-orange-100': riscoCalc === 'Elevado',
                  'bg-red-50 border-red-100': riscoCalc === 'Muito Elevado',
                })}>
                  <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-1">Classificação de Risco Calculada</div>
                  <div className={clsx('text-2xl font-bold', {
                    'text-green-700': riscoCalc === 'Baixo',
                    'text-amber-700': riscoCalc === 'Médio',
                    'text-orange-700': riscoCalc === 'Elevado',
                    'text-red-700': riscoCalc === 'Muito Elevado',
                  })}>{riscoCalc}</div>
                  {(riscoCalc === 'Médio' || riscoCalc === 'Elevado' || riscoCalc === 'Muito Elevado') && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[11px] text-amber-700 font-medium">Notificação à CNPD obrigatória em 72h (Art.º 33.º)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-[11px] text-blue-700">
                <strong>Nota:</strong> A notificação à CNPD é obrigatória quando o risco for «Médio» ou superior (Art.º 33.º, n.º 1 RGPD). Prazo: <strong>72 horas</strong> após tomada de conhecimento. Comunicação aos titulares obrigatória para risco «Elevado» ou «Muito Elevado» (Art.º 34.º, n.º 1 RGPD).
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setRespostas(Array(10).fill(null)); setObs(Array(10).fill('')); setAvalRef('') }}
                  className="btn btn-outline btn-sm">Limpar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Avaliação Inicial ── */}
      {subTab === 3 && <AvaliacaoInicialTab />}

      {/* Modal novo incidente */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[700px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="text-[14px] font-semibold mb-4">Novo Incidente — Violação de Dados Pessoais</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="form-label">Data de Deteção</label><input type="text" placeholder="DD/MM/AAAA" className="form-input" value={form.data_detecao} onChange={e => setForm({...form, data_detecao: e.target.value})} /></div>
              <div><label className="form-label">Data de Ocorrência</label><input type="text" placeholder="DD/MM/AAAA" className="form-input" value={form.data_ocorrencia} onChange={e => setForm({...form, data_ocorrencia: e.target.value})} /></div>
              <div><label className="form-label">Data de Registo</label><input type="text" placeholder="DD/MM/AAAA" className="form-input" value={form.data_registo} onChange={e => setForm({...form, data_registo: e.target.value})} /></div>
              <div><label className="form-label">Responsável pela Deteção</label><input className="form-input" placeholder="Nome / Departamento" value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} /></div>
              <div><label className="form-label">Tipo de Violação</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value as Incidente['tipo']})}>
                  <option>Confidencialidade</option><option>Integridade</option><option>Disponibilidade</option>
                </select>
              </div>
              <div><label className="form-label">Causa Provável</label><input className="form-input" placeholder="Ex: Erro humano, Ataque externo..." value={form.causa} onChange={e => setForm({...form, causa: e.target.value})} /></div>
              <div><label className="form-label">N.º de Titulares Afetados</label><input className="form-input" placeholder="Ex: 30 ou Desconhecido" value={form.n_titulares} onChange={e => setForm({...form, n_titulares: e.target.value})} /></div>
              <div><label className="form-label">Categorias de Dados</label><input className="form-input" placeholder="Ex: Nome, NIF, Dados financeiros" value={form.categorias_dados} onChange={e => setForm({...form, categorias_dados: e.target.value})} /></div>
              <div><label className="form-label">Nível de Risco</label>
                <select className="form-input" value={form.risco} onChange={e => setForm({...form, risco: e.target.value as Incidente['risco']})}>
                  <option>Baixo</option><option>Médio</option><option>Elevado</option><option>Muito Elevado</option>
                </select>
              </div>
              <div><label className="form-label">Estado</label>
                <select className="form-input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value as Incidente['estado']})}>
                  <option>Aberto</option><option>Em Curso</option><option>Notificado CNPD</option><option>Fechado</option>
                </select>
              </div>
              <div><label className="form-label">Notificação CNPD</label>
                <select className="form-input" value={form.notificacao_cnpd} onChange={e => setForm({...form, notificacao_cnpd: e.target.value as Incidente['notificacao_cnpd']})}>
                  <option>Pendente</option><option>Notificado</option><option>Não aplicável</option>
                </select>
              </div>
              <div><label className="form-label">Data de Notificação CNPD</label><input type="text" placeholder="DD/MM/AAAA" className="form-input" value={form.data_notif_cnpd} onChange={e => setForm({...form, data_notif_cnpd: e.target.value})} /></div>
              <div className="col-span-2"><label className="form-label">Descrição do Incidente</label><textarea className="form-input" rows={2} placeholder="Descreva o incidente com detalhe" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} /></div>
              <div className="col-span-2"><label className="form-label">Medidas Adotadas</label><textarea className="form-input" rows={2} placeholder="Ações tomadas imediatamente após deteção" value={form.medidas} onChange={e => setForm({...form, medidas: e.target.value})} /></div>
              <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={addIncidente} disabled={!form.data_detecao || !form.descricao} className="btn btn-primary btn-sm">Registar Incidente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function RGPD() {
  const { checklist, toggleChecklistItem, matrizTratamento, addMatriz, deleteMatriz, dpias, addDPIA, deleteDPIA } = useStore()
  const { exportToExcel } = useExport()
  const [tab, setTab]     = useState(0)
  const [clFilter, setClFilter] = useState('')
  const [selectedT, setSelectedT] = useState<MatrizTratamento | null>(null)
  const [matrizModal, setMatrizModal] = useState(false)
  const [mForm, setMForm] = useState<Omit<MatrizTratamento, 'id'>>({ nome:'', dept:'Compliance', descricao:'', base_legal:'', prazo:'', dados_sensiveis:'Não', pia:'Não', partilha:'Interno', risco:'Baixo' })

  // DPIAFull — Supabase
  const [dpiaFullList, setDpiaFullList] = useState<DPIAFull[]>([])
  const [editingDpia, setEditingDpia]   = useState<DPIAFull | null>(null)
  useEffect(() => { sbLoad<DPIAFull>('rgpd_dpias_full', DPIA_FULL_KEY, []).then(setDpiaFullList) }, [])

  // Plano de Implementação — DB
  const [planoData, setPlanoData] = useState<PlanoItem[]>([])
  const [planoModal, setPlanoModal] = useState(false)
  const emptyPlano: Omit<PlanoItem, 'id'> = { fase: 'Governance', tarefa: '', resp: '', prazo: '', estado: 'Pendente' }
  const [planoForm, setPlanoForm] = useState<Omit<PlanoItem, 'id'>>(emptyPlano)
  const [editingPlano, setEditingPlano] = useState<PlanoItem | null>(null)
  useEffect(() => {
    const SEED_PLANO: PlanoItem[] = [
      { id:'PL-001', fase:'Governance',    tarefa:'Designar DPO e comunicar à CNPD',                resp:'CA',         prazo:'30 dias',  estado:'Confirmado' },
      { id:'PL-002', fase:'Governance',    tarefa:'Criar política interna de proteção de dados',     resp:'Compliance', prazo:'45 dias',  estado:'Confirmado' },
      { id:'PL-003', fase:'Mapeamento',    tarefa:'Inventário de dados pessoais',                    resp:'Compliance', prazo:'120 dias', estado:'Pendente' },
      { id:'PL-004', fase:'Mapeamento',    tarefa:'Classificação e minimização de dados',            resp:'Compliance', prazo:'120 dias', estado:'Pendente' },
      { id:'PL-005', fase:'Implementação', tarefa:'Atualização de políticas e contratos',            resp:'Compliance', prazo:'180 dias', estado:'Pendente' },
      { id:'PL-006', fase:'Implementação', tarefa:'Gestão de consentimento e direitos dos titulares',resp:'Compliance', prazo:'120 dias', estado:'Pendente' },
      { id:'PL-007', fase:'Avaliação',     tarefa:'DPIA para tratamentos de alto risco',             resp:'DPO',        prazo:'180 dias', estado:'Pendente' },
    ]
    sbLoad<PlanoItem>('rgpd_plano', 'rgpd_plano', SEED_PLANO).then(setPlanoData)
  }, [])

  function savePlanoItem(item: PlanoItem) {
    const next = planoData.some(x => x.id === item.id)
      ? planoData.map(x => x.id === item.id ? item : x)
      : [...planoData, item]
    setPlanoData(next)
    sbSave<PlanoItem>('rgpd_plano', 'rgpd_plano', item)
  }
  function deletePlanoItem(id: string) {
    if (!confirm('Eliminar este item do plano?')) return
    setPlanoData(planoData.filter(x => x.id !== id))
    sbDelete('rgpd_plano', 'rgpd_plano', id)
  }
  function openNewPlano() { setEditingPlano(null); setPlanoForm(emptyPlano); setPlanoModal(true) }
  function openEditPlano(item: PlanoItem) { setEditingPlano(item); setPlanoForm({ fase: item.fase, tarefa: item.tarefa, resp: item.resp, prazo: item.prazo, estado: item.estado }); setPlanoModal(true) }
  function confirmPlano() {
    const id = editingPlano?.id ?? `PL-${String(planoData.length + 1).padStart(3, '0')}`
    savePlanoItem({ ...planoForm, id })
    setPlanoModal(false)
  }

  // Retenção e Eliminação — DB
  const [retencaoData, setRetencaoData] = useState<RetencaoItem[]>([])
  const [retencaoModal, setRetencaoModal] = useState(false)
  const emptyRetencao: Omit<RetencaoItem, 'id'> = { tratamento: '', departamento: '', tipo_dados: '', prazo_retencao: '', base_legal: '', metodo_eliminacao: '' }
  const [retencaoForm, setRetencaoForm] = useState<Omit<RetencaoItem, 'id'>>(emptyRetencao)
  const [editingRetencao, setEditingRetencao] = useState<RetencaoItem | null>(null)
  useEffect(() => {
    const SEED_RETENCAO: RetencaoItem[] = [
      { id:'RET-001', tratamento:'KYC / KYB',               departamento:'Compliance', tipo_dados:'Identificação, documentos',  prazo_retencao:'10 anos após término', base_legal:'Lei 83/2017',             metodo_eliminacao:'Eliminação segura' },
      { id:'RET-002', tratamento:'Exercício de direitos',    departamento:'Compliance', tipo_dados:'Pedidos e respostas',         prazo_retencao:'10 anos',              base_legal:'Art. 6.º(1)(c) RGPD',     metodo_eliminacao:'Eliminação de BD' },
      { id:'RET-003', tratamento:'Canal de denúncias',       departamento:'Compliance', tipo_dados:'Dados do denunciante',        prazo_retencao:'5 anos',               base_legal:'Obrigação legal',         metodo_eliminacao:'Anonimização + eliminação' },
      { id:'RET-004', tratamento:'Formação',                 departamento:'RH/Compliance', tipo_dados:'Presenças, conteúdos',    prazo_retencao:'5 anos',               base_legal:'Interesse legítimo',      metodo_eliminacao:'Eliminação de ficheiros' },
      { id:'RET-005', tratamento:'Screening PEPs',           departamento:'Compliance', tipo_dados:'Dados de identificação',     prazo_retencao:'10 anos',              base_legal:'Obrigação legal',         metodo_eliminacao:'Eliminação segura' },
    ]
    sbLoad<RetencaoItem>('rgpd_retencao', 'rgpd_retencao', SEED_RETENCAO).then(setRetencaoData)
  }, [])

  function saveRetencaoItem(item: RetencaoItem) {
    const next = retencaoData.some(x => x.id === item.id)
      ? retencaoData.map(x => x.id === item.id ? item : x)
      : [...retencaoData, item]
    setRetencaoData(next)
    sbSave<RetencaoItem>('rgpd_retencao', 'rgpd_retencao', item)
  }
  function deleteRetencaoItem(id: string) {
    if (!confirm('Eliminar este registo?')) return
    setRetencaoData(retencaoData.filter(x => x.id !== id))
    sbDelete('rgpd_retencao', 'rgpd_retencao', id)
  }
  function openNewRetencao() { setEditingRetencao(null); setRetencaoForm(emptyRetencao); setRetencaoModal(true) }
  function openEditRetencao(item: RetencaoItem) { setEditingRetencao(item); setRetencaoForm({ tratamento: item.tratamento, departamento: item.departamento, tipo_dados: item.tipo_dados, prazo_retencao: item.prazo_retencao, base_legal: item.base_legal, metodo_eliminacao: item.metodo_eliminacao }); setRetencaoModal(true) }
  function confirmRetencao() {
    const id = editingRetencao?.id ?? `RET-${String(retencaoData.length + 1).padStart(3, '0')}`
    saveRetencaoItem({ ...retencaoForm, id })
    setRetencaoModal(false)
  }

  function saveDpia(d: DPIAFull) {
    const next = dpiaFullList.some(x => x.id === d.id)
      ? dpiaFullList.map(x => x.id === d.id ? d : x)
      : [...dpiaFullList, d]
    setDpiaFullList(next)
    sbSaveAll('rgpd_dpias_full', DPIA_FULL_KEY, next)
    setEditingDpia(null)
  }
  function deleteDpiaFull(id: string) {
    if (!confirm('Eliminar esta DPIA?')) return
    const next = dpiaFullList.filter(x => x.id !== id)
    setDpiaFullList(next)
    sbSaveAll('rgpd_dpias_full', DPIA_FULL_KEY, next)
  }

  const done  = checklist.filter((i) => i.done).length
  const total = checklist.length
  const sections = [...new Set(checklist.map((i) => i.secao))]
  const filtered = clFilter ? checklist.filter((i) => i.secao === clFilter) : checklist

  const nAlto  = matrizTratamento.filter((t) => t.risco === 'Alto').length
  const nPIA   = matrizTratamento.filter((t) => t.pia === 'Sim').length
  const nSens  = matrizTratamento.filter((t) => t.dados_sensiveis === 'Sim').length

  const TABS = ['Checklist RGPD','Plano de Implementação','Matriz de Tratamento','Retenção e Eliminação','DPIA','Incidentes']

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Checklist RGPD"     value={`${done}/${total}`} sub={`${Math.round(done/total*100)||0}% concluído`} color="blue" />
        <KpiCard label="Tratamentos"        value={matrizTratamento.length} sub="registados"       color="blue"  />
        <KpiCard label="DPIAs Necessárias"  value={nPIA}  sub="identificadas"    color="amber" />
        <KpiCard label="Dados Sensíveis"    value={nSens} sub="tratamentos"      color="red" trend="neutral" />
      </div>

      <div className="tab-list">
        {TABS.map((t, i) => (
          <button key={t} data-state={tab === i ? 'active' : ''} className="tab-trigger" onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── Checklist ── */}
      {tab === 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Checklist RGPD — {total} itens · {done} concluídos</span>
            <div className="flex items-center gap-2">
              <select className="form-input w-44 py-1" value={clFilter} onChange={(e) => setClFilter(e.target.value)}>
                <option value="">Todas as secções</option>
                {sections.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => exportToExcel(checklist.map((i) => ({ Secção: i.secao, Item: i.item, Prioridade: i.prioridade, Responsável: i.responsavel, Frequência: i.frequencia, Ref: i.referencia, Concluído: i.done ? 'Sim' : 'Não' })), 'checklist-rgpd')} className="btn btn-outline btn-sm">
                <Download size={12} /> Export
              </button>
            </div>
          </div>
          {sections.filter((s) => !clFilter || s === clFilter).map((sec) => (
            <div key={sec}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 border-b border-gray-200">{sec}</div>
              {filtered.filter((i) => i.secao === sec).map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${item.done ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    {item.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-medium ${item.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.item}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{item.evidencias}</div>
                    <div className="text-[10px] text-gray-300 mt-0.5">{item.responsavel} · {item.frequencia} · {item.referencia}</div>
                  </div>
                  <Badge variant={prioVariant(item.prioridade)}>{item.prioridade}</Badge>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Plano ── */}
      {tab === 1 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Plano de Implementação RGPD</span>
            <button onClick={openNewPlano} className="btn btn-primary btn-sm"><Plus size={12} /> Novo Item</button>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Fase</th><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Estado</th><th>Atualizar</th><th></th></tr></thead>
            <tbody>
              {planoData.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-6">Sem registos. Clique em «Novo Item» para adicionar.</td></tr>
              ) : planoData.map((t) => (
                <tr key={t.id}>
                  <td><Badge variant={t.fase === 'Governance' ? 'blue' : t.fase === 'Mapeamento' ? 'green' : t.fase === 'Avaliação' ? 'red' : 'amber'}>{t.fase}</Badge></td>
                  <td className="font-medium">{t.tarefa}</td>
                  <td>{t.resp}</td>
                  <td>{t.prazo}</td>
                  <td><Badge variant={estadoVariant(t.estado)}>{t.estado}</Badge></td>
                  <td>
                    <select className="form-input w-32 py-1 text-[11px]" value={t.estado}
                      onChange={(e) => savePlanoItem({ ...t, estado: e.target.value })}>
                      <option>Pendente</option><option>Em curso</option><option>Confirmado</option><option>Concluído</option>
                    </select>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openEditPlano(t)} className="text-[11px] text-blue-500 hover:text-blue-700">Editar</button>
                      <button onClick={() => deletePlanoItem(t.id)} className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Matriz ── */}
      {tab === 2 && (
        <div className="space-y-3">
          {/* Charts */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: 'Risco por nível', data: [{name:'Alto',value:nAlto,color:'#dc2626'},{name:'Médio',value:matrizTratamento.filter(t=>t.risco==='Médio').length,color:'#d97706'},{name:'Baixo',value:matrizTratamento.filter(t=>t.risco==='Baixo').length,color:'#16a34a'}] },
              { title: 'PIA necessária',  data: [{name:'Necessária',value:nPIA,color:'#d97706'},{name:'Não necessária',value:matrizTratamento.length-nPIA,color:'#e5e7eb'}] },
              { title: 'Dados sensíveis', data: [{name:'Sensíveis',value:nSens,color:'#dc2626'},{name:'Não sensíveis',value:matrizTratamento.length-nSens,color:'#e5e7eb'}] },
            ].map((chart) => (
              <div key={chart.title} className="card p-4">
                <div className="card-title mb-2">{chart.title}</div>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={chart.data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2}>
                      {chart.data.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-1">
                  {chart.data.filter(d=>d.value>0).map((d) => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <div className="w-2 h-2 rounded-sm" style={{background:d.color}} /> {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedT && (
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[13px] font-semibold">{selectedT.nome}</div>
                  <div className="text-[11px] text-gray-400">{selectedT.id} · {selectedT.dept}</div>
                </div>
                <button onClick={() => setSelectedT(null)} className="btn btn-outline btn-sm">Fechar</button>
              </div>
              <div className="grid grid-cols-4 gap-3 text-[12px]">
                {[['Descrição',selectedT.descricao],['Base Legal',selectedT.base_legal],['Prazo',selectedT.prazo],['Partilha',selectedT.partilha]].map(([l,v])=>(
                  <div key={l}><div className="text-[10px] text-gray-400 font-medium uppercase mb-1">{l}</div>{v}</div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant={estadoVariant(selectedT.dados_sensiveis)}>Dados sensíveis: {selectedT.dados_sensiveis}</Badge>
                <Badge variant={estadoVariant(selectedT.pia)}>PIA: {selectedT.pia}</Badge>
                <Badge variant={estadoVariant(selectedT.risco)}>Risco: {selectedT.risco}</Badge>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Matriz de Tratamento de Dados Pessoais</span>
              <button onClick={() => setMatrizModal(true)} className="btn btn-primary btn-sm"><Plus size={12} /> Novo Tratamento</button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Nº</th><th>Nome do Tratamento</th><th>Departamento</th><th>Base Legal</th><th>Dados Sensíveis</th><th>PIA?</th><th>Risco</th><th>DPIA</th><th></th></tr></thead>
                <tbody>
                  {matrizTratamento.map((t) => {
                    const linkedDpias = dpiaFullList.filter(d => d.matrizIds.includes(t.id))
                    return (
                    <tr key={t.id} onClick={() => setSelectedT(t)} className={`clickable ${selectedT?.id === t.id ? 'bg-blue-50' : ''}`}>
                      <td className="text-gray-400 font-mono text-[11px]">{t.id}</td>
                      <td className="font-medium">{t.nome}</td>
                      <td className="text-gray-500">{t.dept}</td>
                      <td className="text-[11px]">{t.base_legal}</td>
                      <td><Badge variant={t.dados_sensiveis === 'Sim' ? 'red' : 'gray'}>{t.dados_sensiveis}</Badge></td>
                      <td><Badge variant={t.pia === 'Sim' ? 'amber' : 'gray'}>{t.pia}</Badge></td>
                      <td><Badge variant={estadoVariant(t.risco)}>{t.risco}</Badge></td>
                      <td>
                        {linkedDpias.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Link2 size={10} className="text-blue-500" />
                            {linkedDpias.map(d => (
                              <button key={d.id} onClick={e => { e.stopPropagation(); setEditingDpia(d) }}
                                className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100 truncate max-w-[100px]" title={d.meta_projeto}>
                                {d.meta_projeto || 'DPIA'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          t.pia === 'Sim'
                            ? <button onClick={e => { e.stopPropagation(); const nd = emptyDPIA(); nd.matrizIds = [t.id]; nd.s2_denominacao = t.nome; setEditingDpia(nd) }}
                                className="text-[9px] text-amber-600 hover:text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded bg-amber-50">+ Nova DPIA</button>
                            : <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { if (confirm(`Eliminar tratamento "${t.nome}"?`)) { if (selectedT?.id === t.id) setSelectedT(null); deleteMatriz(t.id) } }}
                          className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Retenção ── */}
      {tab === 3 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Política de Retenção e Eliminação</span>
            <button onClick={openNewRetencao} className="btn btn-primary btn-sm"><Plus size={12} /> Adicionar</button>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Tratamento</th><th>Departamento</th><th>Tipo de Dados</th><th>Prazo de Retenção</th><th>Base Legal</th><th>Método de Eliminação</th><th></th></tr></thead>
            <tbody>
              {retencaoData.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-6">Sem registos. Clique em «Adicionar» para criar.</td></tr>
              ) : retencaoData.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.tratamento}</td>
                  <td>{r.departamento}</td>
                  <td className="text-gray-400 text-[11px]">{r.tipo_dados}</td>
                  <td className="font-medium text-amber-600">{r.prazo_retencao}</td>
                  <td className="text-[11px]">{r.base_legal}</td>
                  <td className="text-gray-400 text-[11px]">{r.metodo_eliminacao}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openEditRetencao(r)} className="text-[11px] text-blue-500 hover:text-blue-700">Editar</button>
                      <button onClick={() => deleteRetencaoItem(r.id)} className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DPIA ── */}
      {tab === 4 && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Avaliações de Impacto sobre a Proteção de Dados (DPIA · Art.º 35.º RGPD)</span>
              <button onClick={() => setEditingDpia(emptyDPIA())} className="btn btn-primary btn-sm"><Plus size={12} /> Nova DPIA</button>
            </div>
            <table className="data-table w-full">
              <thead><tr><th>Projeto / Tratamento</th><th>Estado</th><th>DPO</th><th>Risco Antes</th><th>Risco Residual</th><th>CNPD</th><th>Tratamentos Ligados</th><th></th></tr></thead>
              <tbody>
                {dpiaFullList.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">Nenhuma DPIA registada. Clique em "Nova DPIA" para criar.</td></tr>
                ) : dpiaFullList.map(d => {
                  const linkedTrats = matrizTratamento.filter(mt => d.matrizIds.includes(mt.id))
                  return (
                    <tr key={d.id} onClick={() => setEditingDpia(d)} className="cursor-pointer">
                      <td>
                        <div className="font-medium text-gray-900">{d.meta_projeto || '—'}</div>
                        <div className="text-[10px] text-gray-400">{d.meta_org}</div>
                      </td>
                      <td>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          d.meta_estado === 'Aprovado' ? 'bg-green-100 text-green-700'
                          : d.meta_estado === 'Em Revisão' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                        }`}>{d.meta_estado}</span>
                      </td>
                      <td className="text-gray-500">{d.meta_dpo || d.s2_dpo || '—'}</td>
                      <td><Badge variant={estadoVariant(d.s7_risco_antes || '—')}>{d.s7_risco_antes || '—'}</Badge></td>
                      <td><Badge variant={estadoVariant(d.s7_risco_apos || '—')}>{d.s7_risco_apos || '—'}</Badge></td>
                      <td><Badge variant={d.s6_cnpd_nec === 'Sim' ? 'red' : 'gray'}>{d.s6_cnpd_nec || 'Não'}</Badge></td>
                      <td>
                        {linkedTrats.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Link2 size={10} className="text-blue-500" />
                            {linkedTrats.slice(0, 2).map(t => (
                              <span key={t.id} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{t.nome}</span>
                            ))}
                            {linkedTrats.length > 2 && <span className="text-[9px] text-gray-400">+{linkedTrats.length - 2}</span>}
                          </div>
                        ) : <span className="text-[10px] text-gray-300">—</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => deleteDpiaFull(d.id)} className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Incidentes ── */}
      {tab === 5 && <IncidentesTab />}

      {/* Matriz modal */}
      {matrizModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-5 w-[560px] shadow-xl">
            <div className="text-[14px] font-semibold mb-4">Novo Tratamento de Dados</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2"><label className="form-label">Nome do Tratamento</label><input className="form-input" value={mForm.nome} onChange={(e) => setMForm({...mForm, nome: e.target.value})} /></div>
              <div><label className="form-label">Departamento</label><input className="form-input" value={mForm.dept} onChange={(e) => setMForm({...mForm, dept: e.target.value})} /></div>
              <div><label className="form-label">Base Legal</label><input className="form-input" value={mForm.base_legal} onChange={(e) => setMForm({...mForm, base_legal: e.target.value})} /></div>
              <div><label className="form-label">Prazo</label><input className="form-input" value={mForm.prazo} onChange={(e) => setMForm({...mForm, prazo: e.target.value})} /></div>
              <div><label className="form-label">Risco</label><select className="form-input" value={mForm.risco} onChange={(e) => setMForm({...mForm, risco: e.target.value as MatrizTratamento['risco']})}><option>Baixo</option><option>Médio</option><option>Alto</option></select></div>
              <div><label className="form-label">Dados Sensíveis</label><select className="form-input" value={mForm.dados_sensiveis} onChange={(e) => setMForm({...mForm, dados_sensiveis: e.target.value as 'Sim'|'Não'})}><option>Não</option><option>Sim</option></select></div>
              <div><label className="form-label">Carece de PIA?</label><select className="form-input" value={mForm.pia} onChange={(e) => setMForm({...mForm, pia: e.target.value as 'Sim'|'Não'})}><option>Não</option><option>Sim</option></select></div>
              <div className="col-span-2"><label className="form-label">Descrição</label><textarea className="form-input" rows={2} value={mForm.descricao} onChange={(e) => setMForm({...mForm, descricao: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button onClick={() => setMatrizModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={() => { addMatriz(mForm); setMatrizModal(false) }} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* DPIA Editor — full screen */}
      {editingDpia && (
        <DPIAEditor
          dpia={editingDpia}
          matrizTratamento={matrizTratamento}
          onSave={saveDpia}
          onClose={() => setEditingDpia(null)}
        />
      )}

      {/* Plano modal */}
      {planoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-5 w-[520px] shadow-2xl">
            <div className="text-[14px] font-semibold mb-4">{editingPlano ? 'Editar Item do Plano' : 'Novo Item do Plano'}</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fase</label>
                  <select className="form-input" value={planoForm.fase} onChange={e => setPlanoForm({...planoForm, fase: e.target.value})}>
                    <option>Governance</option><option>Mapeamento</option><option>Implementação</option><option>Avaliação</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <select className="form-input" value={planoForm.estado} onChange={e => setPlanoForm({...planoForm, estado: e.target.value})}>
                    <option>Pendente</option><option>Em curso</option><option>Confirmado</option><option>Concluído</option>
                  </select>
                </div>
              </div>
              <div><label className="form-label">Tarefa</label><input className="form-input" value={planoForm.tarefa} onChange={e => setPlanoForm({...planoForm, tarefa: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Responsável</label><input className="form-input" value={planoForm.resp} onChange={e => setPlanoForm({...planoForm, resp: e.target.value})} /></div>
                <div><label className="form-label">Prazo</label><input className="form-input" placeholder="ex: 30 dias, Q2 2026" value={planoForm.prazo} onChange={e => setPlanoForm({...planoForm, prazo: e.target.value})} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
              <button onClick={() => setPlanoModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={confirmPlano} disabled={!planoForm.tarefa} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Retenção modal */}
      {retencaoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-5 w-[560px] shadow-2xl">
            <div className="text-[14px] font-semibold mb-4">{editingRetencao ? 'Editar Registo' : 'Novo Registo de Retenção'}</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="form-label">Tratamento</label><input className="form-input" value={retencaoForm.tratamento} onChange={e => setRetencaoForm({...retencaoForm, tratamento: e.target.value})} /></div>
                <div><label className="form-label">Departamento</label><input className="form-input" value={retencaoForm.departamento} onChange={e => setRetencaoForm({...retencaoForm, departamento: e.target.value})} /></div>
                <div><label className="form-label">Tipo de Dados</label><input className="form-input" value={retencaoForm.tipo_dados} onChange={e => setRetencaoForm({...retencaoForm, tipo_dados: e.target.value})} /></div>
                <div><label className="form-label">Prazo de Retenção</label><input className="form-input" placeholder="ex: 10 anos" value={retencaoForm.prazo_retencao} onChange={e => setRetencaoForm({...retencaoForm, prazo_retencao: e.target.value})} /></div>
                <div><label className="form-label">Base Legal</label><input className="form-input" placeholder="ex: Art. 6.º RGPD" value={retencaoForm.base_legal} onChange={e => setRetencaoForm({...retencaoForm, base_legal: e.target.value})} /></div>
                <div className="col-span-2"><label className="form-label">Método de Eliminação</label><input className="form-input" placeholder="ex: Eliminação segura, Anonimização" value={retencaoForm.metodo_eliminacao} onChange={e => setRetencaoForm({...retencaoForm, metodo_eliminacao: e.target.value})} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
              <button onClick={() => setRetencaoModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={confirmRetencao} disabled={!retencaoForm.tratamento} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
