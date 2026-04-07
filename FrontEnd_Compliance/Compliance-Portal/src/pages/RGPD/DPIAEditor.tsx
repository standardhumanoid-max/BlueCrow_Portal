import { useState } from 'react'
import { X, Save, Plus, Trash2, ChevronRight, Link2 } from 'lucide-react'
import type { MatrizTratamento } from '@/types'

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface RiskRow    { risco: string; descricao: string; probabilidade: string; impacto: string; nivel: string }
export interface MitigRow   { risco: string; medida: string; tipo: string; responsavel: string; prazo: string; estado: string }
export interface ResidRow   { risco: string; nivel: string; justificacao: string }
export interface CatRow     { categoria: string; volume: string; obs: string }
export interface HistRow    { versao: string; data: string; alteracoes: string; elaborado: string; aprovado: string }
export interface PrincRow   { principio: string; como: string; ok: string; obs: string }
export interface AprovRow   { funcao: string; nome: string; data: string }

export interface DPIAFull {
  id: string; created_at: string
  // Metadados
  meta_org: string; meta_projeto: string; meta_versao: string
  meta_data_elab: string; meta_data_rev: string
  meta_elaborado: string; meta_aprovado: string; meta_dpo: string
  meta_estado: 'Rascunho' | 'Em Revisão' | 'Aprovado'
  // Sec 2
  s2_denominacao: string; s2_finalidades: string; s2_base_legal: string; s2_base_legal_esp: string
  s2_controller: string; s2_subcontratantes: string; s2_dpo: string; s2_data_inicio: string; s2_retencao: string
  s2_cats: CatRow[]
  s2_tit_cats: string; s2_tit_vulner: string; s2_tit_n: string; s2_tit_geo: string
  // Sec 3
  s3_princs: PrincRow[]; s3_pseudo: string; s3_acessos: string; s3_retencao_pol: string; s3_minimizacao: string; s3_finalidades_lim: string
  // Sec 4
  s4_riscos: RiskRow[]
  // Sec 5
  s5_medidas: MitigRow[]; s5_residual: ResidRow[]
  // Sec 6
  s6_dpo_nome: string; s6_dpo_data: string; s6_dpo_parecer: string; s6_dpo_rec: string; s6_dpo_resp: string
  s6_cnpd_nec: string; s6_cnpd_just: string; s6_cnpd_data: string; s6_cnpd_ref: string; s6_cnpd_res: string
  // Sec 7
  s7_risco_antes: string; s7_risco_apos: string; s7_prosseguir: string; s7_condicoes: string; s7_data_rev: string
  s7_aprov: AprovRow[]
  // Sec 8
  s8_hist: HistRow[]
  // Link Matriz
  matrizIds: string[]
}

// ─── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_RISKS: RiskRow[] = [
  { risco: 'Acesso não autorizado',        descricao: 'Acesso indevido a dados pessoais por terceiros ou colaboradores não autorizados (violação de confidencialidade).', probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Perda ou destruição de dados', descricao: 'Perda acidental ou intencional de dados, incluindo falhas de sistema ou desastres (violação de disponibilidade).', probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Alteração não autorizada',     descricao: 'Modificação indevida de dados pessoais, comprometendo a integridade.',                                             probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Divulgação indevida',          descricao: 'Comunicação de dados a destinatários não autorizados, incluindo subcontratantes.',                                  probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Transferência ilícita',        descricao: 'Transferência de dados para países terceiros sem garantias adequadas.',                                             probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Uso excessivo / desvio de finalidade', descricao: 'Tratamento de dados além da finalidade declarada ou para fins incompatíveis.',                            probabilidade: '', impacto: '', nivel: '' },
  { risco: 'Discriminação / Decisão injusta',      descricao: 'Resultados discriminatórios decorrentes de elaboração de perfis ou decisões automatizadas.',              probabilidade: '', impacto: '', nivel: '' },
]

const DEFAULT_PRINCS: PrincRow[] = [
  { principio: 'Licitude, lealdade e transparência', como: '', ok: '', obs: '' },
  { principio: 'Limitação das finalidades',           como: '', ok: '', obs: '' },
  { principio: 'Minimização dos dados',               como: '', ok: '', obs: '' },
  { principio: 'Exatidão',                            como: '', ok: '', obs: '' },
  { principio: 'Limitação da conservação',            como: '', ok: '', obs: '' },
  { principio: 'Integridade e confidencialidade',     como: '', ok: '', obs: '' },
  { principio: 'Responsabilidade (Accountability)',   como: '', ok: '', obs: '' },
]

const DEFAULT_APROV: AprovRow[] = [
  { funcao: 'Elaborado por',                              nome: '', data: '' },
  { funcao: 'Revisto pelo DPO',                          nome: '', data: '' },
  { funcao: 'Aprovado pelo Responsável pelo Tratamento', nome: '', data: '' },
  { funcao: 'Validado pela Direção (se aplicável)',      nome: '', data: '' },
]

export function emptyDPIA(): DPIAFull {
  return {
    id: Math.random().toString(36).slice(2, 10),
    created_at: new Date().toISOString(),
    meta_org: 'BlueCrow Capital', meta_projeto: '', meta_versao: '1.0',
    meta_data_elab: new Date().toLocaleDateString('pt-PT'), meta_data_rev: '',
    meta_elaborado: '', meta_aprovado: '', meta_dpo: '',
    meta_estado: 'Rascunho',
    s2_denominacao: '', s2_finalidades: '', s2_base_legal: '', s2_base_legal_esp: '',
    s2_controller: 'BlueCrow Capital', s2_subcontratantes: '', s2_dpo: '', s2_data_inicio: '', s2_retencao: '',
    s2_cats: [{ categoria: '', volume: '', obs: '' }, { categoria: '', volume: '', obs: '' }],
    s2_tit_cats: '', s2_tit_vulner: 'Não', s2_tit_n: '', s2_tit_geo: '',
    s3_princs: DEFAULT_PRINCS.map(p => ({ ...p })),
    s3_pseudo: '', s3_acessos: '', s3_retencao_pol: '', s3_minimizacao: '', s3_finalidades_lim: '',
    s4_riscos: DEFAULT_RISKS.map(r => ({ ...r })),
    s5_medidas: [{ risco: '', medida: '', tipo: '', responsavel: '', prazo: '', estado: 'Por iniciar' }],
    s5_residual: [{ risco: '', nivel: '', justificacao: '' }],
    s6_dpo_nome: '', s6_dpo_data: '', s6_dpo_parecer: '', s6_dpo_rec: '', s6_dpo_resp: '',
    s6_cnpd_nec: 'Não', s6_cnpd_just: '', s6_cnpd_data: '', s6_cnpd_ref: '', s6_cnpd_res: '',
    s7_risco_antes: '', s7_risco_apos: '', s7_prosseguir: '', s7_condicoes: '', s7_data_rev: '',
    s7_aprov: DEFAULT_APROV.map(a => ({ ...a })),
    s8_hist: [{ versao: '1.0', data: new Date().toLocaleDateString('pt-PT'), alteracoes: 'Versão inicial', elaborado: '', aprovado: '' }],
    matrizIds: [],
  }
}

// ─── Helper components ─────────────────────────────────────────────────────────
function F({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white'
const sel = inp + ' cursor-pointer'
const ta  = (rows = 3) => inp + ` resize-none`

function calcNivel(p: string, i: string): string {
  const n = +p * +i
  if (!n) return ''
  if (n <= 2) return 'Baixo'
  if (n <= 4) return 'Médio'
  return 'Alto'
}

const nivelCls: Record<string, string> = {
  Baixo: 'bg-green-50 text-green-700 border-green-200',
  Médio: 'bg-amber-50 text-amber-700 border-amber-200',
  Alto:  'bg-red-50 text-red-700 border-red-200',
}

const SECTIONS = [
  { id: 'meta',  label: 'Metadados' },
  { id: 's1',    label: '1. Quando realizar' },
  { id: 's2',    label: '2. Identificação' },
  { id: 's3',    label: '3. Necessidade' },
  { id: 's4',    label: '4. Riscos' },
  { id: 's5',    label: '5. Mitigação' },
  { id: 's6',    label: '6. DPO / CNPD' },
  { id: 's7',    label: '7. Conclusão' },
  { id: 's8',    label: '8. Histórico' },
  { id: 's9',    label: '9. Referências' },
  { id: 'matriz',label: 'Matriz de Tratamento' },
]

const ESTADO_CLS: Record<string, string> = {
  Rascunho:     'bg-gray-100 text-gray-600',
  'Em Revisão': 'bg-amber-100 text-amber-700',
  Aprovado:     'bg-green-100 text-green-700',
}

// ─── Editor ────────────────────────────────────────────────────────────────────
interface Props {
  dpia: DPIAFull
  matrizTratamento: MatrizTratamento[]
  onSave: (d: DPIAFull) => void
  onClose: () => void
}

export function DPIAEditor({ dpia, matrizTratamento, onSave, onClose }: Props) {
  const [d, setD] = useState<DPIAFull>(dpia)
  const [section, setSection] = useState('meta')
  // Rows that existed when the editor opened are locked — immutable record keeping
  const savedHistCount = dpia.s8_hist.length
  const upd = (patch: Partial<DPIAFull>) => setD(prev => ({ ...prev, ...patch }))

  // ── Row helpers ──
  function updRisk(i: number, patch: Partial<RiskRow>) {
    const next = d.s4_riscos.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    if (patch.probabilidade !== undefined || patch.impacto !== undefined) {
      const row = next[i]
      row.nivel = calcNivel(row.probabilidade, row.impacto)
    }
    upd({ s4_riscos: next })
  }
  function updMitig(i: number, patch: Partial<MitigRow>) { upd({ s5_medidas: d.s5_medidas.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function updResid(i: number, patch: Partial<ResidRow>) { upd({ s5_residual: d.s5_residual.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function updCat(i: number, patch: Partial<CatRow>)     { upd({ s2_cats: d.s2_cats.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function updPrinc(i: number, patch: Partial<PrincRow>) { upd({ s3_princs: d.s3_princs.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function updAprov(i: number, patch: Partial<AprovRow>) { upd({ s7_aprov: d.s7_aprov.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function updHist(i: number, patch: Partial<HistRow>)   { upd({ s8_hist: d.s8_hist.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function toggleMatriz(id: string) {
    upd({ matrizIds: d.matrizIds.includes(id) ? d.matrizIds.filter(x => x !== id) : [...d.matrizIds, id] })
  }

  const secProps = { className: 'p-6 space-y-5 overflow-y-auto flex-1' }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-stretch">
      <div className="flex flex-col w-full bg-gray-50 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">AVALIAÇÃO DE IMPACTO SOBRE A PROTEÇÃO DE DADOS (DPIA) · Art.º 35.º RGPD</div>
            <div className="text-[15px] font-bold text-gray-900 truncate mt-0.5">{d.meta_projeto || 'Novo DPIA'}</div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${ESTADO_CLS[d.meta_estado]}`}>{d.meta_estado}</span>
          {d.matrizIds.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              <Link2 size={11} /> {d.matrizIds.length} tratamento{d.matrizIds.length !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => onSave(d)} className="btn btn-primary btn-sm flex items-center gap-1.5"><Save size={13} /> Guardar</button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto py-3">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full text-left px-4 py-2 text-[12px] flex items-center justify-between transition-colors ${
                  section === s.id
                    ? 'bg-blue-50 text-[#1e3a5f] font-semibold border-r-2 border-[#1e3a5f]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.label}
                {section === s.id && <ChevronRight size={12} />}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Metadados ── */}
            {section === 'meta' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">Metadados do Documento</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Organização / Responsável pelo Tratamento" span2><input className={inp} value={d.meta_org} onChange={e => upd({ meta_org: e.target.value })} /></F>
                  <F label="Nome do Projeto / Tratamento" span2><input className={inp} value={d.meta_projeto} onChange={e => upd({ meta_projeto: e.target.value })} placeholder="ex: Sistema CRM Clientes BlueCrow" /></F>
                  <F label="Versão do Documento"><input className={inp} value={d.meta_versao} onChange={e => upd({ meta_versao: e.target.value })} /></F>
                  <F label="Estado">
                    <select className={sel} value={d.meta_estado} onChange={e => upd({ meta_estado: e.target.value as DPIAFull['meta_estado'] })}>
                      <option>Rascunho</option><option>Em Revisão</option><option>Aprovado</option>
                    </select>
                  </F>
                  <F label="Data de Elaboração"><input className={inp} value={d.meta_data_elab} onChange={e => upd({ meta_data_elab: e.target.value })} /></F>
                  <F label="Data de Revisão"><input className={inp} value={d.meta_data_rev} onChange={e => upd({ meta_data_rev: e.target.value })} /></F>
                  <F label="Elaborado por"><input className={inp} value={d.meta_elaborado} onChange={e => upd({ meta_elaborado: e.target.value })} /></F>
                  <F label="Aprovado por"><input className={inp} value={d.meta_aprovado} onChange={e => upd({ meta_aprovado: e.target.value })} /></F>
                  <F label="DPO / Encarregado de Proteção de Dados" span2><input className={inp} value={d.meta_dpo} onChange={e => upd({ meta_dpo: e.target.value })} /></F>
                </div>
              </div>
            )}

            {/* ── Sec 1: Quando realizar (reference) ── */}
            {section === 's1' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">1. Quando Deve Ser Realizada uma DPIA</div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-[12px] text-blue-800">
                  <strong>Base legal:</strong> A DPIA é obrigatória ao abrigo do <strong>Artigo 35.º do RGPD</strong> sempre que um tipo de tratamento seja suscetível de implicar um <strong>elevado risco</strong> para os direitos e liberdades das pessoas singulares. A sua realização deve ocorrer <strong>ANTES</strong> do início do tratamento de dados.
                </div>
                <div className="text-[12px] font-semibold text-gray-700 mt-2">1.1 Critérios de Obrigatoriedade (DPIA obrigatória quando ≥ 2 critérios)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left w-6">#</th><th className="px-3 py-2 text-left w-48">Critério</th><th className="px-3 py-2 text-left">Descrição / Exemplos</th></tr></thead>
                    <tbody>
                      {[
                        ['1','Avaliação ou pontuação','Scoring de crédito, avaliação de desempenho, perfis de saúde, mapeamento comportamental.'],
                        ['2','Decisões automatizadas com efeitos jurídicos','Aprovação automática de crédito, triagem de candidatos, recusa automatizada de serviços.'],
                        ['3','Monitorização sistemática','CCTV, rastreamento de localização, monitorização de colaboradores, cookies de rastreio.'],
                        ['4','Dados sensíveis ou de natureza altamente pessoal','Categorias especiais (art.º 9.º): saúde, genéticos, biométricos, religiosos, políticos. Dados penais (art.º 10.º).'],
                        ['5','Dados tratados em grande escala','Volume elevado de titulares, diversidade de dados, extensão geográfica, longa duração.'],
                        ['6','Cruzamento ou combinação de conjuntos de dados','Combinação de dados de múltiplas fontes que os titulares não esperariam.'],
                        ['7','Dados de titulares vulneráveis','Crianças, idosos, doentes, trabalhadores, pessoas em risco de exclusão social.'],
                        ['8','Utilização inovadora ou novas tecnologias','IA/ML, reconhecimento facial, IoT, blockchain — cujos riscos são pouco conhecidos.'],
                        ['9','Impossibilidade de exercício de direitos','Dados biométricos para acesso; listas de exclusão; tratamentos que impedem acesso a serviços.'],
                      ].map(([n, c, d]) => (
                        <tr key={n} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-400">{n}</td>
                          <td className="px-3 py-2 font-medium text-gray-700">{c}</td>
                          <td className="px-3 py-2 text-gray-500">{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[12px] font-semibold text-gray-700 mt-2">1.2 Situações de Obrigatoriedade Expressa (CNPD / CEPD)</div>
                <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside bg-red-50 border border-red-100 rounded-lg p-4">
                  {['Tratamento de dados de saúde por prestadores de cuidados em grande escala.',
                    'Utilização de sistemas de vigilância por câmara em espaços públicos.',
                    'Elaboração de perfis de clientes para fins de crédito ou seguros.',
                    'Sistemas de inteligência artificial que tomem decisões com impacto nos titulares.',
                    'Transferências internacionais de dados para países sem decisão de adequação.',
                    'Tratamentos envolvendo dados biométricos para identificação única.',
                    'Plataformas digitais que processem dados de crianças para marketing ou análise comportamental.',
                  ].map(item => <li key={item}>{item}</li>)}
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 mt-2">
                  <strong>Boa prática:</strong> mesmo quando não obrigatória, a realização de uma DPIA é recomendada para tratamentos que envolvam dados pessoais sensíveis ou populações vulneráveis.
                </div>
              </div>
            )}

            {/* ── Sec 2: Identificação ── */}
            {section === 's2' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">2. Identificação do Tratamento</div>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">2.1 Informações Gerais</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Denominação do Tratamento" span2><input className={inp} value={d.s2_denominacao} onChange={e => upd({ s2_denominacao: e.target.value })} /></F>
                  <F label="Finalidade(s) do Tratamento" span2><textarea className={`${inp} ${ta(2)}`} rows={2} value={d.s2_finalidades} onChange={e => upd({ s2_finalidades: e.target.value })} /></F>
                  <F label="Base Jurídica (art.º 6.º RGPD)">
                    <select className={sel} value={d.s2_base_legal} onChange={e => upd({ s2_base_legal: e.target.value })}>
                      <option value="">— selecionar —</option>
                      <option>Consentimento (al. a))</option>
                      <option>Execução de contrato (al. b))</option>
                      <option>Obrigação legal (al. c))</option>
                      <option>Interesses vitais (al. d))</option>
                      <option>Interesse público (al. e))</option>
                      <option>Interesse legítimo (al. f))</option>
                    </select>
                  </F>
                  <F label="Base Jurídica p/ Categorias Especiais (art.º 9.º)"><input className={inp} value={d.s2_base_legal_esp} onChange={e => upd({ s2_base_legal_esp: e.target.value })} placeholder="Deixar em branco se não aplicável" /></F>
                  <F label="Responsável pelo Tratamento"><input className={inp} value={d.s2_controller} onChange={e => upd({ s2_controller: e.target.value })} /></F>
                  <F label="Subcontratantes Envolvidos"><input className={inp} value={d.s2_subcontratantes} onChange={e => upd({ s2_subcontratantes: e.target.value })} /></F>
                  <F label="DPO / Encarregado de Proteção de Dados"><input className={inp} value={d.s2_dpo} onChange={e => upd({ s2_dpo: e.target.value })} /></F>
                  <F label="Data de Início Prevista"><input className={inp} value={d.s2_data_inicio} onChange={e => upd({ s2_data_inicio: e.target.value })} /></F>
                  <F label="Duração / Retenção dos Dados" span2><input className={inp} value={d.s2_retencao} onChange={e => upd({ s2_retencao: e.target.value })} /></F>
                </div>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-2">2.2 Categorias de Dados Tratados</div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Categoria de Dados</th><th className="px-3 py-2 text-left w-40">Volume Est. (titulares)</th><th className="px-3 py-2 text-left">Observações</th><th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.s2_cats.map((c, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-1.5"><input className={inp} value={c.categoria} onChange={e => updCat(i, { categoria: e.target.value })} /></td>
                        <td className="px-3 py-1.5"><input className={inp} value={c.volume}    onChange={e => updCat(i, { volume:    e.target.value })} /></td>
                        <td className="px-3 py-1.5"><input className={inp} value={c.obs}       onChange={e => updCat(i, { obs:       e.target.value })} /></td>
                        <td className="px-2 py-1.5"><button onClick={() => upd({ s2_cats: d.s2_cats.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => upd({ s2_cats: [...d.s2_cats, { categoria: '', volume: '', obs: '' }] })} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"><Plus size={11} /> Adicionar categoria</button>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-2">2.3 Titulares dos Dados</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Categorias de Titulares"><input className={inp} value={d.s2_tit_cats} onChange={e => upd({ s2_tit_cats: e.target.value })} placeholder="ex: clientes, colaboradores, utentes" /></F>
                  <F label="Grupos Vulneráveis Envolvidos?">
                    <select className={sel} value={d.s2_tit_vulner} onChange={e => upd({ s2_tit_vulner: e.target.value })}>
                      <option>Não</option><option>Sim — crianças</option><option>Sim — idosos</option><option>Sim — doentes</option><option>Sim — trabalhadores</option><option>Sim — outros</option>
                    </select>
                  </F>
                  <F label="Número Estimado de Titulares"><input className={inp} value={d.s2_tit_n} onChange={e => upd({ s2_tit_n: e.target.value })} /></F>
                  <F label="Localização Geográfica dos Titulares"><input className={inp} value={d.s2_tit_geo} onChange={e => upd({ s2_tit_geo: e.target.value })} /></F>
                </div>
              </div>
            )}

            {/* ── Sec 3: Necessidade e Proporcionalidade ── */}
            {section === 's3' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">3. Necessidade e Proporcionalidade</div>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">3.1 Análise dos Princípios do RGPD (Art.º 5.º)</div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left w-48">Princípio</th><th className="px-3 py-2 text-left">Como é garantido?</th><th className="px-3 py-2 text-left w-28">Conforme?</th><th className="px-3 py-2 text-left">Observações</th>
                  </tr></thead>
                  <tbody>
                    {d.s3_princs.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-700">{p.principio}</td>
                        <td className="px-3 py-1.5"><textarea className={`${inp} ${ta()}`} rows={2} value={p.como} onChange={e => updPrinc(i, { como: e.target.value })} /></td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={p.ok} onChange={e => updPrinc(i, { ok: e.target.value })}>
                            <option value="">—</option><option>Sim</option><option>Não</option><option>Parcial</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5"><input className={inp} value={p.obs} onChange={e => updPrinc(i, { obs: e.target.value })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-2">3.2 Medidas de Minimização e Limitação</div>
                <div className="grid grid-cols-1 gap-3">
                  {([
                    ['s3_pseudo',        'Pseudonimização / Anonimização'],
                    ['s3_acessos',       'Controlo de acessos / Autorizações'],
                    ['s3_retencao_pol',  'Política de retenção e eliminação'],
                    ['s3_minimizacao',   'Minimização na recolha (privacy by design)'],
                    ['s3_finalidades_lim','Limitação de finalidades secundárias'],
                  ] as [keyof DPIAFull, string][]).map(([key, label]) => (
                    <F key={key} label={label}>
                      <textarea className={`${inp} ${ta()}`} rows={2} value={d[key] as string} onChange={e => upd({ [key]: e.target.value })} />
                    </F>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sec 4: Riscos ── */}
            {section === 's4' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">4. Identificação e Avaliação de Riscos</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-600">
                  <strong>Escala:</strong> Probabilidade: 1=Baixa · 2=Média · 3=Alta &nbsp;|&nbsp; Impacto: 1=Baixo · 2=Médio · 3=Alto &nbsp;|&nbsp; <strong>Nível</strong> = P × I → Baixo (1–2) · Médio (3–4) · Alto (6–9)
                </div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left w-44">Risco</th><th className="px-3 py-2 text-left">Descrição / Cenário</th><th className="px-3 py-2 text-left w-24">Probabilidade</th><th className="px-3 py-2 text-left w-20">Impacto</th><th className="px-3 py-2 text-left w-24">Nível</th><th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.s4_riscos.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5"><input className={inp} value={r.risco} onChange={e => updRisk(i, { risco: e.target.value })} /></td>
                        <td className="px-3 py-1.5"><textarea className={`${inp} ${ta()}`} rows={2} value={r.descricao} onChange={e => updRisk(i, { descricao: e.target.value })} /></td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={r.probabilidade} onChange={e => updRisk(i, { probabilidade: e.target.value })}>
                            <option value="">—</option><option value="1">1 — Baixa</option><option value="2">2 — Média</option><option value="3">3 — Alta</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={r.impacto} onChange={e => updRisk(i, { impacto: e.target.value })}>
                            <option value="">—</option><option value="1">1 — Baixo</option><option value="2">2 — Médio</option><option value="3">3 — Alto</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          {r.nivel ? (
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${nivelCls[r.nivel] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{r.nivel}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5"><button onClick={() => upd({ s4_riscos: d.s4_riscos.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => upd({ s4_riscos: [...d.s4_riscos, { risco: '', descricao: '', probabilidade: '', impacto: '', nivel: '' }] })} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"><Plus size={11} /> Adicionar risco</button>
              </div>
            )}

            {/* ── Sec 5: Mitigação ── */}
            {section === 's5' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">5. Medidas para Mitigar os Riscos</div>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">5.1 Plano de Medidas de Mitigação</div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left w-32">Risco Relacionado</th><th className="px-3 py-2 text-left">Medida de Mitigação</th><th className="px-3 py-2 text-left w-36">Tipo</th><th className="px-3 py-2 text-left w-28">Responsável</th><th className="px-3 py-2 text-left w-24">Prazo</th><th className="px-3 py-2 text-left w-28">Estado</th><th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.s5_medidas.map((m, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5"><input className={inp} value={m.risco} onChange={e => updMitig(i, { risco: e.target.value })} /></td>
                        <td className="px-3 py-1.5"><textarea className={`${inp} ${ta()}`} rows={2} value={m.medida} onChange={e => updMitig(i, { medida: e.target.value })} /></td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={m.tipo} onChange={e => updMitig(i, { tipo: e.target.value })}>
                            <option value="">—</option><option>Técnica</option><option>Organizacional</option><option>Técnica e Organizacional</option><option>Contratual</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5"><input className={inp} value={m.responsavel} onChange={e => updMitig(i, { responsavel: e.target.value })} /></td>
                        <td className="px-3 py-1.5"><input className={inp} value={m.prazo} onChange={e => updMitig(i, { prazo: e.target.value })} /></td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={m.estado} onChange={e => updMitig(i, { estado: e.target.value })}>
                            <option>Por iniciar</option><option>Em curso</option><option>Concluída</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><button onClick={() => upd({ s5_medidas: d.s5_medidas.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => upd({ s5_medidas: [...d.s5_medidas, { risco: '', medida: '', tipo: '', responsavel: '', prazo: '', estado: 'Por iniciar' }] })} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"><Plus size={11} /> Adicionar medida</button>

                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-4">5.2 Risco Residual Após Mitigação</div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Risco</th><th className="px-3 py-2 text-left w-32">Nível Residual</th><th className="px-3 py-2 text-left">Justificação</th><th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.s5_residual.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5"><input className={inp} value={r.risco} onChange={e => updResid(i, { risco: e.target.value })} /></td>
                        <td className="px-3 py-1.5">
                          <select className={sel} value={r.nivel} onChange={e => updResid(i, { nivel: e.target.value })}>
                            <option value="">—</option><option>Baixo</option><option>Médio</option><option>Alto</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5"><input className={inp} value={r.justificacao} onChange={e => updResid(i, { justificacao: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><button onClick={() => upd({ s5_residual: d.s5_residual.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => upd({ s5_residual: [...d.s5_residual, { risco: '', nivel: '', justificacao: '' }] })} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"><Plus size={11} /> Adicionar linha</button>
              </div>
            )}

            {/* ── Sec 6: DPO / CNPD ── */}
            {section === 's6' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">6. Consulta ao DPO e à Autoridade de Controlo</div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-800">
                  O art.º 35.º, n.º 2, do RGPD exige o <strong>parecer do DPO</strong> na realização da DPIA. Se o risco residual permanecer elevado após mitigação, é obrigatória a <strong>consulta prévia à CNPD</strong> (art.º 36.º).
                </div>
                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">6.1 Parecer do DPO</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="DPO Consultado (Nome)"><input className={inp} value={d.s6_dpo_nome} onChange={e => upd({ s6_dpo_nome: e.target.value })} /></F>
                  <F label="Data da Consulta"><input className={inp} value={d.s6_dpo_data} onChange={e => upd({ s6_dpo_data: e.target.value })} /></F>
                  <F label="Parecer do DPO">
                    <select className={sel} value={d.s6_dpo_parecer} onChange={e => upd({ s6_dpo_parecer: e.target.value })}>
                      <option value="">— selecionar —</option><option>Favorável</option><option>Favorável com reservas</option><option>Desfavorável</option>
                    </select>
                  </F>
                  <F label="Recomendações do DPO"><input className={inp} value={d.s6_dpo_rec} onChange={e => upd({ s6_dpo_rec: e.target.value })} /></F>
                  <F label="Resposta do Responsável às Recomendações" span2><textarea className={`${inp} ${ta()}`} rows={2} value={d.s6_dpo_resp} onChange={e => upd({ s6_dpo_resp: e.target.value })} /></F>
                </div>
                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-2">6.2 Consulta Prévia à CNPD (se aplicável)</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="É necessária consulta prévia?">
                    <select className={sel} value={d.s6_cnpd_nec} onChange={e => upd({ s6_cnpd_nec: e.target.value })}>
                      <option>Não</option><option>Sim</option>
                    </select>
                  </F>
                  <F label="Justificação"><input className={inp} value={d.s6_cnpd_just} onChange={e => upd({ s6_cnpd_just: e.target.value })} /></F>
                  <F label="Data de submissão à CNPD"><input className={inp} value={d.s6_cnpd_data} onChange={e => upd({ s6_cnpd_data: e.target.value })} /></F>
                  <F label="Referência / N.º de processo"><input className={inp} value={d.s6_cnpd_ref} onChange={e => upd({ s6_cnpd_ref: e.target.value })} /></F>
                  <F label="Resultado / Orientações da CNPD" span2><textarea className={`${inp} ${ta()}`} rows={2} value={d.s6_cnpd_res} onChange={e => upd({ s6_cnpd_res: e.target.value })} /></F>
                </div>
              </div>
            )}

            {/* ── Sec 7: Conclusão ── */}
            {section === 's7' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">7. Conclusão e Aprovação</div>
                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">7.1 Conclusão da DPIA</div>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Nível de Risco Global (antes de mitigação)">
                    <select className={sel} value={d.s7_risco_antes} onChange={e => upd({ s7_risco_antes: e.target.value })}>
                      <option value="">—</option><option>Baixo</option><option>Médio</option><option>Alto</option>
                    </select>
                  </F>
                  <F label="Nível de Risco Residual (após mitigação)">
                    <select className={sel} value={d.s7_risco_apos} onChange={e => upd({ s7_risco_apos: e.target.value })}>
                      <option value="">—</option><option>Baixo</option><option>Médio</option><option>Alto</option>
                    </select>
                  </F>
                  <F label="O tratamento pode prosseguir?">
                    <select className={sel} value={d.s7_prosseguir} onChange={e => upd({ s7_prosseguir: e.target.value })}>
                      <option value="">—</option><option>Sim</option><option>Sim com condições</option><option>Não</option>
                    </select>
                  </F>
                  <F label="Data prevista de revisão da DPIA"><input className={inp} value={d.s7_data_rev} onChange={e => upd({ s7_data_rev: e.target.value })} /></F>
                  <F label="Condições / Restrições para prosseguir" span2><textarea className={`${inp} ${ta()}`} rows={2} value={d.s7_condicoes} onChange={e => upd({ s7_condicoes: e.target.value })} /></F>
                </div>
                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mt-2">7.2 Declaração de Aprovação</div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left w-64">Função</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left w-28">Data</th>
                  </tr></thead>
                  <tbody>
                    {d.s7_aprov.map((a, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-600">{a.funcao}</td>
                        <td className="px-3 py-1.5"><input className={inp} value={a.nome} onChange={e => updAprov(i, { nome: e.target.value })} /></td>
                        <td className="px-3 py-1.5"><input className={inp} value={a.data} onChange={e => updAprov(i, { data: e.target.value })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Sec 8: Histórico ── */}
            {section === 's8' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">8. Histórico de Revisões</div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700 mb-3">
                  As entradas já guardadas são imutáveis. Apenas novas versões (ainda não guardadas) podem ser editadas ou eliminadas.
                </div>
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left w-16">Versão</th>
                    <th className="px-3 py-2 text-left w-28">Data</th>
                    <th className="px-3 py-2 text-left">Alterações Efetuadas</th>
                    <th className="px-3 py-2 text-left w-28">Elaborado por</th>
                    <th className="px-3 py-2 text-left w-28">Aprovado por</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.s8_hist.map((h, i) => {
                      const locked = i < savedHistCount
                      return (
                        <tr key={i} className={`border-t border-gray-100 ${locked ? 'bg-gray-50/60' : ''}`}>
                          {locked ? (
                            <>
                              <td className="px-3 py-2 font-mono text-gray-700">{h.versao}</td>
                              <td className="px-3 py-2 text-gray-500">{h.data}</td>
                              <td className="px-3 py-2 text-gray-600">{h.alteracoes}</td>
                              <td className="px-3 py-2 text-gray-500">{h.elaborado}</td>
                              <td className="px-3 py-2 text-gray-500">{h.aprovado}</td>
                              <td className="px-2 py-2 text-gray-200 text-[9px] text-center select-none" title="Entrada bloqueada">🔒</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5"><input className={inp} value={h.versao}     onChange={e => updHist(i, { versao:     e.target.value })} /></td>
                              <td className="px-3 py-1.5"><input className={inp} value={h.data}       onChange={e => updHist(i, { data:       e.target.value })} /></td>
                              <td className="px-3 py-1.5"><input className={inp} value={h.alteracoes} onChange={e => updHist(i, { alteracoes: e.target.value })} /></td>
                              <td className="px-3 py-1.5"><input className={inp} value={h.elaborado}  onChange={e => updHist(i, { elaborado:  e.target.value })} /></td>
                              <td className="px-3 py-1.5"><input className={inp} value={h.aprovado}   onChange={e => updHist(i, { aprovado:   e.target.value })} /></td>
                              <td className="px-2 py-1.5"><button onClick={() => upd({ s8_hist: d.s8_hist.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <button
                  onClick={() => upd({ s8_hist: [...d.s8_hist, { versao: '', data: new Date().toLocaleDateString('pt-PT'), alteracoes: '', elaborado: '', aprovado: '' }] })}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                >
                  <Plus size={11} /> Nova versão
                </button>
              </div>
            )}

            {/* ── Sec 9: Referências (read-only) ── */}
            {section === 's9' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">9. Referências Legais e Normativas</div>
                <ul className="space-y-2 text-[12px] text-gray-700">
                  {[
                    ['RGPD', 'Regulamento (UE) 2016/679, especialmente art.º 5.º, 6.º, 9.º, 13.º, 14.º, 25.º, 32.º, 35.º e 36.º.'],
                    ['WP248 rev.01', 'Orientações do CEPD sobre Avaliações de Impacto sobre a Proteção de Dados.'],
                    ['Lei n.º 58/2019, de 8 de agosto', 'Lei de Execução do RGPD em Portugal.'],
                    ['CNPD', 'Lista de tipos de operações de tratamento sujeitas ao requisito de DPIA.'],
                    ['ISO/IEC 29134:2017', 'Orientações para Avaliações de Impacto sobre a Privacidade.'],
                  ].map(([ref, desc]) => (
                    <li key={ref} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-semibold text-[#1e3a5f] flex-shrink-0 w-48">{ref}</span>
                      <span className="text-gray-600">{desc}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-[10px] text-gray-400 text-center">
                  Este modelo é uma minuta orientativa. Deve ser adaptado à realidade e contexto específico da organização.<br />
                  Confidencial — Uso Interno
                </div>
              </div>
            )}

            {/* ── Matriz de Tratamento ── */}
            {section === 'matriz' && (
              <div {...secProps}>
                <div className="text-[13px] font-bold text-gray-800 border-b border-gray-200 pb-2">Ligação à Matriz de Tratamento</div>
                <div className="text-[12px] text-gray-500 mb-4">
                  Selecione os tratamentos de dados da Matriz RGPD que estão cobertos por esta DPIA. Os tratamentos com "Carece de PIA: Sim" aparecem destacados.
                </div>
                {matrizTratamento.length === 0 ? (
                  <div className="text-center text-[12px] text-gray-400 py-8">Nenhum tratamento registado na Matriz de Tratamento.</div>
                ) : (
                  <div className="space-y-2">
                    {matrizTratamento.map(mt => {
                      const linked = d.matrizIds.includes(mt.id)
                      return (
                        <label
                          key={mt.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            linked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-600" checked={linked} onChange={() => toggleMatriz(mt.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold text-gray-800">{mt.nome}</span>
                              {mt.pia === 'Sim' && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">Carece de PIA</span>}
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${mt.risco === 'Alto' ? 'bg-red-100 text-red-600' : mt.risco === 'Médio' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>{mt.risco}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{mt.dept} · {mt.base_legal}</div>
                            {mt.descricao && <div className="text-[10px] text-gray-500 mt-0.5 truncate">{mt.descricao}</div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>{/* end content */}
        </div>{/* end body */}
      </div>
    </div>
  )
}
