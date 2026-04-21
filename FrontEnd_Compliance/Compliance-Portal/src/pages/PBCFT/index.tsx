import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Plus, Search, X, Download, FileSpreadsheet, FileText, ChevronDown, Calendar, Filter, Upload, Pencil, Trash2 } from 'lucide-react'
import { Badge, estadoVariant } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { useStore } from '@/store/useStore'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { KYCClient, KYCDoc } from '@/types'
import * as XLSX from 'xlsx-js-style'

const TABS = ['KYC / AML','Dever de Comunicação','Dever de Exame','Dever de Recusa','Modelos','Estatísticas','Formação']

const RISK_COLOR:   Record<string, string> = { Baixo:'#16a34a', Médio:'#d97706', Alto:'#dc2626' }
const STATUS_COLOR: Record<string, string> = { Aceite:'#16a34a', 'Em Revisão':'#d97706', Pendente:'#3b82f6', Recusado:'#dc2626' }

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ─── Country data ──────────────────────────────────────────────────────────────
const NATIONALITIES = [
  'Afegã','Albanesa','Alemã','Algeriana','Americana','Andorrana','Angolana','Antiguense','Saudita',
  'Argentina','Arménia','Australiana','Austríaca','Azerbaijana','Bahamense','Bangladeshiana','Barbadense',
  'Bareinita','Belga','Belizenha','Bielorrussa','Boliviana','Bósnia','Botsuanesa','Brasileira','Bruneiana',
  'Búlgara','Burquinesa','Burundiana','Butanesa','Cabo-Verdiana','Camaronesa','Cambojana','Canadiana',
  'Catariana','Cazaquistanesa','Chadiense','Chilena','Chinesa','Cipriota','Colombiana','Comoriana',
  'Congolesa','Coreana do Norte','Coreana do Sul','Costa-marfinense','Costarriquenha','Croata','Cubana',
  'Dinamarquesa','Djiboutiana','Dominicana','Egípcia','Emiradense','Equatoriana','Eritreia','Eslovaca',
  'Eslovena','Espanhola','Estoniana','Etíope','Fijiana','Filipina','Finlandesa','Francesa','Gabonesa',
  'Gambiana','Ganesa','Georgiana','Greco','Guatemalteca','Guineense','Guineense-Equatorial','Guianesa',
  'Haitiana','Hondurenha','Húngara','Iemenita','Índia','Indonésia','Iraniana','Iraquiana','Irlandesa',
  'Islandesa','Israelita','Italiana','Jamaicana','Japonesa','Jordaniana','Kuwaitiana','Laosiana',
  'Lesotiana','Letã','Libanesa','Liberiana','Líbia','Liechtensteiniana','Lituã','Luxemburguesa',
  'Macedónia do Norte','Malaisia','Malauiana','Maldiviana','Maliana','Maltesa','Marroquina','Mauritana',
  'Mauriciana','Mexicana','Micronésia','Moçambicana','Moldava','Monegasca','Mongol','Montenegrina',
  'Namibiana','Nepali','Neozelandesa','Nicaraguense','Nigerina','Nigeriana','Norueguesa','Omanense',
  'Paquistanesa','Palauense','Palestiniana','Panamenha','Papua-Nova-Guineense','Paraguaia','Peruana',
  'Polaca','Portuguesa','Queniana','Quirguistanesa','Ruandesa','Romena','Russa','Salvadorenha',
  'Samoana','São-Marinhense','São-Tomense','Senegalesa','Sérvia','Seychellense','Serra-leonense',
  'Singapuriana','Síria','Somali','Sri-Lankesa','Suazi','Sudanesa','Sudanesa do Sul','Sueca','Suíça',
  'Surinamesa','Tailandesa','Tanzaniana','Timorense','Togolesa','Tongana','Trinitária','Tunisiana',
  'Turca','Turcomana','Ugandesa','Ucraniana','Uruguaia','Uzbeque','Vanuatuense','Venezuelana',
  'Vietnamita','Zambiana','Zimbabueana',
].sort()

const COUNTRIES = [
  'Afeganistão','Albânia','Alemanha','Andorra','Angola','Antígua e Barbuda','Arábia Saudita','Argélia',
  'Argentina','Arménia','Austrália','Áustria','Azerbaijão','Baamas','Bangladeche','Barbados','Barém',
  'Bélgica','Belize','Bielorrússia','Bolívia','Bósnia e Herzegovina','Botswana','Brasil','Brunei',
  'Bulgária','Burquina Faso','Burúndi','Butão','Cabo Verde','Camarões','Camboja','Canadá','Catar',
  'Cazaquistão','Chade','Chile','China','Chipre','Colômbia','Comores','Congo','Coreia do Norte',
  'Coreia do Sul','Costa do Marfim','Costa Rica','Croácia','Cuba','Dinamarca','Djibouti','Dominica',
  'República Dominicana','Egito','Emirados Árabes Unidos','Equador','Eritreia','Eslováquia','Eslovénia',
  'Espanha','Estónia','Etiópia','Fiji','Filipinas','Finlândia','França','Gabão','Gâmbia','Gana',
  'Geórgia','Grécia','Guatemala','Guiné','Guiné Equatorial','Guiné-Bissau','Guiana','Haiti','Honduras',
  'Hungria','Iémen','Índia','Indonésia','Irão','Iraque','Irlanda','Islândia','Israel','Itália',
  'Jamaica','Japão','Jordânia','Kuwait','Laos','Lesoto','Letónia','Líbano','Libéria','Líbia',
  'Liechtenstein','Lituânia','Luxemburgo','Macedónia do Norte','Madagáscar','Malásia','Maláui',
  'Maldivas','Mali','Malta','Marrocos','Mauritânia','Maurícia','México','Micronésia','Moçambique',
  'Moldávia','Mónaco','Mongólia','Montenegro','Namíbia','Nepal','Nova Zelândia','Nicarágua','Níger',
  'Nigéria','Noruega','Omã','Paquistão','Palau','Palestina','Panamá','Papua Nova Guiné','Paraguai',
  'Peru','Polónia','Portugal','Quénia','Quirguistão','Ruanda','Roménia','Rússia','El Salvador',
  'Samoa','San Marino','São Tomé e Príncipe','Senegal','Sérvia','Seicheles','Serra Leoa','Singapura',
  'Síria','Somália','Sri Lanka','Suazilândia','Sudão','Sudão do Sul','Suécia','Suíça','Suriname',
  'Tailândia','Tanzânia','Timor-Leste','Togo','Tonga','Trinidad e Tobago','Tunísia','Turquia',
  'Turquemenistão','Uganda','Ucrânia','Uruguai','Usbequistão','Vanuatu','Venezuela','Vietname',
  'Zâmbia','Zimbabué',
].sort()

// ─── Searchable combobox ───────────────────────────────────────────────────────
function SearchCombobox({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState(value)
  const ref                 = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() =>
    query.trim() === ''
      ? options
      : options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
  , [query, options])

  function select(opt: string) {
    onChange(opt)
    setQuery(opt)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="form-input pr-8"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
      />
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 hover:text-blue-700 ${opt === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
              onMouseDown={e => { e.preventDefault(); select(opt) }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SVG → canvas (for PDF chart capture) ─────────────────────────────────────
async function svgToCanvas(svgEl: SVGElement, w = 400, h = 200): Promise<HTMLCanvasElement> {
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── Excel export ──────────────────────────────────────────────────────────────
function exportExcel(filtered: KYCClient[], periodLabel: string) {
  const wb = XLSX.utils.book_new()
  const now = new Date().toLocaleDateString('pt-PT')

  const hdr = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1e3a5f' } }, alignment: { horizontal: 'center' as const } }
  const sub = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'dde6f0' } } }
  const ttl = { font: { bold: true, sz: 14, color: { rgb: '1e3a5f' } } }

  const pct = (n: number) => filtered.length ? Math.round(n / filtered.length * 100) + '%' : '0%'
  const sc = { aceite: filtered.filter(c => c.status === 'Aceite').length, revisao: filtered.filter(c => c.status === 'Em Revisão').length, pendente: filtered.filter(c => c.status === 'Pendente').length, recusado: filtered.filter(c => c.status === 'Recusado').length }
  const rc = { baixo: filtered.filter(c => c.risk === 'Baixo').length, medio: filtered.filter(c => c.risk === 'Médio').length, alto: filtered.filter(c => c.risk === 'Alto').length }
  const mc = MONTHS_PT.map((m, i) => ({ mes: m, count: filtered.filter(c => c.entrada && new Date(c.entrada).getMonth() === i).length })).filter(m => m.count > 0)

  // ── Sheet 1: Resumo ──
  const aoa: unknown[][] = [
    [{ v: 'BlueCrow Capital — Relatório KYC/AML', s: ttl }],
    [`Gerado em: ${now}`, `Período: ${periodLabel}`, `Total clientes: ${filtered.length}`],
    [],
    [{ v: 'ESTADO KYC', s: sub }],
    [{ v: 'Estado', s: hdr }, { v: 'Clientes', s: hdr }, { v: '%', s: hdr }],
    ['Aceite',     sc.aceite,   pct(sc.aceite)],
    ['Em Revisão', sc.revisao,  pct(sc.revisao)],
    ['Pendente',   sc.pendente, pct(sc.pendente)],
    ['Recusado',   sc.recusado, pct(sc.recusado)],
    ['PEP', filtered.filter(c => c.pep).length, ''],
    [],
    [{ v: 'RISCO AML', s: sub }],
    [{ v: 'Nível', s: hdr }, { v: 'Clientes', s: hdr }, { v: '%', s: hdr }],
    ['Baixo', rc.baixo, pct(rc.baixo)],
    ['Médio', rc.medio, pct(rc.medio)],
    ['Alto',  rc.alto,  pct(rc.alto)],
    [],
    [{ v: 'ENTRADAS POR MÊS', s: sub }],
    [{ v: 'Mês', s: hdr }, { v: 'Entradas', s: hdr }],
    ...mc.map(m => [m.mes, m.count]),
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(aoa)
  ws1['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo')

  // ── Sheet 2: Clientes ──
  const colHdrs = ['Nome','NIF','Tipo','Fundos','Risco AML','Estado KYC','PEP','Nacionalidade','Domicílio','Data Entrada','Data Aceitação','Investimento']
  const rows = filtered.map(c => [
    c.name, c.nif, c.type, c.funds.join('; '), c.risk, c.status,
    c.pep ? 'Sim' : 'Não', c.nat, c.dom, c.entrada || '', c.aceite || '', c.inv,
  ])

  const ws2Data = [colHdrs.map(h => ({ v: h, s: hdr })), ...rows]
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)

  // Colour rows by risk
  rows.forEach((row, ri) => {
    const risk = row[4] as string
    const bg = risk === 'Alto' ? 'ffeaea' : risk === 'Médio' ? 'fff8e8' : 'eafaf5'
    const r = ri + 1
    colHdrs.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r, c: ci })
      if (!ws2[addr]) ws2[addr] = { v: '' }
      ws2[addr].s = { fill: { fgColor: { rgb: bg } }, font: ws2[addr].s?.font }
    })
  })

  ws2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 26 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 5 }, { wch: 16 }, { wch: 22 }, { wch: 13 }, { wch: 15 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Clientes')

  XLSX.writeFile(wb, `kyc_relatorio_${now.replace(/\//g, '-')}.xlsx`)
}

// ─── PDF export ────────────────────────────────────────────────────────────────
async function exportPDF(
  filtered: KYCClient[],
  periodLabel: string,
  chartRefs: React.RefObject<HTMLDivElement>[],
) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const now = new Date().toLocaleDateString('pt-PT')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  // Header bar
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('BlueCrow Capital — Relatório KYC / AML', 10, 11)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${periodLabel}   |   Gerado em: ${now}   |   Total: ${filtered.length} clientes`, W - 8, 11, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  // KPI boxes
  const kpis = [
    { label: 'Total Clientes', value: filtered.length, rgb: [59, 130, 246] as [number,number,number] },
    { label: 'Aceites',        value: filtered.filter(c => c.status === 'Aceite').length,     rgb: [22, 163, 74] as [number,number,number] },
    { label: 'Em Revisão',     value: filtered.filter(c => c.status === 'Em Revisão').length, rgb: [217, 119, 6] as [number,number,number] },
    { label: 'Pendentes',      value: filtered.filter(c => c.status === 'Pendente').length,   rgb: [239, 68, 68] as [number,number,number] },
  ]
  kpis.forEach((k, i) => {
    const x = 10 + i * 70
    doc.setFillColor(...k.rgb)
    doc.roundedRect(x, 22, 66, 14, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(String(k.value), x + 33, 30, { align: 'center' })
    doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(k.label, x + 33, 34, { align: 'center' })
  })
  doc.setTextColor(0, 0, 0)

  // Chart images
  const cW = (W - 30) / 3
  const cH = 52
  const cY = 40

  const chartLabels = ['Estado KYC', 'Risco AML', 'Entradas Mensais']
  for (let i = 0; i < chartRefs.length; i++) {
    const ref = chartRefs[i]
    const x = 10 + i * (cW + 5)
    // Label
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(55, 65, 81)
    doc.text(chartLabels[i], x + cW / 2, cY - 1, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    if (ref.current) {
      const svgEl = ref.current.querySelector('svg')
      if (svgEl) {
        try {
          const bBox = svgEl.getBoundingClientRect()
          const canvas = await svgToCanvas(svgEl, bBox.width || 400, bBox.height || 200)
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, cY, cW, cH)
        } catch { /* skip if capture fails */ }
      }
    }

    // Border
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(x, cY, cW, cH, 1.5, 1.5)
  }

  // Client table
  const tHdrs = ['Nome', 'NIF', 'Tipo', 'Fundos', 'Risco', 'Estado', 'PEP', 'Entrada', 'Aceitação']
  const tRows = filtered.map(c => [
    c.name, c.nif,
    c.type.replace('Pessoa ', '').replace('Investidor ', 'Inst. '),
    c.funds.slice(0, 2).join(', ') + (c.funds.length > 2 ? `+${c.funds.length - 2}` : ''),
    c.risk, c.status, c.pep ? 'Sim' : 'Não', c.entrada || '—', c.aceite || '—',
  ])

  autoTable(doc, {
    head: [tHdrs],
    body: tRows,
    startY: cY + cH + 6,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 4) {
          const risk = data.cell.raw as string
          data.cell.styles.textColor = risk === 'Alto' ? [220, 38, 38] : risk === 'Médio' ? [217, 119, 6] : [22, 163, 74]
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.column.index === 5) {
          const st = data.cell.raw as string
          data.cell.styles.textColor = st === 'Aceite' ? [22, 163, 74] : st === 'Recusado' ? [220, 38, 38] : [55, 65, 81]
        }
      }
    },
  })

  doc.save(`kyc_relatorio_${now.replace(/\//g, '-')}.pdf`)
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

// ─── Predefined docs & motivos ────────────────────────────────────────────────
const PREDEFINED_DOCS: KYCDoc['n'][] = [
  'Formulário de subscrição', 'Perfil de investidor', 'KYC',
  'Passaporte', 'NIF', 'Morada',
  'Comprovativo de origem de fundos', 'Tax return', 'Payslips',
]

const MOTIVOS_RECUSA = [
  'INC - Falha no preenchimento BS/KYC',
  'INC - Identificação inválida/expirada',
  'INC - Comprovativo morada/profissão em falta',
  'INC - UBO/estrutura societária incompleta',
  'INC - Origem de fundos sem evidência/não sustentada',
  'REC - Match sanções/embargos',
  'REC - Risco país/indústria não aceitável',
  'REC - AML red flags não mitigadas',
  'REC - PEP risco elevado sem mitigação',
  'REC - Inconsistências/suspeita de AML',
  'OUT - Outro (especificar em Notas)',
]

const DOC_STATUS_CYCLE: KYCDoc['s'][] = ['missing', 'ok', 'expired']
const DOC_STATUS_CLS: Record<KYCDoc['s'], string> = {
  missing:  'bg-gray-100 text-gray-500 border-gray-200',
  ok:       'bg-green-100 text-green-700 border-green-200',
  expired:  'bg-amber-100 text-amber-700 border-amber-200',
}
const DOC_STATUS_LABEL: Record<KYCDoc['s'], string> = {
  missing: 'Em falta', ok: 'OK', expired: 'Expirado',
}

// ─── Mapa Mensal Modal ─────────────────────────────────────────────────────────
function MapaMensalModal({ clients, onClose }: { clients: KYCClient[], onClose: () => void }) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [personalizar, setPersonalizar] = useState(false)
  const [extRisco,  setExtRisco]  = useState(false)
  const [extTipo,   setExtTipo]   = useState(false)
  const [extFundo,  setExtFundo]  = useState(false)
  const [extMotivo, setExtMotivo] = useState(false)

  function inYM(dateStr: string | null, y: number, m: number): boolean {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m
  }
  function pad(n: number) { return String(n).padStart(2, '0') }

  const endDate   = new Date(year, month + 1, 0)
  const prevY     = month === 0 ? year - 1 : year
  const prevM     = month === 0 ? 11 : month - 1

  const doMes     = clients.filter(c => inYM(c.entrada, year, month))
  const aprovados = doMes.filter(c => c.status === 'Aceite')
  const emRevisao = doMes.filter(c => c.status === 'Em Revisão')
  const recusados = doMes.filter(c => c.status === 'Recusado')
  const pendentes = doMes.filter(c => c.status === 'Pendente')
  const total     = doMes.length

  const prevMes   = clients.filter(c => inYM(c.entrada, prevY, prevM))
  const prevAprov = prevMes.filter(c => c.status === 'Aceite').length
  const prevEmRev = prevMes.filter(c => c.status === 'Em Revisão').length
  const prevRecus = prevMes.filter(c => c.status === 'Recusado').length
  const prevPend  = prevMes.filter(c => c.status === 'Pendente').length

  const pct        = (n: number) => total ? `${Math.round(n / total * 100)}%` : '0%'
  const taxaAprov  = pct(aprovados.length)
  const taxaEmRev  = pct(emRevisao.length)
  const taxaRecusa = pct(recusados.length)
  const taxaPend   = pct(pendentes.length)

  const pieData = [
    { name: 'Aprovados',  value: aprovados.length,  color: '#2563eb' },
    { name: 'Em Revisão', value: emRevisao.length,  color: '#d97706' },
    { name: 'Pendentes',  value: pendentes.length,  color: '#7c3aed' },
    { name: 'Recusados',  value: recusados.length,  color: '#9ca3af' },
  ].filter(d => d.value > 0)

  const startStr     = `${year}-${pad(month + 1)}-01`
  const endStr       = `${year}-${pad(month + 1)}-${pad(endDate.getDate())}`
  const prevEndDate  = new Date(prevY, prevM + 1, 0)
  const prevStartStr = `${prevY}-${pad(prevM + 1)}-01`
  const prevEndStr   = `${prevY}-${pad(prevM + 1)}-${pad(prevEndDate.getDate())}`
  const monthLabel   = `${MONTHS_PT[month]} ${year}`

  function exportXlsx() {
    const wb  = XLSX.utils.book_new()
    const hdr = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1e3a5f' } }, alignment: { horizontal: 'center' as const } }
    const sub = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'dde6f0' } } }
    const ttl = { font: { bold: true, sz: 14, color: { rgb: '1e3a5f' } } }
    const bld = { font: { bold: true, sz: 10 } }
    const bgB = { fill: { fgColor: { rgb: 'dde6f0' } }, font: { bold: true } }

    const variacao = (cur: number, prev: number) => cur - prev

    const aoa: unknown[][] = [
      [{ v: 'Mapa Mensal — Compliance (KYC/Onboarding)', s: ttl }],
      ['Mês de reporte (1º dia do mês)', startStr],
      ['Início do mês', startStr], ['Fim do mês', endStr],
      ['Início mês anterior', prevStartStr], ['Fim mês anterior', prevEndStr],
      [],
      [{ v: 'Estado do processo', s: hdr }, { v: 'Nº de clientes', s: hdr }, { v: '% do total', s: hdr }, { v: 'Variação vs mês anterior', s: hdr }, { v: 'Notas', s: hdr }],
      ['Aprovados (entrados no mês)',   aprovados.length,  taxaAprov,  variacao(aprovados.length,  prevAprov),  ''],
      ['Em Revisão (entrados no mês)', emRevisao.length,  taxaEmRev,  variacao(emRevisao.length,  prevEmRev),  ''],
      ['Pendentes (entrados no mês)',  pendentes.length,  taxaPend,   variacao(pendentes.length,  prevPend),   ''],
      ['Recusados (entrados no mês)',  recusados.length,  taxaRecusa, variacao(recusados.length,  prevRecus),  ''],
      [{ v: 'Total', s: bgB }, { v: total, s: bgB }],
      [], [],
      [{ v: 'Taxa de aprovação', s: bld }, taxaAprov],
      [{ v: 'Taxa de revisão',   s: bld }, taxaEmRev],
      [{ v: 'Taxa pendentes',    s: bld }, taxaPend],
      [{ v: 'Taxa de recusa',    s: bld }, taxaRecusa],
    ]

    if (extRisco) {
      const rc: Record<string,number> = {}
      ;[...aprovados,...emRevisao,...pendentes,...recusados].forEach(c => { rc[c.risk] = (rc[c.risk] || 0) + 1 })
      aoa.push([], [{ v: 'DISTRIBUIÇÃO POR RISCO AML', s: sub }], [{ v: 'Nível de Risco', s: hdr }, { v: 'Nº', s: hdr }])
      Object.entries(rc).forEach(([k,v]) => aoa.push([k, v]))
    }
    if (extTipo) {
      const tc: Record<string,number> = {}
      ;[...aprovados,...emRevisao,...pendentes,...recusados].forEach(c => { tc[c.type] = (tc[c.type] || 0) + 1 })
      aoa.push([], [{ v: 'DISTRIBUIÇÃO POR TIPO DE CLIENTE', s: sub }], [{ v: 'Tipo', s: hdr }, { v: 'Nº', s: hdr }])
      Object.entries(tc).forEach(([k,v]) => aoa.push([k, v]))
    }
    if (extFundo) {
      const fc: Record<string,number> = {}
      ;[...aprovados,...emRevisao,...pendentes,...recusados].forEach(c => c.funds.forEach(f => { fc[f] = (fc[f] || 0) + 1 }))
      aoa.push([], [{ v: 'DISTRIBUIÇÃO POR FUNDO', s: sub }], [{ v: 'Fundo', s: hdr }, { v: 'Nº', s: hdr }])
      Object.entries(fc).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => aoa.push([k, v]))
    }
    if (extMotivo) {
      const mc: Record<string,number> = {}
      ;[...emRevisao,...recusados].forEach(c => { if (c.motivo) { mc[c.motivo] = (mc[c.motivo] || 0) + 1 } })
      aoa.push([], [{ v: 'MOTIVOS DE RECUSA / INCOMPLETUDE', s: sub }], [{ v: 'Motivo', s: hdr }, { v: 'Nº', s: hdr }])
      Object.entries(mc).forEach(([k,v]) => aoa.push([k, v]))
    }

    const ws1 = XLSX.utils.aoa_to_sheet(aoa)
    ws1['!cols'] = [{ wch: 52 }, { wch: 16 }, { wch: 12 }, { wch: 26 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Mapa Mensal')

    const detailHdr = ['Nome Cliente', 'NIF', 'Tipo', 'Fundos', 'Risco AML', 'Estado KYC', 'PEP', 'Data Entrada', 'Data Aceitação', 'Motivo', 'Notas']
    const detailRows = [...aprovados, ...emRevisao, ...pendentes, ...recusados].map(c => [
      c.name, c.nif, c.type, c.funds.join('; '), c.risk, c.status,
      c.pep ? 'Sim' : 'Não', c.entrada || '', c.aceite || '', c.motivo || '', c.comment,
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([detailHdr.map(h => ({ v: h, s: hdr })), ...detailRows])
    ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 5 }, { wch: 13 }, { wch: 14 }, { wch: 44 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalhe')

    XLSX.writeFile(wb, `mapa_mensal_kyc_${year}_${pad(month + 1)}.xlsx`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[780px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-[14px] font-semibold text-gray-900">Mapa Mensal — Compliance (KYC/Onboarding)</span>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[12px] font-medium text-gray-600">Mês de reporte:</label>
            <select className="form-input py-1 text-[12px] w-36" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <input type="number" className="form-input py-1 text-[12px] w-20" value={year} min={2020} max={2035} onChange={e => setYear(Number(e.target.value))} />
            <span className="text-[11px] text-gray-400">{startStr} → {endStr}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <table className="w-full text-[12px] border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white text-[10px]">
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-center font-medium w-10">Nº</th>
                    <th className="px-3 py-2 text-center font-medium w-10">%</th>
                    <th className="px-3 py-2 text-center font-medium w-12">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Aprovados (entrados no mês)',   n: aprovados.length,  prev: prevAprov,  taxa: taxaAprov,  row: 'bg-blue-50 text-blue-900',    val: 'text-blue-700',   good:  1 },
                    { label: 'Em Revisão (entrados no mês)', n: emRevisao.length,  prev: prevEmRev,  taxa: taxaEmRev,  row: 'bg-amber-50 text-amber-900',  val: 'text-amber-700',  good: -1 },
                    { label: 'Pendentes (entrados no mês)',  n: pendentes.length,  prev: prevPend,   taxa: taxaPend,   row: 'bg-purple-50 text-purple-900', val: 'text-purple-700', good: -1 },
                    { label: 'Recusados (entrados no mês)',  n: recusados.length,  prev: prevRecus,  taxa: taxaRecusa, row: 'bg-gray-50 text-gray-700',     val: 'text-gray-700',   good: -1 },
                  ].map(({ label, n, prev, taxa, row, val, good }) => {
                    const diff = n - prev
                    const diffCls = diff === 0 ? 'text-gray-400' : (diff * good > 0 ? 'text-green-600' : 'text-red-500')
                    return (
                      <tr key={label} className={`border-b border-gray-100 ${row}`}>
                        <td className="px-3 py-2 font-medium text-[11px]">{label}</td>
                        <td className={`px-3 py-2 text-center font-bold ${val}`}>{n}</td>
                        <td className="px-3 py-2 text-center text-gray-500 text-[10px]">{taxa}</td>
                        <td className={`px-3 py-2 text-center text-[10px] font-semibold ${diffCls}`}>{diff > 0 ? '+' : ''}{diff}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-[#dde6f0]">
                    <td className="px-3 py-2 font-bold text-[11px] text-gray-800">Total</td>
                    <td className="px-3 py-2 text-center font-bold text-gray-800">{total}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>

              <div className="space-y-1.5 text-[12px]">
                {([
                  ['Taxa de aprovação', taxaAprov,  'font-bold text-blue-700'],
                  ['Taxa de revisão',   taxaEmRev,  'font-bold text-amber-600'],
                  ['Taxa pendentes',    taxaPend,   'font-bold text-purple-700'],
                  ['Taxa de recusa',    taxaRecusa, 'font-bold text-gray-600'],
                ] as [string, string, string][]).map(([label, val, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-600">{label}</span>
                    <span className={cls}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-gray-500 text-center mb-1">Distribuição ({monthLabel})</div>
              {total === 0 ? (
                <div className="flex items-center justify-center h-44 text-gray-300 text-[12px]">Sem dados para este mês</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={72}
                      label={({ name, value, percent }: { name: string; value: number; percent: number }) => `${name}: ${value} (${Math.round(percent * 100)}%)`}
                      labelLine={false} fontSize={9}>
                      {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-col gap-1.5 mt-2">
                {[
                  { name: 'Aprovados',  n: aprovados.length,  color: '#2563eb' },
                  { name: 'Em Revisão', n: emRevisao.length,  color: '#d97706' },
                  { name: 'Recusados',  n: recusados.length,  color: '#9ca3af' },
                ].map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-[11px] text-gray-600">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                    {d.name}: <span className="font-semibold">{d.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setPersonalizar(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-[12px] font-medium text-gray-700">
              <span>Personalizar reporte</span>
              <ChevronDown size={13} className={`transition-transform ${personalizar ? 'rotate-180' : ''}`} />
            </button>
            {personalizar && (
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-gray-500">Tabelas adicionais a incluir no Excel exportado:</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    [extRisco,  setExtRisco,  'Distribuição por Nível de Risco AML'],
                    [extTipo,   setExtTipo,   'Distribuição por Tipo de Cliente'],
                    [extFundo,  setExtFundo,  'Distribuição por Fundo'],
                    [extMotivo, setExtMotivo, 'Motivos de recusa / incompletude'],
                  ] as [boolean, (v: boolean) => void, string][]).map(([val, setter, label]) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                      <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-outline btn-sm">Fechar</button>
          <button onClick={exportXlsx} disabled={total === 0} className="btn btn-primary btn-sm gap-1.5">
            <Download size={12} /> Exportar Excel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Estatísticas Tab ─────────────────────────────────────────────────────────
function EstatisticasTab({ clients }: { clients: KYCClient[] }) {
  const [showMapa,   setShowMapa]   = useState(false)
  const [filterYear, setFilterYear] = useState<number | 'all'>('all')
  const chartRef1 = useRef<HTMLDivElement>(null)
  const chartRef2 = useRef<HTMLDivElement>(null)
  const chartRef3 = useRef<HTMLDivElement>(null)

  const years = useMemo(() => {
    const ys = new Set<number>()
    clients.forEach(c => {
      if (c.entrada) ys.add(new Date(c.entrada).getFullYear())
      if (c.aceite)  ys.add(new Date(c.aceite).getFullYear())
    })
    return Array.from(ys).sort()
  }, [clients])

  const filtered = useMemo(() =>
    filterYear === 'all' ? clients : clients.filter(c => {
      const y = c.entrada ? new Date(c.entrada).getFullYear() : null
      return y === filterYear
    }),
    [clients, filterYear]
  )

  const total     = filtered.length
  const aceites   = filtered.filter(c => c.status === 'Aceite').length
  const emRevisao = filtered.filter(c => c.status === 'Em Revisão').length
  const pendentes = filtered.filter(c => c.status === 'Pendente').length
  const recusados = filtered.filter(c => c.status === 'Recusado').length
  const peps      = filtered.filter(c => c.pep).length

  const statusData = [
    { name: 'Aceite',     value: aceites,   color: STATUS_COLOR['Aceite'] },
    { name: 'Em Revisão', value: emRevisao, color: STATUS_COLOR['Em Revisão'] },
    { name: 'Pendente',   value: pendentes, color: STATUS_COLOR['Pendente'] },
    { name: 'Recusado',   value: recusados, color: STATUS_COLOR['Recusado'] },
  ].filter(d => d.value > 0)

  const riscoData = [
    { name: 'Baixo', value: filtered.filter(c => c.risk === 'Baixo').length, color: RISK_COLOR['Baixo'] },
    { name: 'Médio', value: filtered.filter(c => c.risk === 'Médio').length, color: RISK_COLOR['Médio'] },
    { name: 'Alto',  value: filtered.filter(c => c.risk === 'Alto').length,  color: RISK_COLOR['Alto'] },
  ]

  const monthlyData = MONTHS_SHORT.map((m, i) => ({
    name: m,
    value: filtered.filter(c => c.entrada && new Date(c.entrada).getMonth() === i).length,
  }))

  const fundCounts: Record<string, number> = {}
  filtered.forEach(c => c.funds.forEach(f => { fundCounts[f] = (fundCounts[f] || 0) + 1 }))
  const fundData = Object.entries(fundCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  const typeData = [
    { name: 'Singular',      value: filtered.filter(c => c.type === 'Pessoa Singular').length },
    { name: 'Coletiva',      value: filtered.filter(c => c.type === 'Pessoa Coletiva').length },
    { name: 'Institucional', value: filtered.filter(c => c.type === 'Investidor Institucional').length },
  ].filter(d => d.value > 0)

  const allDocs    = filtered.flatMap(c => c.docs)
  const docOk      = allDocs.filter(d => d.s === 'ok').length
  const docMissing = allDocs.filter(d => d.s === 'missing').length
  const docExpired = allDocs.filter(d => d.s === 'expired').length

  const motivoCounts: Record<string, number> = {}
  filtered.forEach(c => { if (c.motivo) { motivoCounts[c.motivo] = (motivoCounts[c.motivo] || 0) + 1 } })

  const periodLabel = filterYear === 'all' ? 'Todos os anos' : String(filterYear)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select
          className="form-input py-1 text-[12px] w-36"
          value={filterYear === 'all' ? 'all' : String(filterYear)}
          onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">Todos os anos</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={() => exportExcel(filtered, periodLabel)} className="btn btn-outline btn-sm gap-1.5">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => exportPDF(filtered, periodLabel, [chartRef1, chartRef2, chartRef3])} className="btn btn-outline btn-sm gap-1.5">
            <FileText size={13} /> PDF
          </button>
          <button onClick={() => setShowMapa(true)} className="btn btn-primary btn-sm gap-1.5">
            <Calendar size={13} /> Mapa Mensal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="Total Clientes" value={total}     color="blue"  />
        <KpiCard label="Aceites"        value={aceites}   color="green" />
        <KpiCard label="Em Revisão"     value={emRevisao} color="amber" />
        <KpiCard label="Pendentes"      value={pendentes} color="blue"  />
        <KpiCard label="Recusados"      value={recusados} color="red"   />
        <KpiCard label="PEPs"           value={peps}      color="red"   />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Estado KYC</div>
          <div ref={chartRef1}>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-300 text-[12px]">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={60} fontSize={9}>
                    {statusData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-col gap-1 mt-2">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                    <span className="text-gray-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Risco AML</div>
          <div ref={chartRef2}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={riscoData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {riscoData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Entradas Mensais</div>
          <div ref={chartRef3}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 col-span-2">
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Distribuição por Fundo (top 10)</div>
          {fundData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-300 text-[12px]">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fundData} layout="vertical" barSize={12} margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={96} />
                <Tooltip />
                <Bar dataKey="value" fill="#1e3a5f" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-[12px] font-semibold text-gray-700 mb-2">Tipo de Cliente</div>
            <div className="space-y-1.5">
              {typeData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-[12px] font-semibold text-gray-700 mb-2">Documentação</div>
            <div className="space-y-1.5">
              {[
                { label: 'OK',       n: docOk,      cls: 'text-green-600' },
                { label: 'Em falta', n: docMissing, cls: 'text-gray-500'  },
                { label: 'Expirado', n: docExpired, cls: 'text-amber-600' },
              ].map(d => (
                <div key={d.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-600">{d.label}</span>
                  <span className={`font-semibold ${d.cls}`}>{d.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {Object.keys(motivoCounts).length > 0 && (
        <div className="card p-4">
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Motivos de Recusa / Incompletude</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(motivoCounts).sort((a, b) => b[1] - a[1]).map(([motivo, n]) => (
              <div key={motivo} className="flex items-center justify-between text-[11px] py-1.5 px-2 bg-gray-50 rounded-lg">
                <span className="text-gray-600 truncate mr-2">{motivo}</span>
                <span className="font-semibold text-gray-800 flex-shrink-0">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMapa && <MapaMensalModal clients={clients} onClose={() => setShowMapa(false)} />}
    </div>
  )
}
// ─── Predefined fund list ──────────────────────────────────────────────────────
const PREDEFINED_FUNDS = [
  'BCIF I', 'Viriatus', 'BCG I', 'BCIF II', 'BCN I', 'BCIF III', 'BCIF IV',
  'BC Impact', 'BCNT I', 'BCIF V', 'GGT',
  'BCDF I / A', 'BCDF I / B', 'BCDF I / C', 'BCDF I / D', 'BCDF I / E',
  'BC Global Opp. PPR', 'BC Listed Property', 'BC Global Discovery',
  'BC Short Term', 'BC Portugal Select', 'BC Trade Finance',
  'Gestão de Carteiras',
]

// ─── KYC/AML Excel import header map ──────────────────────────────────────────
const KYC_XLS_MAP: Record<string, keyof Omit<KYCClient, 'id' | 'docs' | 'funds'> | 'funds_str'> = {
  'nome': 'name', 'name': 'name', 'cliente': 'name',
  'nif': 'nif', 'nipc': 'nif',
  'tipo': 'type', 'tipo cliente': 'type', 'tipo_cliente': 'type',
  'nacionalidade': 'nat', 'nat': 'nat',
  'domicilio': 'dom', 'domicílio': 'dom', 'dom': 'dom',
  'ubo': 'ubo', 'beneficiario efetivo': 'ubo', 'beneficiário efetivo': 'ubo',
  'investimento': 'inv', 'inv': 'inv', 'montante': 'inv',
  'fundos': 'funds_str', 'funds': 'funds_str', 'fundo': 'funds_str',
  'risco': 'risk', 'risco aml': 'risk', 'nivel risco': 'risk', 'nível risco': 'risk',
  'estado': 'status', 'status': 'status', 'estado kyc': 'status',
  'pep': 'pep',
  'entrada': 'entrada', 'data entrada': 'entrada', 'data_entrada': 'entrada',
  'aceitacao': 'aceite', 'aceitação': 'aceite', 'data aceitacao': 'aceite', 'data aceitação': 'aceite',
  'notas': 'comment', 'comentario': 'comment', 'comentário': 'comment',
}

function normalizeKYCHeader(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function PBCFT() {
  const { clients, deleteClient, addClient, updateClient } = useStore()
  const [tab, setTab] = useState(0)
  const [importingKYC, setImportingKYC] = useState(false)
  const kycFileRef = useRef<HTMLInputElement>(null)

  // ── New/Edit client modal ──
  const EMPTY_CLIENT: Omit<KYCClient, 'id'> = {
    name: '', type: 'Pessoa Singular', nif: '', nat: '', dom: '', ubo: '',
    inv: '', funds: [], risk: 'Baixo', status: 'Pendente',
    pep: false, entrada: null, aceite: null, comment: '', motivo: '',
    docs: PREDEFINED_DOCS.map(n => ({ n, s: 'missing' as const })),
  }
  const [clientModal,   setClientModal]   = useState(false)
  const [editingClient, setEditingClient] = useState<KYCClient | null>(null)
  const [clientForm,    setClientForm]    = useState<Omit<KYCClient, 'id'>>(EMPTY_CLIENT)

  function toggleFund(f: string) {
    setClientForm(prev => ({
      ...prev,
      funds: prev.funds.includes(f) ? prev.funds.filter(x => x !== f) : [...prev.funds, f],
    }))
  }

  function openNewClient() {
    setEditingClient(null)
    setClientForm(EMPTY_CLIENT)
    setClientModal(true)
  }

  function openEditClient(c: KYCClient) {
    setEditingClient(c)
    setClientForm({ name: c.name, type: c.type, nif: c.nif, nat: c.nat, dom: c.dom,
      ubo: c.ubo, inv: c.inv, funds: c.funds, risk: c.risk, status: c.status,
      pep: c.pep, entrada: c.entrada, aceite: c.aceite, comment: c.comment,
      motivo: c.motivo ?? '', docs: c.docs })
    setClientModal(true)
  }

  async function saveClient() {
    const data = { ...clientForm }
    if (editingClient) {
      await updateClient(editingClient.id, data)
    } else {
      await addClient({ id: `KYC-${Date.now()}`, ...data })
    }
    setClientModal(false)
  }

  function handleImportKYC(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingKYC(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target!.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const rec: Record<string, unknown> = {}
          for (const [col, val] of Object.entries(row)) {
            const norm = normalizeKYCHeader(col)
            const field = KYC_XLS_MAP[norm]
            if (field) rec[field] = val != null ? String(val) : ''
          }
          if (!rec['name']) continue
          const fundsRaw = String(rec['funds_str'] ?? '')
          const funds = fundsRaw ? fundsRaw.split(/[;,]/).map(f => f.trim()).filter(Boolean) : []
          const pepRaw = String(rec['pep'] ?? '').toLowerCase()
          const validTypes = ['Pessoa Coletiva', 'Pessoa Singular', 'Investidor Institucional']
          const validRisks = ['Baixo', 'Médio', 'Alto']
          const validStatus = ['Aceite', 'Em Revisão', 'Pendente', 'Recusado']
          const client: KYCClient = {
            id: `KYC-IMP-${Date.now()}-${i}`,
            name: String(rec['name'] ?? ''),
            type: validTypes.includes(String(rec['type'])) ? rec['type'] as KYCClient['type'] : 'Pessoa Singular',
            nif: String(rec['nif'] ?? ''),
            nat: String(rec['nat'] ?? ''),
            dom: String(rec['dom'] ?? ''),
            ubo: String(rec['ubo'] ?? ''),
            inv: String(rec['inv'] ?? ''),
            funds,
            risk: validRisks.includes(String(rec['risk'])) ? rec['risk'] as KYCClient['risk'] : 'Baixo',
            status: validStatus.includes(String(rec['status'])) ? rec['status'] as KYCClient['status'] : 'Pendente',
            pep: ['sim', 'yes', '1', 'true'].includes(pepRaw),
            entrada: String(rec['entrada'] ?? '') || null,
            aceite: String(rec['aceite'] ?? '') || null,
            comment: String(rec['comment'] ?? ''),
            docs: [],
          }
          await addClient(client)
        }
        alert(`Importação concluída: ${rows.length} linha(s) processadas.`)
      } catch {
        alert('Erro ao ler o ficheiro Excel.')
      } finally {
        setImportingKYC(false)
        if (kycFileRef.current) kycFileRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Filters
  const [search,        setSearch]        = useState('')
  const [filterRisk,    setFilterRisk]    = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterPep,     setFilterPep]     = useState('')
  const [filterFund,    setFilterFund]    = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')

  const [selected,     setSelected]     = useState<KYCClient | null>(null)
  const [showExport,   setShowExport]   = useState(false)
  const [exporting,    setExporting]    = useState(false)

  // Chart refs for PDF capture
  const statusChartRef  = useRef<HTMLDivElement>(null)
  const riskChartRef    = useRef<HTMLDivElement>(null)
  const monthlyChartRef = useRef<HTMLDivElement>(null)

  // Unique fund options
  const allFunds = useMemo(() => {
    const s = new Set<string>()
    clients.forEach(c => c.funds.forEach(f => s.add(f)))
    return [...s].sort()
  }, [clients])

  // Apply all filters
  const filtered = useMemo(() => clients.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !c.nif.toLowerCase().includes(q)) return false
    if (filterRisk   && c.risk !== filterRisk)     return false
    if (filterStatus && c.status !== filterStatus) return false
    if (filterType   && c.type !== filterType)     return false
    if (filterPep === 'Sim' && !c.pep)             return false
    if (filterPep === 'Não' && c.pep)              return false
    if (filterFund   && !c.funds.includes(filterFund)) return false
    if (filterFrom || filterTo) {
      if (!c.entrada) return false
      const d = new Date(c.entrada)
      if (filterFrom && d < new Date(filterFrom)) return false
      if (filterTo   && d > new Date(filterTo))   return false
    }
    return true
  }), [clients, search, filterRisk, filterStatus, filterType, filterPep, filterFund, filterFrom, filterTo])

  const hasFilters = !!(search || filterRisk || filterStatus || filterType || filterPep || filterFund || filterFrom || filterTo)

  function clearFilters() {
    setSearch(''); setFilterRisk(''); setFilterStatus(''); setFilterType('')
    setFilterPep(''); setFilterFund(''); setFilterFrom(''); setFilterTo('')
  }

  // Quick period helpers
  function setThisMonth() {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    setFilterFrom(`${y}-${String(m+1).padStart(2,'0')}-01`)
    setFilterTo(`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`)
  }
  function setThisQuarter() {
    const now = new Date()
    const q = Math.floor(now.getMonth() / 3)
    const y = now.getFullYear()
    setFilterFrom(`${y}-${String(q*3+1).padStart(2,'0')}-01`)
    setFilterTo(now.toISOString().slice(0,10))
  }
  function setThisYear() {
    const y = new Date().getFullYear()
    setFilterFrom(`${y}-01-01`)
    setFilterTo(`${y}-12-31`)
  }

  // Period label for exports
  const periodLabel = useMemo(() => {
    if (filterFrom || filterTo) {
      const fmt = (s: string) => s ? new Date(s).toLocaleDateString('pt-PT') : '—'
      return `${fmt(filterFrom)} a ${fmt(filterTo)}`
    }
    return 'Todos os períodos'
  }, [filterFrom, filterTo])

  // KPIs (from filtered)
  const total    = filtered.length
  const aceites  = filtered.filter(c => c.status === 'Aceite').length
  const revisao  = filtered.filter(c => c.status === 'Em Revisão').length
  const pendente = filtered.filter(c => c.status === 'Pendente').length

  // Chart data (from filtered)
  const statusData = [
    { name: 'Aceite',     value: aceites,  color: '#16a34a' },
    { name: 'Em Revisão', value: revisao,  color: '#d97706' },
    { name: 'Pendente',   value: pendente, color: '#3b82f6' },
    { name: 'Recusado',   value: filtered.filter(c => c.status === 'Recusado').length, color: '#dc2626' },
  ].filter(d => d.value > 0)

  const riskData = [
    { name: 'Baixo', value: filtered.filter(c => c.risk === 'Baixo').length, fill: '#16a34a' },
    { name: 'Médio', value: filtered.filter(c => c.risk === 'Médio').length, fill: '#d97706' },
    { name: 'Alto',  value: filtered.filter(c => c.risk === 'Alto').length,  fill: '#dc2626' },
  ]

  const monthlyData = MONTHS_SHORT.map((m, i) => ({
    name: m,
    value: filtered.filter(c => c.entrada && new Date(c.entrada).getMonth() === i).length,
  }))

  const handleExportExcel = useCallback(() => {
    setShowExport(false)
    exportExcel(filtered, periodLabel)
  }, [filtered, periodLabel])

  const handleExportPDF = useCallback(async () => {
    setShowExport(false)
    setExporting(true)
    try {
      await exportPDF(filtered, periodLabel, [statusChartRef, riskChartRef, monthlyChartRef])
    } finally {
      setExporting(false)
    }
  }, [filtered, periodLabel])

  return (
    <div className="p-6 space-y-4">
      {/* KPIs — reflect filtered data, clickable to filter */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total Clientes" value={total}    sub={hasFilters ? 'clique para limpar' : 'em base de dados'} color="blue"
          onClick={() => clearFilters()} active={false} />
        <KpiCard label="Aceites"        value={aceites}  sub="KYC completo"    color="green" trend="up"
          onClick={() => setFilterStatus(filterStatus === 'Aceite'     ? '' : 'Aceite')}
          active={filterStatus === 'Aceite'} />
        <KpiCard label="Em Revisão"     value={revisao}  sub="docs pendentes"  color="amber" trend="neutral"
          onClick={() => setFilterStatus(filterStatus === 'Em Revisão' ? '' : 'Em Revisão')}
          active={filterStatus === 'Em Revisão'} />
        <KpiCard label="Pendentes"      value={pendente} sub="aguardam análise" color="red"  trend="down"
          onClick={() => setFilterStatus(filterStatus === 'Pendente'   ? '' : 'Pendente')}
          active={filterStatus === 'Pendente'} />
      </div>

      {/* Tabs */}
      <div className="tab-list">
        {TABS.map((t, i) => (
          <button key={t} data-state={tab === i ? 'active' : ''} className="tab-trigger" onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <div className="space-y-4">
          {/* Charts — react to filtered */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="card-title mb-3">Estado KYC</div>
              <div ref={statusChartRef}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {statusData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {statusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <div className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="card-title mb-3">Risco AML</div>
              <div ref={riskChartRef}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={riskData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[3,3,0,0]}>
                      {riskData.map(d => <Cell key={d.name} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <div className="card-title mb-3">Entradas Mensais</div>
              <div ref={monthlyChartRef}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">{selected.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{selected.nif} · {selected.nat} · {selected.dom}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[11px] text-gray-400 border border-gray-200 rounded px-2 py-0.5 hover:bg-gray-100">
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-3 text-[12px] mb-3">
                {([
                  ['Tipo', selected.type],
                  ['Investimento', selected.inv],
                  ['Risco AML', <Badge variant={selected.risk === 'Alto' ? 'red' : selected.risk === 'Médio' ? 'amber' : 'green'}>{selected.risk}</Badge>],
                  ['Estado', <Badge variant={estadoVariant(selected.status)}>{selected.status}</Badge>],
                  ['PEP', selected.pep ? <Badge variant="red">Sim</Badge> : <Badge variant="gray">Não</Badge>],
                ] as [string, React.ReactNode][]).map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[10px] text-gray-400 font-medium uppercase mb-1">{label}</div>
                    <div>{val}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-gray-400 font-medium uppercase mb-2">Fundos</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.funds.map(f => <span key={f} className="text-[10px] font-medium bg-[#1e3a5f] text-white px-2 py-0.5 rounded">{f}</span>)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-medium uppercase mb-2">Documentos</div>
                  <div className="flex flex-col gap-1">
                    {selected.docs.map(d => (
                      <div key={d.n} className="flex items-center justify-between text-[11px]">
                        <span>{d.n}</span>
                        <Badge variant={d.s === 'ok' ? 'green' : d.s === 'expired' ? 'amber' : 'red'}>
                          {d.s === 'ok' ? 'OK' : d.s === 'expired' ? 'Expirado' : 'Em falta'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {selected.comment && (
                <div className="mt-3 p-2.5 bg-gray-50 rounded text-[11px] text-gray-600">{selected.comment}</div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Base de Dados KYC</span>
              <div className="flex items-center gap-2">
                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExport(v => !v)}
                    disabled={exporting}
                    className="btn btn-outline btn-sm flex items-center gap-1"
                  >
                    <Download size={12} />
                    {exporting ? 'A gerar...' : 'Exportar'}
                    <ChevronDown size={11} />
                  </button>
                  {showExport && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileSpreadsheet size={13} className="text-green-600" />
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="w-full text-left px-4 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileText size={13} className="text-red-500" />
                        Relatório PDF
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => kycFileRef.current?.click()}
                  disabled={importingKYC}
                  className="btn btn-outline btn-sm flex items-center gap-1"
                >
                  <Upload size={12} /> {importingKYC ? 'A importar...' : 'Importar Excel'}
                </button>
                <input ref={kycFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportKYC} />
                <button onClick={openNewClient} className="btn btn-primary btn-sm flex items-center gap-1">
                  <Plus size={12} /> Novo Cliente
                </button>
              </div>
            </div>

            {/* ── Filter bar ── */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-200 space-y-2">
              {/* Row 1: search + selects */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                  <Search size={12} className="text-gray-400 flex-shrink-0" />
                  <input
                    placeholder="Pesquisar nome ou NIF..."
                    className="bg-transparent text-[12px] outline-none flex-1 text-gray-700"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select className="form-input text-[12px] py-1 w-32" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                  <option value="">Todos os Riscos</option>
                  <option>Baixo</option><option>Médio</option><option>Alto</option>
                </select>
                <select className="form-input text-[12px] py-1 w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Todos os Estados</option>
                  <option>Aceite</option><option>Em Revisão</option><option>Pendente</option><option>Recusado</option>
                </select>
                <select className="form-input text-[12px] py-1 w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">Todos os Tipos</option>
                  <option>Pessoa Coletiva</option>
                  <option>Pessoa Singular</option>
                  <option>Investidor Institucional</option>
                </select>
                <select className="form-input text-[12px] py-1 w-28" value={filterPep} onChange={e => setFilterPep(e.target.value)}>
                  <option value="">PEP — Todos</option>
                  <option value="Sim">PEP — Sim</option>
                  <option value="Não">PEP — Não</option>
                </select>
                {allFunds.length > 0 && (
                  <select className="form-input text-[12px] py-1 w-36" value={filterFund} onChange={e => setFilterFund(e.target.value)}>
                    <option value="">Todos os Fundos</option>
                    {allFunds.map(f => <option key={f}>{f}</option>)}
                  </select>
                )}
              </div>

              {/* Row 2: date range + quick presets */}
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-gray-400" />
                  <span className="text-[11px] text-gray-500">Entrada:</span>
                </div>
                <input
                  type="date"
                  className="form-input text-[12px] py-1 w-36"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                />
                <span className="text-[11px] text-gray-400">até</span>
                <input
                  type="date"
                  className="form-input text-[12px] py-1 w-36"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                />
                <div className="flex gap-1 ml-1">
                  <button onClick={setThisMonth}   className="text-[10px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center gap-1"><Filter size={9} />Este mês</button>
                  <button onClick={setThisQuarter} className="text-[10px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center gap-1"><Filter size={9} />Trimestre</button>
                  <button onClick={setThisYear}    className="text-[10px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center gap-1"><Filter size={9} />Este ano</button>
                </div>
                {hasFilters && (
                  <button onClick={clearFilters} className="btn btn-outline btn-sm ml-auto flex items-center gap-1">
                    <X size={11} /> Limpar filtros
                  </button>
                )}
              </div>

              {/* Active filter summary */}
              {hasFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-400">Filtros ativos:</span>
                  {filterFrom || filterTo ? <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{periodLabel}</span> : null}
                  {filterRisk    && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{filterRisk}</span>}
                  {filterStatus  && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{filterStatus}</span>}
                  {filterType    && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{filterType}</span>}
                  {filterPep     && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">PEP: {filterPep}</span>}
                  {filterFund    && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{filterFund}</span>}
                  <span className="text-[10px] text-gray-400 ml-auto">{filtered.length} de {clients.length} clientes</span>
                </div>
              )}
            </div>

            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Nome</th><th>NIF</th><th>Tipo</th><th>Fundos</th>
                  <th>Risco AML</th><th>Estado KYC</th><th>PEP</th>
                  <th>Entrada</th><th>Aceitação</th><th>Motivo</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelected(c)} className={selected?.id === c.id ? 'bg-blue-50' : ''}>
                    <td className="font-medium text-gray-900">{c.name}</td>
                    <td className="text-gray-400 text-[11px] font-mono">{c.nif || '—'}</td>
                    <td className="text-gray-500 text-[11px]">{c.type}</td>
                    <td>
                      <div className="flex flex-wrap gap-0.5">
                        {c.funds.slice(0,2).map(f => (
                          <span key={f} className="text-[9px] font-medium bg-[#1e3a5f] text-white px-1.5 py-0.5 rounded">
                            {f.split(' ').slice(0,2).join(' ')}
                          </span>
                        ))}
                        {c.funds.length > 2 && <span className="text-[9px] text-gray-400">+{c.funds.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: RISK_COLOR[c.risk] }} />
                        <span className="text-[11px]">{c.risk}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[c.status] ?? '#9ca3af' }} />
                        <Badge variant={estadoVariant(c.status)}>{c.status}</Badge>
                      </div>
                    </td>
                    <td>{c.pep ? <Badge variant="red">Sim</Badge> : <span className="text-[11px] text-gray-400">Não</span>}</td>
                    <td className="text-gray-400 text-[11px]">{c.entrada ?? '—'}</td>
                    <td className="text-gray-400 text-[11px]">{c.aceite ?? '—'}</td>
                    <td className="text-gray-400 text-[11px] max-w-[160px] truncate" title={c.motivo ?? ''}>{c.motivo || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => openEditClient(c)} className="text-gray-400 hover:text-blue-600"><Pencil size={12} /></button>
                        <button
                          onClick={() => { if (confirm(`Eliminar cliente "${c.name}"?`)) { if (selected?.id === c.id) setSelected(null); deleteClient(c.id) } }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="text-center text-gray-400 py-8">
                    {hasFilters ? 'Nenhum cliente corresponde aos filtros aplicados.' : 'Nenhum cliente encontrado.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 5 && <EstatisticasTab clients={clients} />}

      {tab > 0 && tab !== 5 && (
        <div className="card p-12 text-center">
          <div className="text-[13px] font-medium text-gray-700 mb-2">{TABS[tab]}</div>
          <div className="text-[12px] text-gray-400 mb-4">
            {['','Registo de comunicações ao DCIAP/UIF.','Registo de exames de transações suspeitas.','Registo de recusas de operações.','Modelos e templates oficiais PBC/FT.','','Ações de formação PBC/FT.'][tab]}
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-1"><Plus size={12} /> Adicionar registo</button>
        </div>
      )}

      {/* ── New / Edit Client Modal — full screen ── */}
      {clientModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-stretch justify-end">
          <div className="bg-white w-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-[#1e3a5f] flex-shrink-0">
              <span className="text-[15px] font-semibold text-white">{editingClient ? 'Editar Cliente KYC' : 'Novo Cliente KYC'}</span>
              <button onClick={() => setClientModal(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>

            {/* Body — 3-column layout */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-6 h-full">

                {/* ── Col 1: Identificação ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">Identificação</p>
                  <div>
                    <label className="form-label">Nome completo *</label>
                    <input className="form-input" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="Nome do cliente" />
                  </div>
                  <div>
                    <label className="form-label">Tipo de cliente</label>
                    <select className="form-input" value={clientForm.type} onChange={e => setClientForm({...clientForm, type: e.target.value as KYCClient['type']})}>
                      <option>Pessoa Singular</option>
                      <option>Pessoa Coletiva</option>
                      <option>Investidor Institucional</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">NIF / NIPC</label>
                    <input className="form-input" value={clientForm.nif} onChange={e => setClientForm({...clientForm, nif: e.target.value})} placeholder="000 000 000" />
                  </div>
                  <div>
                    <label className="form-label">Nacionalidade</label>
                    <SearchCombobox
                      value={clientForm.nat}
                      onChange={v => setClientForm({...clientForm, nat: v})}
                      options={NATIONALITIES}
                      placeholder="ex: Portuguesa"
                    />
                  </div>
                  <div>
                    <label className="form-label">Domicílio fiscal</label>
                    <SearchCombobox
                      value={clientForm.dom}
                      onChange={v => setClientForm({...clientForm, dom: v})}
                      options={COUNTRIES}
                      placeholder="ex: Portugal"
                    />
                  </div>
                  <div>
                    <label className="form-label">UBO (Beneficiário Efetivo)</label>
                    <input className="form-input" value={clientForm.ubo} onChange={e => setClientForm({...clientForm, ubo: e.target.value})} />
                  </div>
                  <div>
                    <label className="form-label">Investimento</label>
                    <input className="form-input" value={clientForm.inv} onChange={e => setClientForm({...clientForm, inv: e.target.value})} placeholder="ex: 500.000 €" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input type="checkbox" id="pep-chk" checked={clientForm.pep} onChange={e => setClientForm({...clientForm, pep: e.target.checked})} className="w-4 h-4 accent-blue-600" />
                    <label htmlFor="pep-chk" className="text-[12px] text-gray-700 cursor-pointer font-medium">Pessoa Politicamente Exposta (PEP)</label>
                  </div>

                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5 pt-3">Classificação KYC</p>
                  <div>
                    <label className="form-label">Risco AML</label>
                    <select className="form-input" value={clientForm.risk} onChange={e => setClientForm({...clientForm, risk: e.target.value as KYCClient['risk']})}>
                      <option>Baixo</option><option>Médio</option><option>Alto</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Estado KYC</label>
                    <select className="form-input" value={clientForm.status} onChange={e => setClientForm({...clientForm, status: e.target.value as KYCClient['status']})}>
                      <option>Pendente</option><option>Em Revisão</option><option>Aceite</option><option>Recusado</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Data de entrada</label>
                    <input type="date" className="form-input" value={clientForm.entrada ?? ''} onChange={e => setClientForm({...clientForm, entrada: e.target.value || null})} />
                  </div>
                  <div>
                    <label className="form-label">Data de aceitação</label>
                    <input type="date" className="form-input" value={clientForm.aceite ?? ''} onChange={e => setClientForm({...clientForm, aceite: e.target.value || null})} />
                  </div>
                  <div>
                    <label className="form-label">Motivo de recusa / incompletude</label>
                    <select className="form-input" value={clientForm.motivo ?? ''} onChange={e => setClientForm({...clientForm, motivo: e.target.value})}>
                      <option value="">— Não aplicável —</option>
                      {MOTIVOS_RECUSA.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Notas</label>
                    <textarea className="form-input" rows={3} value={clientForm.comment} onChange={e => setClientForm({...clientForm, comment: e.target.value})} />
                  </div>
                </div>

                {/* ── Col 2: Fundos ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">
                    Fundos {clientForm.funds.length > 0 && <span className="text-blue-600 normal-case font-normal">— {clientForm.funds.length} selecionado{clientForm.funds.length > 1 ? 's' : ''}</span>}
                  </p>
                  <div className="grid grid-cols-1 gap-1">
                    {PREDEFINED_FUNDS.map(f => (
                      <label key={f} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-[12px] ${clientForm.funds.includes(f) ? 'bg-blue-50 border-blue-300 text-blue-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={clientForm.funds.includes(f)} onChange={() => toggleFund(f)} className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── Col 3: Documentação ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">
                    Documentação
                    <span className="ml-2 normal-case font-normal text-gray-400">
                      {clientForm.docs.filter(d => d.s === 'ok').length}/{clientForm.docs.length} recebidos
                    </span>
                  </p>
                  <div className="space-y-2">
                    {clientForm.docs.map((doc, i) => {
                      const cycle = () => {
                        const next = DOC_STATUS_CYCLE[(DOC_STATUS_CYCLE.indexOf(doc.s) + 1) % DOC_STATUS_CYCLE.length]
                        const docs = clientForm.docs.map((d, j) => j === i ? { ...d, s: next } : d)
                        setClientForm({ ...clientForm, docs })
                      }
                      return (
                        <button key={doc.n} onClick={cycle} type="button"
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-colors ${DOC_STATUS_CLS[doc.s]}`}>
                          <span>{doc.n}</span>
                          <span className="text-[11px] opacity-80 font-semibold">{DOC_STATUS_LABEL[doc.s]}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Clique em cada documento para alternar: Em falta → OK → Expirado</p>
                </div>

              </div>{/* end 3-col grid */}
            </div>{/* end body */}

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button onClick={() => setClientModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveClient} disabled={!clientForm.name} className="btn btn-primary btn-sm">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
