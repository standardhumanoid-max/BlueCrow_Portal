import { useState, useRef, useEffect } from 'react'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'
import { Badge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import {
  Search, Plus, X, Upload, Download, FileText, File, MessageSquare,
  Send, ChevronRight, BookOpen, Bot, User,
} from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'nacional' | 'europeu' | 'reporte' | 'mapa' | 'supervisores'
type Categoria = 'nacional' | 'europeu' | 'reporte'
type Aplicabilidade = 'Aplicável' | 'Não aplicável' | 'Em análise' | '—'

interface DiplomaFile { name: string; size: string; data: string }

interface Diploma {
  id: string
  categoria: Categoria
  fonte: string
  documento: string
  descricao: string
  dataPublicacao: string
  entradaVigor: string
  aplicabilidade: Aplicabilidade
  notas: string
  estado: string
  autoridade: string
  ambito: string
  file?: DiplomaFile
}

interface ChatMsg { role: 'user' | 'assistant'; text: string; ts: string }

// ─── Seed Data ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

const SEED_DIPLOMAS: Diploma[] = [
  // Nacional
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'D.L. n.º 27/2023 — RGA',
    descricao: 'Regime da Gestão de Ativos. Lei quadro das SCR e OIC. Revoga RJCRESIE. Autorização, organização, deveres, supervisão.',
    dataPublicacao: '2023-04-27', entradaVigor: '2023-05-01',
    aplicabilidade: 'Aplicável', notas: 'Diploma principal da atividade.',
    estado: 'Vigente', autoridade: 'CMVM', ambito: 'SCR / Gestão de Ativos',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 16/2015 — RGOIC',
    descricao: 'Regime geral dos OIC; aplicação residual após RGA 2023.',
    dataPublicacao: '2015-02-24', entradaVigor: '2015-03-01',
    aplicabilidade: 'Aplicável', notas: 'Aplicação residual.',
    estado: 'Residual', autoridade: 'CMVM', ambito: 'OIC',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Cód. Valores Mobiliários (D.L. n.º 486/99)',
    descricao: 'Mercados financeiros, intermediação, oferta pública, deveres de informação.',
    dataPublicacao: '1999-11-13', entradaVigor: '2000-03-01',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Vigente', autoridade: 'CMVM', ambito: 'Mercados / Intermediação',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Reg. CMVM n.º 7/2023 — RRGA',
    descricao: 'Regulamenta o RGA. Reporte (Anexos VI–XI), comercialização, governação.',
    dataPublicacao: '2024-01-10', entradaVigor: '2024-01-15',
    aplicabilidade: 'Aplicável', notas: 'Anexos de reporte críticos.', estado: 'Vigente', autoridade: 'CMVM', ambito: 'SCR / Reporte',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Reg. CMVM n.º 3/2025 — Alteração RRGA',
    descricao: 'Altera Reg. 8/2018, 7/2023. Requisitos prudenciais e adaptação ao BUE.',
    dataPublicacao: '2025-04-01', entradaVigor: '2025-04-15',
    aplicabilidade: 'Em análise', notas: 'Em implementação interna.', estado: 'Vigente', autoridade: 'CMVM', ambito: 'Prudencial / BUE',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Reg. CMVM n.º 6/2023 — Governo Societário SG',
    descricao: 'Governo societário, comités internos, funções de controlo, política de remuneração.',
    dataPublicacao: '2023-08-01', entradaVigor: '2023-09-01',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Vigente', autoridade: 'CMVM', ambito: 'Governação',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 83/2017 — PBCFT',
    descricao: 'KYC, EDD, comunicação UIF, avaliação de risco interna.',
    dataPublicacao: '2017-08-18', entradaVigor: '2017-09-01',
    aplicabilidade: 'Aplicável', notas: 'Checklists KYC actualizadas.', estado: 'Conforme', autoridade: 'CMVM/BdP', ambito: 'PBCFT',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 93/2021 — Proteção de Denunciantes',
    descricao: 'Canal interno obrigatório. Transpõe Diretiva (UE) 2019/1937.',
    dataPublicacao: '2021-12-20', entradaVigor: '2022-06-18',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Conforme', autoridade: '—', ambito: 'Whistleblowing',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 58/2019 — RGPD Nacional',
    descricao: 'Proteção de dados pessoais. DPO, DPIA, violações.',
    dataPublicacao: '2019-08-08', entradaVigor: '2019-08-09',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Em atualização', autoridade: 'CNPD', ambito: 'RGPD',
  },
  // Mapa de Atualidade 2026
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 69/2025',
    descricao: 'Alteração ao Código do Trabalho — regime de teletrabalho e descanso digital.',
    dataPublicacao: '2025-07-01', entradaVigor: '2025-08-01',
    aplicabilidade: 'Em análise', notas: 'Verificar impacto nas políticas internas de RH.', estado: 'Vigente', autoridade: 'DGAERT', ambito: 'RH / Trabalho',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 70/2025',
    descricao: 'Revisão do regime de conflitos de interesse para gestores de ativos.',
    dataPublicacao: '2025-07-15', entradaVigor: '2025-10-01',
    aplicabilidade: 'Aplicável', notas: 'Atualizar política de conflitos de interesse.', estado: 'Vigente', autoridade: 'CMVM', ambito: 'Governação / Conflitos',
  },
  {
    id: uid(), categoria: 'nacional',
    fonte: 'PT', documento: 'Lei n.º 73/2025',
    descricao: 'Transposição da Diretiva (UE) 2024/1689 — Inteligência Artificial.',
    dataPublicacao: '2025-09-01', entradaVigor: '2026-02-02',
    aplicabilidade: 'Em análise', notas: 'Avaliar uso de IA em processos de compliance.', estado: 'Vigente', autoridade: 'ANACOM / CNPD', ambito: 'IA / Tecnologia',
  },
  // Europeu
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'AIFMD (2011/61/UE) + Revisão 2024',
    descricao: 'Diretiva dos Gestores de Fundos de Investimento Alternativo. Autorização, passaporte europeu, reporte Annex IV.',
    dataPublicacao: '2011-07-01', entradaVigor: '2013-07-22',
    aplicabilidade: 'Aplicável', notas: 'Revisão 2024 transposta via RGA.', estado: 'Conforme', autoridade: 'ESMA / CMVM', ambito: 'FIA / Gestão',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'SFDR — Reg. (UE) 2019/2088',
    descricao: 'Divulgação de informação sobre sustentabilidade no setor dos serviços financeiros.',
    dataPublicacao: '2019-11-27', entradaVigor: '2021-03-10',
    aplicabilidade: 'Aplicável', notas: 'Art. 8 ativo — PAI statement anual.', estado: 'Art. 8 ativo', autoridade: 'ESMA / EBA', ambito: 'ESG / Sustentabilidade',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'EuVECA — Reg. (UE) 345/2013',
    descricao: 'Fundos europeus de capital de risco — passaporte e requisitos de registo.',
    dataPublicacao: '2013-04-17', entradaVigor: '2013-07-22',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Registado', autoridade: 'CMVM', ambito: 'Capital de Risco',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'DORA — Reg. (UE) 2022/2554',
    descricao: 'Resiliência operacional digital do setor financeiro. Incidentes TIC, testes, gestão de terceiros.',
    dataPublicacao: '2022-12-27', entradaVigor: '2025-01-17',
    aplicabilidade: 'Aplicável', notas: 'Plano de implementação em curso.', estado: 'Em implementação', autoridade: 'ESAs', ambito: 'Risco TIC / Digital',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'MLD5 / MLD6',
    descricao: '5ª e 6ª Diretivas Anti-Branqueamento. Beneficiários efetivos, obrigações reforçadas.',
    dataPublicacao: '2018-05-30', entradaVigor: '2020-01-10',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Transposta', autoridade: 'AMLA', ambito: 'PBCFT',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'RGPD — Reg. (UE) 2016/679',
    descricao: 'Proteção de dados pessoais. Princípios, direitos dos titulares, DPO, transferências internacionais.',
    dataPublicacao: '2016-04-27', entradaVigor: '2018-05-25',
    aplicabilidade: 'Aplicável', notas: '', estado: 'Em atualização', autoridade: 'CNPD / EDPB', ambito: 'Dados Pessoais',
  },
  {
    id: uid(), categoria: 'europeu',
    fonte: 'UE', documento: 'Reg. UE 2025/2462',
    descricao: 'Regulamento relativo aos mercados de criptoativos (MiCA) — fase 2 de implementação.',
    dataPublicacao: '2023-06-09', entradaVigor: '2024-12-30',
    aplicabilidade: 'Em análise', notas: 'Monitorizar impacto em produtos alternativos.', estado: 'Em implementação', autoridade: 'ESMA / CMVM', ambito: 'Criptoativos / MiCA',
  },
  // Reporte
  {
    id: uid(), categoria: 'reporte',
    fonte: 'CMVM', documento: 'Annex IV — AIFMD',
    descricao: 'Reporte trimestral obrigatório dos gestores de FIA à CMVM / ESMA. Posições, alavancagem, liquidez.',
    dataPublicacao: '2013-01-01', entradaVigor: '2014-01-01',
    aplicabilidade: 'Aplicável', notas: 'Próximo reporte: Abr 2026 (Q1).', estado: 'Abr 2026', autoridade: 'CMVM / ESMA', ambito: 'FIA / Trimestral',
  },
  {
    id: uid(), categoria: 'reporte',
    fonte: 'Interno', documento: 'Relatório Anual de Compliance',
    descricao: 'Relatório anual ao Conselho de Administração sobre o estado do compliance, incumprimentos e plano de melhoria.',
    dataPublicacao: '—', entradaVigor: '—',
    aplicabilidade: 'Aplicável', notas: 'Submetido em Janeiro.', estado: 'Submetido', autoridade: 'CA', ambito: 'Interno / Anual',
  },
  {
    id: uid(), categoria: 'reporte',
    fonte: 'ESMA', documento: 'SFDR PAI Statement',
    descricao: 'Declaração anual sobre principais impactos adversos em sustentabilidade.',
    dataPublicacao: '—', entradaVigor: '—',
    aplicabilidade: 'Aplicável', notas: 'Prazo: 30 Jun.', estado: 'Jun 2026', autoridade: 'CMVM / Website', ambito: 'ESG / Anual',
  },
  {
    id: uid(), categoria: 'reporte',
    fonte: 'CMVM', documento: 'Relatório de Atividades SCR',
    descricao: 'Reporte semestral das atividades das SCR à CMVM.',
    dataPublicacao: '—', entradaVigor: '—',
    aplicabilidade: 'Aplicável', notas: 'Próximo: Jul 2026.', estado: 'Jul 2026', autoridade: 'CMVM', ambito: 'SCR / Semestral',
  },
  {
    id: uid(), categoria: 'reporte',
    fonte: 'BdP/UIF', documento: 'Comunicação OPS Suspeitas',
    descricao: 'Comunicação de operações suspeitas à UIF/DCIAP no prazo de 2 dias úteis.',
    dataPublicacao: '—', entradaVigor: '—',
    aplicabilidade: 'Aplicável', notas: 'Processo automático — monitorizar.', estado: 'Contínuo', autoridade: 'UIF / DCIAP', ambito: 'PBCFT / Ad hoc',
  },
]

// ─── Chat keyword responses ────────────────────────────────────────────────────
const CHAT_KB: Array<{ keys: string[]; answer: string }> = [
  {
    keys: ['dora', 'resiliência digital', 'tic', 'incidente tic', 'digital'],
    answer: 'O **DORA** (Reg. UE 2022/2554) entrou em vigor a 17 Jan 2025. Exige: (1) Gestão do risco TIC documentada; (2) Registo e notificação de incidentes significativos (às ESAs via CMVM); (3) Testes de resiliência (TLPT para entidades significativas); (4) Gestão de risco de terceiros TIC (contratos com fornecedores críticos). A Blue Crow Capital deve implementar até ao final de 2025. O ponto de contacto regulatório é a CMVM.',
  },
  {
    keys: ['rgpd', 'dados pessoais', 'dpo', 'dpia', 'cnpd', 'proteção de dados'],
    answer: 'O **RGPD** (Reg. UE 2016/679) aplica-se ao tratamento de dados pessoais de investidores e colaboradores. Obrigações principais: nomeação de DPO (obrigatório para certas categorias), realização de DPIA para tratamentos de alto risco, registo de atividades de tratamento, notificação de violações à CNPD em 72 horas. A execução nacional é feita pela Lei n.º 58/2019. Em caso de dúvida, contactar o DPO.',
  },
  {
    keys: ['pbcft', 'kyc', 'branqueamento', 'financiamento terrorismo', 'uif', 'ubo', 'beneficiário efetivo'],
    answer: 'O regime **PBCFT** (Lei n.º 83/2017, transpondo MLD4/5/6) impõe: (1) Identificação e verificação de clientes (KYC) e beneficiários efetivos (UBO); (2) Diligência reforçada (EDD) para clientes de alto risco ou PEP; (3) Comunicação imediata de operações suspeitas à UIF (prazo: 2 dias úteis); (4) Avaliação de risco interna atualizada anualmente. O supervisor principal em PBCFT para SCR é o BdP em coordenação com a CMVM.',
  },
  {
    keys: ['aifmd', 'annex iv', 'fia', 'fundo alternativo', 'gestão alternativa', 'passaporte'],
    answer: 'A **AIFMD** (2011/61/UE, revista em 2024) regula os gestores de fundos de investimento alternativo. Obrigações: autorização pela CMVM, reporte **Annex IV** trimestral (posições, alavancagem, liquidez), regras de delegação reforçadas (revisão 2024), requisitos de capital. O próximo Annex IV é referente ao Q1 2026 (prazo: Abril 2026). Em Portugal, a transposição foi feita via RGA (D.L. n.º 27/2023).',
  },
  {
    keys: ['sfdr', 'esg', 'sustentabilidade', 'pai', 'artigo 8', 'artigo 9', 'divulgação'],
    answer: 'O **SFDR** (Reg. UE 2019/2088) exige divulgação de informação sobre sustentabilidade a nível da entidade e dos produtos. A Blue Crow Capital possui fundos classificados como **Artigo 8** (promovem características ambientais/sociais). Obrigações: publicação de políticas de integração de riscos de sustentabilidade no website, declaração anual de PAI (Principal Adverse Impacts) até 30 de Junho. Atenção à revisão do SFDR em curso a nível europeu.',
  },
  {
    keys: ['rga', 'scr', 'capital de risco', 'autorização', 'cmvm autorização'],
    answer: 'O **RGA** (D.L. n.º 27/2023) é o diploma-quadro da gestão de ativos em Portugal. Para SCR: exige autorização prévia da CMVM, requisitos de capital mínimo, órgãos de controlo (função de compliance, gestão de risco, auditoria interna), política de remuneração, e reporte semestral de atividades. O **Reg. CMVM 7/2023** (RRGA) regulamenta os anexos de reporte (VI–XI) e as regras de comercialização.',
  },
  {
    keys: ['cmvm', 'reporte cmvm', 'reporte regulatório', 'supervisão'],
    answer: 'Os principais reportes à **CMVM** são: Annex IV AIFMD (trimestral, 30 dias após fim do trimestre), Relatório de Atividades SCR (semestral, Jan e Jul), informação sobre fundos registados. O portal de reporte é o sistema PDSF da CMVM. Em caso de incidente material, a comunicação deve ser feita no prazo de 1 dia útil. A CMVM é o interlocutor principal para questões de autorização e inspeções.',
  },
  {
    keys: ['mica', 'cripto', 'criptoativos', 'token', 'stablecoin'],
    answer: 'O **MiCA** (Reg. UE 2023/1114) regula os mercados de criptoativos na UE. A fase 2 (todos os criptoativos, exceto ART e EMT) entrou em vigor em Dez 2024. Para gestoras de ativos tradicionais, o impacto é limitado, mas deve avaliar-se: (1) se algum produto expõe investidores a criptoativos; (2) regras de divulgação aplicáveis; (3) impacto do Reg. UE 2025/2462 nas obrigações de reporte. A autoridade competente em Portugal é a CMVM.',
  },
  {
    keys: ['conflito de interesse', 'conflitos', 'lei 70'],
    answer: 'A **Lei n.º 70/2025** revê o regime de conflitos de interesse para gestores de ativos. Principais alterações: (1) Ampliação do perímetro de conflitos a declarar; (2) Obrigação de registo atualizado de todos os conflitos potenciais; (3) Proibição de certas práticas de retrocesso sem divulgação. A política interna de conflitos de interesse deve ser atualizada até 1 Out 2025.',
  },
]

function getChatAnswer(q: string): string {
  const lower = q.toLowerCase()
  for (const kb of CHAT_KB) {
    if (kb.keys.some(k => lower.includes(k))) return kb.answer
  }
  return 'Não encontrei informação específica sobre essa questão na base de conhecimento regulatório. Pode reformular a pergunta ou consultar diretamente o texto do diploma em causa? Palavras-chave úteis: DORA, RGPD, PBCFT, AIFMD, SFDR, RGA, CMVM, MiCA, conflitos de interesse.'
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function estateBadge(estado: string) {
  const v =
    estado === 'Vigente' || estado === 'Conforme' || estado === 'Submetido' || estado === 'Transposta' || estado === 'Registado' ? 'green'
    : estado === 'Em implementação' || estado === 'Em análise' || estado === 'Em atualização' || estado === 'Residual' ? 'amber'
    : estado === 'Contínuo' ? 'blue'
    : 'gray'
  return <Badge variant={v as 'green' | 'amber' | 'blue' | 'gray'}>{estado}</Badge>
}

// ─── Add Diploma Modal ────────────────────────────────────────────────────────
function AddDiplomaModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: Diploma) => void }) {
  const [form, setForm] = useState<Omit<Diploma, 'id'>>({
    categoria: 'nacional', fonte: '', documento: '', descricao: '',
    dataPublicacao: '', entradaVigor: '', aplicabilidade: 'Em análise',
    notas: '', estado: 'Em análise', autoridade: '', ambito: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-[13px] font-semibold text-gray-900">Novo Diploma</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="nacional">Nacional</option>
                <option value="europeu">Europeu</option>
                <option value="reporte">Reporte</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Fonte</label>
              <input value={form.fonte} onChange={e => set('fonte', e.target.value)} placeholder="ex: PT / UE / CMVM"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Documento</label>
            <input value={form.documento} onChange={e => set('documento', e.target.value)} placeholder="ex: Lei n.º 83/2017 — PBCFT"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Data de Publicação</label>
              <input type="date" value={form.dataPublicacao} onChange={e => set('dataPublicacao', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Entrada em Vigor</label>
              <input type="date" value={form.entradaVigor} onChange={e => set('entradaVigor', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Autoridade</label>
              <input value={form.autoridade} onChange={e => set('autoridade', e.target.value)} placeholder="ex: CMVM"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Âmbito</label>
              <input value={form.ambito} onChange={e => set('ambito', e.target.value)} placeholder="ex: SCR / PBCFT"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Aplicabilidade</label>
              <select value={form.aplicabilidade} onChange={e => set('aplicabilidade', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Aplicável">Aplicável</option>
                <option value="Não aplicável">Não aplicável</option>
                <option value="Em análise">Em análise</option>
                <option value="—">—</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Estado</label>
              <input value={form.estado} onChange={e => set('estado', e.target.value)} placeholder="ex: Vigente"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            disabled={!form.documento.trim()}
            onClick={() => { onAdd({ ...form, id: uid() }); onClose() }}
            className="px-4 py-1.5 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Diploma Drawer ────────────────────────────────────────────────────────────
function DiplomaDrawer({ diploma, onClose, onUpdate }: {
  diploma: Diploma; onClose: () => void; onUpdate: (d: Diploma) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(diploma)
  const setD = (k: keyof Diploma, v: string) => setDraft(p => ({ ...p, [k]: v }))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const sizeStr = f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`
    const reader = new FileReader()
    reader.onload = (ev) => {
      const updated = { ...draft, file: { name: f.name, size: sizeStr, data: ev.target?.result as string } }
      setDraft(updated); onUpdate(updated)
    }
    reader.readAsDataURL(f)
  }

  function removeFile() {
    const updated = { ...draft, file: undefined }; setDraft(updated); onUpdate(updated)
  }

  const aplic = draft.aplicabilidade
  const aplicColor = aplic === 'Aplicável' ? 'bg-green-100 text-green-700' : aplic === 'Não aplicável' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">{diploma.categoria}</span>
              <span className="text-gray-300">·</span>
              <span className="text-[10px] text-gray-400">{diploma.fonte}</span>
            </div>
            <div className="text-[13px] font-semibold text-gray-900 leading-snug">{diploma.documento}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mt-0.5 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Aplicabilidade pill */}
          <div className="flex items-center gap-2">
            <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full', aplicColor)}>{draft.aplicabilidade}</span>
            {estateBadge(draft.estado)}
          </div>

          {/* Description */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Descrição</div>
            {editing ? (
              <textarea value={draft.descricao} onChange={e => setD('descricao', e.target.value)} rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            ) : (
              <p className="text-[12px] text-gray-700 leading-relaxed">{draft.descricao || '—'}</p>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
            {[
              ['Autoridade', draft.autoridade],
              ['Âmbito', draft.ambito],
              ['Data de Publicação', draft.dataPublicacao || '—'],
              ['Entrada em Vigor', draft.entradaVigor || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                {editing && (label === 'Autoridade' || label === 'Âmbito') ? (
                  <input value={value} onChange={e => setD(label === 'Autoridade' ? 'autoridade' : 'ambito', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
                ) : (
                  <div className="text-gray-800 font-medium">{value || '—'}</div>
                )}
              </div>
            ))}
          </div>

          {/* Aplicabilidade select while editing */}
          {editing && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Aplicabilidade</label>
              <select value={draft.aplicabilidade} onChange={e => setD('aplicabilidade', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Aplicável">Aplicável</option>
                <option value="Não aplicável">Não aplicável</option>
                <option value="Em análise">Em análise</option>
                <option value="—">—</option>
              </select>
            </div>
          )}

          {/* Notas */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas Internas</div>
            {editing ? (
              <textarea value={draft.notas} onChange={e => setD('notas', e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            ) : (
              <p className="text-[12px] text-gray-600 leading-relaxed">{draft.notas || '—'}</p>
            )}
          </div>

          {/* Documento anexo */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Documento Anexo</div>
            {draft.file ? (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-[12px] text-gray-700 flex-1 min-w-0 truncate">{draft.file.name}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{draft.file.size}</span>
                <a href={draft.file.data} download={draft.file.name}
                  className="text-blue-600 hover:text-blue-800 flex-shrink-0" title="Descarregar">
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button onClick={removeFile} className="text-gray-400 hover:text-red-500 flex-shrink-0" title="Remover">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 w-full text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-[12px]">Carregar documento (PDF, Word, Excel)</span>
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleFile} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
          {editing ? (
            <>
              <button onClick={() => { setDraft(diploma); setEditing(false) }}
                className="text-[12px] text-gray-500 hover:text-gray-800">Cancelar</button>
              <button onClick={() => { onUpdate(draft); setEditing(false) }}
                className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                Guardar alterações
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">
                Editar
              </button>
              <button onClick={onClose} className="text-[12px] text-gray-500 hover:text-gray-800">Fechar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: 'assistant', text: 'Olá! Sou o assistente regulatório. Posso ajudar com questões sobre DORA, RGPD, PBCFT, AIFMD, SFDR, RGA, MiCA, conflitos de interesse, e muito mais. Como posso ajudar?', ts: new Date().toISOString() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  function send() {
    const q = input.trim(); if (!q) return
    const userMsg: ChatMsg = { role: 'user', text: q, ts: new Date().toISOString() }
    setMsgs(p => [...p, userMsg]); setInput(''); setLoading(true)
    setTimeout(() => {
      const answer = getChatAnswer(q)
      setMsgs(p => [...p, { role: 'assistant', text: answer, ts: new Date().toISOString() }])
      setLoading(false)
    }, 700)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ maxHeight: '520px' }}>
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e3a5f] text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span className="text-[13px] font-semibold">Assistente Regulatório</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: '380px' }}>
        {msgs.map((m, i) => (
          <div key={i} className={clsx('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={clsx(
              'rounded-xl px-3 py-2 text-[12px] leading-relaxed max-w-[85%]',
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800',
            )}>
              {m.text.split(/\*\*(.*?)\*\*/).map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3 h-3 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-gray-100 rounded-xl px-3 py-2">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-2.5 border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-300">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Questão sobre legislação…" className="flex-1 bg-transparent text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none" />
          <button onClick={send} disabled={!input.trim() || loading}
            className="text-blue-600 hover:text-blue-800 disabled:opacity-30 flex-shrink-0 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mapa Tab (Excel-style) ────────────────────────────────────────────────────
function MapaTab({ diplomas }: { diplomas: Diploma[] }) {
  const all = diplomas.filter(d => d.dataPublicacao && d.dataPublicacao !== '—')
    .sort((a, b) => (b.dataPublicacao ?? '').localeCompare(a.dataPublicacao ?? ''))

  const aplic = (a: Aplicabilidade) =>
    a === 'Aplicável' ? 'bg-green-100 text-green-700'
    : a === 'Não aplicável' ? 'bg-gray-100 text-gray-500'
    : a === 'Em análise' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-50 text-gray-400'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-200">
            {['Fonte', 'Documento', 'Descrição', 'Data Publicação', 'Entrada em Vigor', 'Aplicabilidade', 'Notas'].map(h => (
              <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {all.map((d, i) => (
            <tr key={d.id} className={clsx('border-b border-gray-100 hover:bg-gray-50', i % 2 === 0 ? '' : 'bg-gray-50/40')}>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">{d.fonte || '—'}</span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px]">
                <div className="truncate" title={d.documento}>{d.documento}</div>
              </td>
              <td className="px-3 py-2 text-gray-500 max-w-[220px]">
                <div className="line-clamp-2" title={d.descricao}>{d.descricao}</div>
              </td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                {d.dataPublicacao ? new Date(d.dataPublicacao).toLocaleDateString('pt-PT') : '—'}
              </td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                {d.entradaVigor && d.entradaVigor !== '—' ? new Date(d.entradaVigor).toLocaleDateString('pt-PT') : d.entradaVigor || '—'}
              </td>
              <td className="px-3 py-2">
                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', aplic(d.aplicabilidade))}>
                  {d.aplicabilidade}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-500 max-w-[160px]">
                <div className="truncate" title={d.notas}>{d.notas || '—'}</div>
              </td>
            </tr>
          ))}
          {all.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-[12px]">Sem diplomas com data disponível</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function QuadroRegulatorio() {
  const [tab, setTab] = useState<TabId>('nacional')
  const [diplomas, setDiplomas] = useState<Diploma[]>([])

  useEffect(() => {
    sbLoad<Diploma>('quadro_reg', 'comp_quadro_reg', SEED_DIPLOMAS).then(setDiplomas)
  }, [])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDiploma, setSelectedDiploma] = useState<Diploma | null>(null)
  const [showChat, setShowChat] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const q = search.trim().toLowerCase()
  const searchResults = q.length >= 2
    ? diplomas.filter(d =>
        d.documento.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q) ||
        d.ambito.toLowerCase().includes(q) ||
        d.autoridade.toLowerCase().includes(q)
      ).slice(0, 8)
    : []

  function updateDiploma(d: Diploma) {
    const next = diplomas.map(x => x.id === d.id ? d : x)
    setDiplomas(next)
    setSelectedDiploma(d)
    void sbSaveAll('quadro_reg', 'comp_quadro_reg', next)
  }

  const nacional = diplomas.filter(d => d.categoria === 'nacional')
  const europeu = diplomas.filter(d => d.categoria === 'europeu')
  const reporte = diplomas.filter(d => d.categoria === 'reporte')

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'nacional', label: '🇵🇹 Nacional' },
    { id: 'europeu', label: '🇪🇺 Europeu' },
    { id: 'reporte', label: '📋 Reporte' },
    { id: 'mapa', label: '📊 Mapa de Atualidade' },
    { id: 'supervisores', label: 'Supervisores' },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Diplomas Nacionais" value={nacional.length} sub="em vigor" color="blue" />
        <KpiCard label="Regulamentos UE" value={europeu.length} sub="1 em implementação" color="amber" trend="neutral" />
        <KpiCard label="Reporte Obrigatório" value={reporte.length} sub="obrigações ativas" color="blue" trend="up" />
        <KpiCard label="Próx. Reporte" value="Abr 2026" sub="Annex IV Q1" color="green" />
      </div>

      {/* Header row: search + add + chat */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-300">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              onKeyDown={e => e.key === 'Escape' && setSearch('')}
              placeholder="Pesquisar diploma, âmbito, autoridade…"
              className="flex-1 bg-transparent text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
          </div>
          {showSearch && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-40 overflow-hidden max-h-64 overflow-y-auto">
              {searchResults.map(d => (
                <button key={d.id} onMouseDown={() => { setSelectedDiploma(d); setSearch(''); setShowSearch(false) }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                  <File className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">{d.documento}</div>
                    <div className="text-[11px] text-gray-400 truncate">{d.ambito} · {d.autoridade}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-0.5 ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Novo Diploma */}
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] font-medium px-3.5 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Novo Diploma
        </button>

        {/* Copilot Chat */}
        <button onClick={() => setShowChat(c => !c)}
          className={clsx(
            'flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-xl transition-colors shadow-sm flex-shrink-0 border',
            showChat ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
          )}>
          <MessageSquare className="w-3.5 h-3.5" />
          Assistente
        </button>
      </div>

      {/* Main card */}
      <div className="card">
        <div className="tab-list px-0">
          {TABS.map(t => (
            <button key={t.id} data-state={tab === t.id ? 'active' : ''} className="tab-trigger"
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Nacional */}
        {tab === 'nacional' && (
          <div>
            <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider px-4 py-2.5 border-b border-gray-200">
              Legislação Principal — SCR &amp; Gestão de Ativos
            </div>
            <table className="data-table w-full">
              <thead><tr><th>Diploma</th><th>Data</th><th>Autoridade</th><th>Âmbito</th><th>Estado</th></tr></thead>
              <tbody>
                {nacional.map(d => (
                  <tr key={d.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelectedDiploma(d)}>
                    <td className="font-medium text-blue-700 hover:underline">{d.documento}</td>
                    <td className="text-gray-400 font-mono text-[11px]">
                      {d.dataPublicacao && d.dataPublicacao !== '—' ? new Date(d.dataPublicacao).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }) : d.dataPublicacao || '—'}
                    </td>
                    <td>{d.autoridade}</td>
                    <td className="text-gray-500 text-[11px]">{d.ambito}</td>
                    <td>{estateBadge(d.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Europeu */}
        {tab === 'europeu' && (
          <table className="data-table w-full">
            <thead><tr><th>Regulamento / Diretiva</th><th>Entidade</th><th>Âmbito</th><th>Estado</th></tr></thead>
            <tbody>
              {europeu.map(d => (
                <tr key={d.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelectedDiploma(d)}>
                  <td className="font-medium text-blue-700 hover:underline">{d.documento}</td>
                  <td>{d.autoridade}</td>
                  <td className="text-gray-500 text-[11px]">{d.ambito}</td>
                  <td>{estateBadge(d.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Reporte */}
        {tab === 'reporte' && (
          <table className="data-table w-full">
            <thead><tr><th>Reporte / Declaração</th><th>Destinatário</th><th>Âmbito</th><th>Estado</th></tr></thead>
            <tbody>
              {reporte.map(d => (
                <tr key={d.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelectedDiploma(d)}>
                  <td className="font-medium text-blue-700 hover:underline">{d.documento}</td>
                  <td>{d.autoridade}</td>
                  <td className="text-gray-500 text-[11px]">{d.ambito}</td>
                  <td>{estateBadge(d.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Mapa */}
        {tab === 'mapa' && <MapaTab diplomas={diplomas} />}

        {/* Supervisores */}
        {tab === 'supervisores' && (
          <div className="grid grid-cols-3 gap-4 p-4">
            {[
              { title: '🏛 CMVM', desc: 'Registo como SCR, supervisão prudencial e de conduta, reporte regulatório periódico (Annex IV, Atividades). Interlocutor principal para questões de autorização e inspeções.' },
              { title: '🏦 Banco de Portugal', desc: 'Supervisão em matéria de prevenção de branqueamento de capitais. Coordenação com CMVM em casos de dupla supervisão. Registos e declarações PBCFT.' },
              { title: '🌐 ESMA / EBA', desc: 'Regulamentação europeia — AIFMD, SFDR, DORA, MLD. Q&A e guidelines das ESAs de aplicação direta. Coordenação via CMVM como autoridade competente nacional.' },
            ].map(s => (
              <div key={s.title} className="bg-gray-50 rounded-lg p-4">
                <div className="text-[13px] font-semibold text-gray-900 mb-2">{s.title}</div>
                <div className="text-[12px] text-gray-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddDiplomaModal onClose={() => setShowAddModal(false)} onAdd={d => { const next = [d, ...diplomas]; setDiplomas(next); void sbSaveAll('quadro_reg', 'comp_quadro_reg', next) }} />
      )}
      {selectedDiploma && (
        <DiplomaDrawer
          diploma={selectedDiploma}
          onClose={() => setSelectedDiploma(null)}
          onUpdate={updateDiploma}
        />
      )}
      {showChat && <ChatPanel onClose={() => setShowChat(false)} />}
    </div>
  )
}
