import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import { Plus, X, Building2, ChevronRight, Landmark, BarChart3, Download, Upload, FileText, Trash2, Search, Eye, Coins, Package, Cpu, Zap, HelpCircle, GitCompareArrows } from 'lucide-react'
import { Comparacao } from './Comparacao'
import { Pipeline, type PipelineItem } from './Pipeline'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'

type OIATab = 'portfolio' | 'investimentos' | 'desinvestimentos' | 'comparacao'

// ── Types ─────────────────────────────────────────────────────────────────────
type AssetType     = 'Empresa' | 'Ativo Mobiliário' | 'Ativo Imobiliário' | 'Instrumento de Dívida' | 'Infraestrutura' | 'Matéria-Prima' | 'Direitos de PI' | 'Criptoativo' | 'Outro'
type FundType      = 'FCR' | 'FIAA' | 'PPR'
type FundStatus    = 'Ativo' | 'Em liquidação' | 'Fechado'
type CompanyStatus = 'Ativa' | 'Em saída' | 'Alienada'
type AssetStatus   = 'Ativo' | 'Em saída' | 'Alienado'
type TrancheType   = 'Equity' | 'CLN' | 'SAFE' | 'Mútuo' | 'Prest. Suplementares' | 'Outro'
type CatId         = 'fcr' | 'mob' | 'esp'
type GroupId       = 'bcif' | 'dev'

interface OIAFile {
  id: string
  name: string
  size: string
  type: 'word' | 'excel' | 'pdf' | 'other'
  uploadedAt: string
  data: string
}

interface Asset {
  id: string; assetType: AssetType; name: string
  sector: string; country: string; stake: string
  ticker: string; assetClass: string; quantity: string
  location: string; propertyType: string; area: string
  value: string; entry: string; status: AssetStatus
  // Instrumento de Dívida
  isin?: string; maturity?: string; rate?: string; currency?: string
  // Infraestrutura
  infraSector?: string
  // Matéria-Prima
  commodity?: string; unit?: string
  // Direitos de PI
  ipType?: string; territory?: string
  // Criptoativo
  cryptoSymbol?: string
  // Outro
  description?: string
  // Documento associado
  file?: OIAFile
}
interface Tranche {
  id: string; date: string; fund: string; type: TrancheType
  amount: number; shares: number; notes: string
  file?: OIAFile
}
interface Company {
  id: string; name: string; sector: string; country: string; stage: string
  funds: string[]; stake: number; invested: number; equityInvested: number
  nav: number; moic: number; rentEquity: number; totalShares: number
  status: CompanyStatus; tranches: Tranche[]; assets: Asset[]; files: OIAFile[]
}
interface Fund {
  id: string; name: string; shortName: string; type: FundType
  vintage: number; size: string; status: FundStatus; files: OIAFile[]
}

type FundSeed    = Omit<Fund, 'files'>
type CompanySeed = Omit<Company, 'files'>

// ── Org taxonomy ──────────────────────────────────────────────────────────────
interface Cat { id: CatId; label: string; sublabel: string }
const CATS: Cat[] = [
  { id:'fcr', label:'Capitais de Risco', sublabel:'FCR'            },
  { id:'mob', label:'Mobiliários',        sublabel:'FIAA · PPR'     },
  { id:'esp', label:'Especializado',      sublabel:'Trade Finance'  },
]

interface FundGroup { id: GroupId; shortName: string; name: string; fundIds: string[] }
const FUND_GROUPS: FundGroup[] = [
  { id:'bcif', shortName:'BCIF I — V',  name:'BlueCrow Innovation Fund',   fundIds:['BCIF1','BCIF2','BCIF3','BCIF4','BCIF5'] },
  { id:'dev',  shortName:'BCDF I',      name:'BlueCrow Development Fund I', fundIds:['BCDF1A','BCDF1B','BCDF1C','BCDF1D','BCDF1E'] },
]

type CatItem = { kind:'group'; gid: GroupId } | { kind:'fund'; fid: string }
const FCR_ITEMS: CatItem[] = [
  { kind:'group', gid:'bcif' },
  { kind:'fund',  fid:'VF' },
  { kind:'fund',  fid:'BCG1' },
  { kind:'fund',  fid:'BCN1' },
  { kind:'fund',  fid:'BCIMPACT' },
  { kind:'fund',  fid:'BCNT1' },
  { kind:'fund',  fid:'GGT' },
  { kind:'group', gid:'dev' },
]
const MOB_IDS = ['BCLPF','BCGDF','BCSTF','BCPSF','BCOPPR']
const ESP_IDS = ['BCTFF']

// ── Helpers ───────────────────────────────────────────────────────────────────
let _s = 0
function uid() { return `_${(++_s).toString(36)}${Math.random().toString(36).slice(2,6)}` }
function fmtM(n: number | string | null | undefined) {
  const v = Number(n)
  if (!v || isNaN(v)) return '—'
  return Math.abs(v) >= 1e6 ? `${(v/1e6).toFixed(2)}M€` : Math.abs(v) >= 1e3 ? `${(v/1e3).toFixed(0)}k€` : `${v}€`
}
function fmtMoic(n: number | string | null | undefined) { const v = Number(n); return v ? `${v.toFixed(2)}x` : '—' }
function stemPct(idx: number, total: number) { return idx >= 0 && total > 0 ? `${(idx + 0.5) / total * 100}%` : '50%' }
function formatSize(bytes: number) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes > 1e3 ? `${(bytes / 1e3).toFixed(0)} KB` : `${bytes} B`
}
function fileTypeFromName(name: string): OIAFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['doc','docx'].includes(ext)) return 'word'
  if (['xls','xlsx'].includes(ext)) return 'excel'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const INITIAL_FUNDS: FundSeed[] = [
  { id:'BCIF1',   name:'BlueCrow Innovation Fund I, FCR',                                                                            shortName:'BCIF I',            type:'FCR',  vintage:2012, size:'—',     status:'Ativo' },
  { id:'VF',      name:'Viriatus Fund, FCR',                                                                                         shortName:'Viriatus',          type:'FCR',  vintage:2013, size:'—',     status:'Ativo' },
  { id:'BCG1',    name:'BlueCrow Growth Fund I, FCR',                                                                                shortName:'BCG I',             type:'FCR',  vintage:2014, size:'—',     status:'Ativo' },
  { id:'BCIF2',   name:'BlueCrow Innovation Fund II, FCR',                                                                           shortName:'BCIF II',           type:'FCR',  vintage:2015, size:'—',     status:'Ativo' },
  { id:'BCN1',    name:'BlueCrow Northern Fund I, FCR',                                                                              shortName:'BCN I',             type:'FCR',  vintage:2016, size:'—',     status:'Ativo' },
  { id:'BCIF3',   name:'BlueCrow Innovation Fund III, FCR',                                                                          shortName:'BCIF III',          type:'FCR',  vintage:2017, size:'—',     status:'Ativo' },
  { id:'BCIF4',   name:'BlueCrow Innovation Fund IV, FCR',                                                                           shortName:'BCIF IV',           type:'FCR',  vintage:2018, size:'—',     status:'Ativo' },
  { id:'BCIMPACT',name:'BlueCrow Impact Fund, FCR',                                                                                  shortName:'BC Impact',         type:'FCR',  vintage:2019, size:'—',     status:'Ativo' },
  { id:'BCNT1',   name:'BlueCrow Next Tech Fund I, FCR',                                                                             shortName:'BCNT I',            type:'FCR',  vintage:2021, size:'60M€',  status:'Ativo' },
  { id:'BCIF5',   name:'BlueCrow Innovation Fund V, FCR',                                                                            shortName:'BCIF V',            type:'FCR',  vintage:2022, size:'—',     status:'Ativo' },
  { id:'GGT',     name:'Global Growth Tech Fund, FCR',                                                                               shortName:'GGT',               type:'FCR',  vintage:2023, size:'—',     status:'Ativo' },
  { id:'BCDF1A',  name:'BlueCrow Development Fund I — Subfundo A · Portuguese Agrobusiness Fund',                                   shortName:'BCDF I / A',        type:'FCR',  vintage:2020, size:'80M€',  status:'Ativo' },
  { id:'BCDF1B',  name:'BlueCrow Development Fund I — Subfundo B · Portuguese Entertainment Fund',                                  shortName:'BCDF I / B',        type:'FCR',  vintage:2020, size:'—',     status:'Ativo' },
  { id:'BCDF1C',  name:'BlueCrow Development Fund I — Subfundo C · Football Strategies Fund',                                       shortName:'BCDF I / C',        type:'FCR',  vintage:2022, size:'40M€',  status:'Ativo' },
  { id:'BCDF1D',  name:'BlueCrow Development Fund I — Subfundo D · Hermes Fund',                                                    shortName:'BCDF I / D',        type:'FCR',  vintage:2018, size:'200M€', status:'Ativo' },
  { id:'BCDF1E',  name:'BlueCrow Development Fund I — Subfundo E · Finance Fund',                                                   shortName:'BCDF I / E',        type:'FCR',  vintage:2019, size:'120M€', status:'Ativo' },
  { id:'BCOPPR',  name:'BlueCrow Global Opportunities PPR OIA Flexível — Fundo de Investimento Alternativo Mobiliário Aberto Flexível de Poupança Reforma', shortName:'BC Global Opp. PPR',  type:'PPR',  vintage:2016, size:'150M€', status:'Ativo' },
  { id:'BCLPF',   name:'BlueCrow Global Listed Property Fund — FIAA',                                                               shortName:'BC Listed Property', type:'FIAA', vintage:2017, size:'300M€', status:'Ativo' },
  { id:'BCGDF',   name:'BlueCrow Global Discovery Fund — FIAA',                                                                     shortName:'BC Global Discovery',type:'FIAA', vintage:2023, size:'50M€',  status:'Ativo' },
  { id:'BCSTF',   name:'BlueCrow Portugal Short Term Fund — FIAA',                                                                  shortName:'BC Short Term',      type:'FIAA', vintage:2018, size:'—',     status:'Ativo' },
  { id:'BCPSF',   name:'BlueCrow Portugal Select Fund — FIAA',                                                                      shortName:'BC Portugal Select',  type:'FIAA', vintage:2019, size:'—',     status:'Ativo' },
  { id:'BCTFF',   name:'BlueCrow Global Trade Finance Fund — FIAA',                                                                  shortName:'BC Trade Finance',   type:'FIAA', vintage:2021, size:'—',     status:'Ativo' },
]

const INITIAL_COMPANIES: CompanySeed[] = [
  { id:'co-01', name:'Agentifai',                    sector:'Inteligência Artificial', country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:23.66, invested:7550000,   equityInvested:7050000,   nav:16128611, moic:2.14, rentEquity:128.8,  totalShares:7317534,  status:'Ativa',    tranches:[{ id:'t01a', date:'2021-12-20', fund:'BCNT1', type:'Equity', amount:5000000, shares:997947,  notes:'Pre Money 40M€ — Post Money 45M€' },{ id:'t01b', date:'2023-12-29', fund:'BCNT1', type:'SAFE',   amount:700000,  shares:0,       notes:'' },{ id:'t01c', date:'2024-01-01', fund:'BCNT1', type:'Equity', amount:1350000, shares:0,       notes:'' },{ id:'t01d', date:'2024-01-01', fund:'BCNT1', type:'Mútuo',  amount:500000,  shares:0,       notes:'' }], assets:[] },
  { id:'co-02', name:'KIT-AR',                       sector:'',                        country:'Portugal', stage:'Seed',        funds:['BCNT1'],                         stake:0,     invested:1400000,   equityInvested:0,         nav:0,        moic:0,    rentEquity:0,      totalShares:0,        status:'Ativa',    tranches:[{ id:'t02a', date:'2023-12-29', fund:'BCNT1', type:'SAFE',   amount:700000,  shares:0,       notes:'' },{ id:'t02b', date:'2024-06-01', fund:'BCNT1', type:'SAFE',   amount:700000,  shares:0,       notes:'' }], assets:[] },
  { id:'co-03', name:'Sensei',                       sector:'Tecnologia',              country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:6.39,  invested:5000000,   equityInvested:5000000,   nav:5000000,  moic:1.00, rentEquity:-0.0,   totalShares:9102208,  status:'Ativa',    tranches:[{ id:'t03a', date:'2024-04-29', fund:'BCNT1', type:'Equity', amount:5000000, shares:582061,  notes:'Pre Money 68M€ — Post Money 78.2M€' }], assets:[] },
  { id:'co-04', name:'IVV Automação',                sector:'Automação Industrial',    country:'Portugal', stage:'Early Stage', funds:['BCNT1'],                         stake:76.88, invested:597470,    equityInvested:250000,    nav:2151408,  moic:3.60, rentEquity:760.6,  totalShares:5,        status:'Ativa',    tranches:[{ id:'t04a', date:'2024-01-02', fund:'BCNT1', type:'Equity', amount:250000,  shares:1,       notes:'' },{ id:'t04b', date:'2024-01-02', fund:'BCNT1', type:'Prest. Suplementares', amount:347470, shares:0, notes:'' }], assets:[] },
  { id:'co-05', name:'Tonic Easy Medical',           sector:'Saúde Digital',           country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:6.16,  invested:1750000,   equityInvested:1750000,   nav:1858097,  moic:1.06, rentEquity:6.2,    totalShares:30252214, status:'Ativa',    tranches:[{ id:'t05a', date:'2024-01-25', fund:'BCNT1', type:'Equity', amount:1750000, shares:1864785, notes:'Pre Money 14.3M€ — Post Money 26.6M€' }], assets:[] },
  { id:'co-06', name:'Paynest',                      sector:'FinTech',                 country:'Portugal', stage:'Early Stage', funds:['BCNT1'],                         stake:3.75,  invested:1100000,   equityInvested:600000,    nav:791316,   moic:0.72, rentEquity:31.9,   totalShares:184598,   status:'Ativa',    tranches:[{ id:'t06a', date:'2023-01-01', fund:'BCNT1', type:'Equity', amount:600000,  shares:0,       notes:'' },{ id:'t06b', date:'2023-06-01', fund:'BCNT1', type:'SAFE',   amount:500000,  shares:0,       notes:'' }], assets:[] },
  { id:'co-07', name:'Bandora',                      sector:'Tecnologia',              country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:25.45, invested:1250000,   equityInvested:1250000,   nav:2969342,  moic:2.38, rentEquity:137.5,  totalShares:8617984,  status:'Ativa',    tranches:[{ id:'t07a', date:'2023-06-01', fund:'BCNT1', type:'Equity', amount:1250000, shares:0,       notes:'' }], assets:[] },
  { id:'co-08', name:'Leadzai',                      sector:'Marketing Digital',       country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:6.33,  invested:2500002,   equityInvested:2500002,   nav:2416500,  moic:0.97, rentEquity:-3.3,   totalShares:10558005, status:'Ativa',    tranches:[{ id:'t08a', date:'2022-06-01', fund:'BCNT1', type:'Equity', amount:2500002, shares:0,       notes:'' }], assets:[] },
  { id:'co-09', name:'BIGgroup',                     sector:'Tecnologia',              country:'Portugal', stage:'Growth',      funds:['BCNT1'],                         stake:11.48, invested:2000000,   equityInvested:2000000,   nav:4496472,  moic:2.25, rentEquity:124.8,  totalShares:5648450,  status:'Ativa',    tranches:[{ id:'t09a', date:'2022-01-01', fund:'BCNT1', type:'Equity', amount:2000000, shares:0,       notes:'' }], assets:[] },
  { id:'co-10', name:'LEF S.A.',                     sector:'Indústria',               country:'Portugal', stage:'',           funds:['BCIF1','BCIF2','BCIF4'],          stake:18.13, invested:6930002,   equityInvested:2310002,   nav:4519289,  moic:0.65, rentEquity:95.6,   totalShares:2735394,  status:'Ativa',    tranches:[{ id:'t10a', date:'2012-01-01', fund:'BCIF1', type:'Equity', amount:800000,  shares:0, notes:'' },{ id:'t10b', date:'2015-01-01', fund:'BCIF2', type:'Equity', amount:510002, shares:0, notes:'' },{ id:'t10c', date:'2012-01-01', fund:'BCIF1', type:'Prest. Suplementares', amount:1500000, shares:0, notes:'' },{ id:'t10d', date:'2015-01-01', fund:'BCIF2', type:'Prest. Suplementares', amount:2120000, shares:0, notes:'' },{ id:'t10e', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t10f', date:'2018-01-01', fund:'BCIF4', type:'Mútuo', amount:1000000, shares:0, notes:'' }], assets:[] },
  { id:'co-11', name:'Viveiros da Espargueira S.A.', sector:'Aquacultura',             country:'Portugal', stage:'',           funds:['BCIF1','BCIF2'],                  stake:10.00, invested:1965000,   equityInvested:655000,    nav:982135,   moic:0.50, rentEquity:49.9,   totalShares:6552436,  status:'Ativa',    tranches:[{ id:'t11a', date:'2012-01-01', fund:'BCIF1', type:'Equity', amount:180000, shares:0, notes:'' },{ id:'t11b', date:'2015-01-01', fund:'BCIF2', type:'Equity', amount:475000, shares:0, notes:'' },{ id:'t11c', date:'2012-01-01', fund:'BCIF1', type:'Prest. Suplementares', amount:430000, shares:0, notes:'' },{ id:'t11d', date:'2015-01-01', fund:'BCIF2', type:'Prest. Suplementares', amount:880000, shares:0, notes:'' }], assets:[] },
  { id:'co-12', name:'Ingredient Odyssey S.A.',      sector:'Biotecnologia Alimentar', country:'Portugal', stage:'',           funds:['BCIF2','BCIF3','BCIF4','BCIF5'],  stake:41.09, invested:14190000,  equityInvested:6100000,   nav:6260735,  moic:0.44, rentEquity:2.6,    totalShares:43171400, status:'Ativa',    tranches:[{ id:'t12a', date:'2015-01-01', fund:'BCIF2', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t12b', date:'2017-01-01', fund:'BCIF3', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t12c', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:1600000, shares:0, notes:'' },{ id:'t12d', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:2500000, shares:0, notes:'' },{ id:'t12e', date:'2015-01-01', fund:'BCIF2', type:'Prest. Suplementares', amount:2590000, shares:0, notes:'' },{ id:'t12f', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:5500000, shares:0, notes:'' }], assets:[] },
  { id:'co-13', name:'Oceano Fresco',                sector:'Aquacultura',             country:'Portugal', stage:'',           funds:['BCIF2','BCIF3','BCIF5'],          stake:15.07, invested:6385001,   equityInvested:3076177,   nav:1860434,  moic:0.29, rentEquity:-39.5,  totalShares:13018603, status:'Ativa',    tranches:[{ id:'t13a', date:'2015-01-01', fund:'BCIF2', type:'Equity', amount:500000, shares:0, notes:'' },{ id:'t13b', date:'2017-01-01', fund:'BCIF3', type:'Equity', amount:576177, shares:0, notes:'' },{ id:'t13c', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:2000000, shares:0, notes:'' },{ id:'t13d', date:'2015-01-01', fund:'BCIF2', type:'Prest. Suplementares', amount:1308824, shares:0, notes:'' },{ id:'t13e', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:2000000, shares:0, notes:'' }], assets:[] },
  { id:'co-14', name:'Congelagos S.A.',              sector:'Agro-indústria',          country:'Portugal', stage:'',           funds:['BCIF3','BCIF4','BCIF5'],          stake:92.65, invested:19290965,  equityInvested:14943666,  nav:9008538,  moic:0.47, rentEquity:-39.7,  totalShares:1097278,  status:'Ativa',    tranches:[{ id:'t14a', date:'2017-01-01', fund:'BCIF3', type:'Equity', amount:3000000, shares:0, notes:'' },{ id:'t14b', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:4000000, shares:0, notes:'' },{ id:'t14c', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:7943666, shares:0, notes:'' },{ id:'t14d', date:'2017-01-01', fund:'BCIF3', type:'Prest. Suplementares', amount:1000000, shares:0, notes:'' },{ id:'t14e', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:3347299, shares:0, notes:'' }], assets:[] },
  { id:'co-15', name:'Silicolife S.A.',              sector:'Biotecnologia',           country:'Portugal', stage:'',           funds:['BCIF3','BCIF4','BCIF5'],          stake:33.05, invested:6400000,   equityInvested:1900000,   nav:4230950,  moic:0.66, rentEquity:122.7,  totalShares:6750000,  status:'Ativa',    tranches:[{ id:'t15a', date:'2017-01-01', fund:'BCIF3', type:'Equity', amount:700000, shares:0, notes:'' },{ id:'t15b', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:600000, shares:0, notes:'' },{ id:'t15c', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:600000, shares:0, notes:'' },{ id:'t15d', date:'2017-01-01', fund:'BCIF3', type:'Prest. Suplementares', amount:1500000, shares:0, notes:'' },{ id:'t15e', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:3000000, shares:0, notes:'' }], assets:[] },
  { id:'co-16', name:'Ophiomics S.A.',               sector:'Biotecnologia',           country:'Portugal', stage:'',           funds:['BCIF4','BCIF5'],                  stake:25.00, invested:6150000,   equityInvested:3000000,   nav:2557248,  moic:0.42, rentEquity:-14.8,  totalShares:23333334, status:'Ativa',    tranches:[{ id:'t16a', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t16b', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:2000000, shares:0, notes:'' },{ id:'t16c', date:'2018-01-01', fund:'BCIF4', type:'Prest. Suplementares', amount:1150000, shares:0, notes:'' },{ id:'t16d', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:2000000, shares:0, notes:'' }], assets:[] },
  { id:'co-17', name:'Thunder Foods S.A.',           sector:'Agro-alimentar',          country:'Portugal', stage:'',           funds:['BCIF5'],                          stake:27.58, invested:5000000,   equityInvested:2500000,   nav:0,        moic:0.00, rentEquity:-100.0, totalShares:181305,   status:'Em saída', tranches:[{ id:'t17a', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:2500000, shares:0, notes:'' },{ id:'t17b', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:2500000, shares:0, notes:'' }], assets:[] },
  { id:'co-18', name:'Gra Nutra S.A.',               sector:'Nutrição',                country:'Portugal', stage:'',           funds:['BCIF4','BCIF5'],                  stake:50.00, invested:12749981,  equityInvested:4249993,   nav:15170613, moic:1.19, rentEquity:257.0,  totalShares:1593811,  status:'Ativa',    tranches:[{ id:'t18a', date:'2018-01-01', fund:'BCIF4', type:'Equity', amount:1249993, shares:0, notes:'' },{ id:'t18b', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:3000000, shares:0, notes:'' },{ id:'t18c', date:'2018-01-01', fund:'BCIF4', type:'Prest. Suplementares', amount:3000000, shares:0, notes:'' },{ id:'t18d', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:5499988, shares:0, notes:'' }], assets:[] },
  { id:'co-19', name:'Acecann S.A.',                 sector:'Cannabis Medicinal',      country:'Portugal', stage:'',           funds:['BCIF5'],                          stake:2.45,  invested:3500000,   equityInvested:1000000,   nav:24500,    moic:0.01, rentEquity:-97.6,  totalShares:7102735,  status:'Ativa',    tranches:[{ id:'t19a', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t19b', date:'2022-01-01', fund:'BCIF5', type:'Prest. Suplementares', amount:2500000, shares:0, notes:'' }], assets:[] },
  { id:'co-20', name:'Findster',                     sector:'Tecnologia',              country:'Portugal', stage:'',           funds:['BCIF5'],                          stake:0,     invested:1401174,   equityInvested:0,         nav:0,        moic:0,    rentEquity:0,      totalShares:0,        status:'Ativa',    tranches:[{ id:'t20a', date:'2022-01-01', fund:'BCIF5', type:'CLN',    amount:1401174, shares:0, notes:'' }], assets:[] },
  { id:'co-21', name:'Anybrain S.A.',                sector:'Neuro-tecnologia',        country:'Portugal', stage:'',           funds:['BCIF5'],                          stake:8.65,  invested:1000000,   equityInvested:1000000,   nav:1000000,  moic:1.00, rentEquity:-0.0,   totalShares:13600821, status:'Ativa',    tranches:[{ id:'t21a', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:1000000, shares:0, notes:'' }], assets:[] },
  { id:'co-22', name:'BGW',                          sector:'Carvão Vegetal',          country:'Portugal', stage:'',           funds:['BCIF1','BCIF2','BCIF3','BCIF5','BCG1'], stake:85.65, invested:11457786, equityInvested:11457786, nav:13596425, moic:1.19, rentEquity:18.7, totalShares:53308779, status:'Ativa', tranches:[{ id:'t22a', date:'2012-01-01', fund:'BCIF1', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t22b', date:'2015-01-01', fund:'BCIF2', type:'Equity', amount:1000000, shares:0, notes:'' },{ id:'t22c', date:'2014-01-01', fund:'BCG1',  type:'Equity', amount:4000000, shares:0, notes:'' },{ id:'t22d', date:'2017-01-01', fund:'BCIF3', type:'Equity', amount:2500000, shares:0, notes:'' },{ id:'t22e', date:'2022-01-01', fund:'BCIF5', type:'Equity', amount:2957786, shares:0, notes:'' }], assets:[] },
]

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title:string; onClose:()=>void; children:React.ReactNode; wide?:boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={clsx('bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
function Field({ label, children }:{ label:string; children:React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>{children}</div>
}
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

// ── Add Fund Modal ─────────────────────────────────────────────────────────────
function AddFundModal({ onClose, onAdd }:{ onClose:()=>void; onAdd:(f:Omit<Fund,'id'|'files'>)=>void }) {
  const [form, set] = useState({ name:'', shortName:'', type:'FCR' as FundType, vintage:new Date().getFullYear(), size:'', status:'Ativo' as FundStatus })
  const s = (k:string)=>(v:string)=>set(p=>({...p,[k]:v}))
  return (
    <Modal title="Adicionar Fundo" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome completo"><input className={inp} value={form.name} onChange={e=>s('name')(e.target.value)} placeholder="BlueCrow … Fund, FCR" /></Field>
        <Field label="Nome curto"><input className={inp} value={form.shortName} onChange={e=>s('shortName')(e.target.value)} placeholder="BCIF VI" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo"><select className={inp} value={form.type} onChange={e=>s('type')(e.target.value)}><option value="FCR">FCR</option><option value="FIAA">FIAA</option><option value="PPR">PPR</option></select></Field>
          <Field label="Vintage"><input className={inp} type="number" value={form.vintage} onChange={e=>s('vintage')(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dimensão"><input className={inp} value={form.size} onChange={e=>s('size')(e.target.value)} placeholder="50M€" /></Field>
          <Field label="Estado"><select className={inp} value={form.status} onChange={e=>s('status')(e.target.value)}><option>Ativo</option><option>Em liquidação</option><option>Fechado</option></select></Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={()=>{ if(form.name&&form.shortName){onAdd({...form,vintage:Number(form.vintage)});onClose()} }} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add Company Modal ──────────────────────────────────────────────────────────
function AddCompanyModal({ funds, defaultFundId, onClose, onAdd }:{ funds:Fund[]; defaultFundId?:string; onClose:()=>void; onAdd:(c:Omit<Company,'id'|'assets'|'files'>)=>void }) {
  type F = { name:string; sector:string; country:string; stage:string; funds:string[]; stake:string; invested:string; equityInvested:string; nav:string; moic:string; rentEquity:string; totalShares:string; status:CompanyStatus; tranches:Omit<Tranche,'id'>[] }
  const [form,set] = useState<F>({ name:'',sector:'',country:'Portugal',stage:'',funds:defaultFundId?[defaultFundId]:[],stake:'',invested:'',equityInvested:'',nav:'',moic:'',rentEquity:'',totalShares:'',status:'Ativa',tranches:[] })
  const s=(k:keyof F)=>(v:string)=>set(p=>({...p,[k]:v}))
  const toggleFund=(fid:string)=>set(p=>({...p,funds:p.funds.includes(fid)?p.funds.filter(x=>x!==fid):[...p.funds,fid]}))
  const addTr=()=>set(p=>({...p,tranches:[...p.tranches,{date:'',fund:p.funds[0]??'',type:'Equity' as TrancheType,amount:0,shares:0,notes:''}]}))
  const updTr=(i:number,k:keyof Omit<Tranche,'id'>,v:string|number)=>set(p=>{const t=[...p.tranches];t[i]={...t[i],[k]:v};return{...p,tranches:t}})
  const rmTr=(i:number)=>set(p=>({...p,tranches:p.tranches.filter((_,j)=>j!==i)}))
  const num=(s:string)=>Number(s.replace(/[^0-9.-]/g,''))
  return (
    <Modal title="Adicionar Empresa Participada" onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome"><input className={inp} value={form.name} onChange={e=>s('name')(e.target.value)} placeholder="Empresa, S.A." /></Field>
          <Field label="Setor"><input className={inp} value={form.sector} onChange={e=>s('sector')(e.target.value)} placeholder="Tecnologia" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="País"><input className={inp} value={form.country} onChange={e=>s('country')(e.target.value)} /></Field>
          <Field label="Stage"><select className={inp} value={form.stage} onChange={e=>s('stage')(e.target.value)}><option value="">—</option><option>Seed</option><option>Early Stage</option><option>Growth</option><option>Late Stage</option><option>Control</option><option>Outro</option></select></Field>
          <Field label="Estado"><select className={inp} value={form.status} onChange={e=>s('status')(e.target.value as CompanyStatus)}><option>Ativa</option><option>Em saída</option><option>Alienada</option></select></Field>
        </div>
        <Field label="Fundos participantes">
          <div className="border border-gray-200 rounded-lg p-3 max-h-36 overflow-y-auto grid grid-cols-2 gap-1">
            {funds.map(f=><label key={f.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"><input type="checkbox" checked={form.funds.includes(f.id)} onChange={()=>toggleFund(f.id)} className="accent-blue-600" /><span className="text-[12px]">{f.shortName}</span></label>)}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Stake (%)"><input className={inp} value={form.stake} onChange={e=>s('stake')(e.target.value)} placeholder="23.66" /></Field>
          <Field label="Total Investido (€)"><input className={inp} value={form.invested} onChange={e=>s('invested')(e.target.value)} placeholder="7550000" /></Field>
          <Field label="Equity Investido (€)"><input className={inp} value={form.equityInvested} onChange={e=>s('equityInvested')(e.target.value)} placeholder="7050000" /></Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="NAV (€)"><input className={inp} value={form.nav} onChange={e=>s('nav')(e.target.value)} placeholder="16128611" /></Field>
          <Field label="MOIC (x)"><input className={inp} value={form.moic} onChange={e=>s('moic')(e.target.value)} placeholder="2.14" /></Field>
          <Field label="Rent. Equity (%)"><input className={inp} value={form.rentEquity} onChange={e=>s('rentEquity')(e.target.value)} placeholder="128.8" /></Field>
          <Field label="Total Acções"><input className={inp} value={form.totalShares} onChange={e=>s('totalShares')(e.target.value)} placeholder="7317534" /></Field>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tranches</span>
            <button onClick={addTr} className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold hover:text-blue-800"><Plus className="w-3.5 h-3.5" />Adicionar</button>
          </div>
          {form.tranches.length===0&&<div className="py-3 text-center text-[12px] text-gray-400 italic border border-dashed border-gray-200 rounded-lg">Sem tranches</div>}
          <div className="space-y-3">
            {form.tranches.map((t,i)=>(
              <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50 relative">
                <button onClick={()=>rmTr(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <Field label="Data"><input className={inp} type="date" value={t.date} onChange={e=>updTr(i,'date',e.target.value)} /></Field>
                  <Field label="Fundo"><select className={inp} value={t.fund} onChange={e=>updTr(i,'fund',e.target.value)}><option value="">—</option>{funds.map(f=><option key={f.id} value={f.id}>{f.shortName}</option>)}</select></Field>
                  <Field label="Tipo"><select className={inp} value={t.type} onChange={e=>updTr(i,'type',e.target.value as TrancheType)}><option>Equity</option><option>CLN</option><option>SAFE</option><option>Mútuo</option><option>Prest. Suplementares</option><option>Outro</option></select></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Montante (€)"><input className={inp} type="number" value={t.amount||''} onChange={e=>updTr(i,'amount',Number(e.target.value))} /></Field>
                  <Field label="Acções"><input className={inp} type="number" value={t.shares||''} onChange={e=>updTr(i,'shares',Number(e.target.value))} /></Field>
                  <Field label="Notas"><input className={inp} value={t.notes} onChange={e=>updTr(i,'notes',e.target.value)} /></Field>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={()=>{ if(!form.name)return; onAdd({name:form.name,sector:form.sector,country:form.country,stage:form.stage,funds:form.funds,stake:num(form.stake),invested:num(form.invested),equityInvested:num(form.equityInvested),nav:num(form.nav),moic:num(form.moic),rentEquity:num(form.rentEquity),totalShares:num(form.totalShares),status:form.status,tranches:form.tranches.map(t=>({...t,id:uid()}))}); onClose() }} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add Asset Modal ────────────────────────────────────────────────────────────
function AddAssetModal({ companyName, onClose, onAdd }:{ companyName:string; onClose:()=>void; onAdd:(a:Omit<Asset,'id'>)=>void }) {
  const blank:Omit<Asset,'id'>={ assetType:'Empresa',name:'',sector:'',country:'Portugal',stake:'',ticker:'',assetClass:'',quantity:'',location:'',propertyType:'Comercial',area:'',value:'',entry:'',status:'Ativo' }
  const [form,set]=useState<Omit<Asset,'id'>>(blank)
  const [previewFile, setPreviewFile] = useState<OIAFile | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const s=(k:string)=>(v:string)=>set(p=>({...p,[k]:v}))
  const changeType=(t:AssetType)=>set({...blank,assetType:t,entry:form.entry,status:form.status})

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = evt => {
      set(p => ({ ...p, file: {
        id: uid(), name: f.name, size: formatSize(f.size),
        type: fileTypeFromName(f.name), uploadedAt: new Date().toISOString().slice(0,10),
        data: evt.target?.result as string,
      }}))
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  return (
    <Modal title={`Adicionar Ativo — ${companyName}`} onClose={onClose}>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      <div className="space-y-4">
        <Field label="Tipo de Ativo">
          <select className={inp} value={form.assetType} onChange={e=>changeType(e.target.value as AssetType)}>
            <option value="Empresa">Empresa participada</option>
            <option value="Ativo Mobiliário">Ativo Mobiliário (acções, obrigações, ETF…)</option>
            <option value="Ativo Imobiliário">Ativo Imobiliário (imóvel, terreno…)</option>
            <option value="Instrumento de Dívida">Instrumento de Dívida (CLN, obrigação, mútuo…)</option>
            <option value="Infraestrutura">Infraestrutura (energia, transportes, telecom…)</option>
            <option value="Matéria-Prima">Matéria-Prima / Commodity (ouro, petróleo…)</option>
            <option value="Direitos de PI">Direitos de Propriedade Intelectual (patente, marca…)</option>
            <option value="Criptoativo">Criptoativo (Bitcoin, Ethereum…)</option>
            <option value="Outro">Outro</option>
          </select>
        </Field>
        <Field label="Nome / Designação"><input className={inp} value={form.name} onChange={e=>s('name')(e.target.value)} placeholder="Nome do ativo"/></Field>

        {/* Empresa */}
        {form.assetType==='Empresa'&&<>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Setor"><input className={inp} value={form.sector} onChange={e=>s('sector')(e.target.value)} /></Field>
            <Field label="País"><input className={inp} value={form.country} onChange={e=>s('country')(e.target.value)} /></Field>
          </div>
          <Field label="Stake (%)"><input className={inp} value={form.stake} onChange={e=>s('stake')(e.target.value)} /></Field>
        </>}

        {/* Ativo Mobiliário */}
        {form.assetType==='Ativo Mobiliário'&&<div className="grid grid-cols-3 gap-4">
          <Field label="Ticker"><input className={inp} value={form.ticker} onChange={e=>s('ticker')(e.target.value)} /></Field>
          <Field label="Classe">
            <select className={inp} value={form.assetClass} onChange={e=>s('assetClass')(e.target.value)}>
              <option value="">—</option><option>Acções</option><option>Obrigações</option><option>ETF</option><option>Fundo</option><option>Derivado</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Quantidade"><input className={inp} value={form.quantity} onChange={e=>s('quantity')(e.target.value)} /></Field>
        </div>}

        {/* Ativo Imobiliário */}
        {form.assetType==='Ativo Imobiliário'&&<div className="grid grid-cols-3 gap-4">
          <Field label="Localização"><input className={inp} value={form.location} onChange={e=>s('location')(e.target.value)} /></Field>
          <Field label="Tipologia">
            <select className={inp} value={form.propertyType} onChange={e=>s('propertyType')(e.target.value)}>
              <option>Comercial</option><option>Escritórios</option><option>Residencial</option><option>Industrial</option><option>Logística</option><option>Terreno</option><option>Hotel</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Área (m²)"><input className={inp} value={form.area} onChange={e=>s('area')(e.target.value)} /></Field>
        </div>}

        {/* Instrumento de Dívida */}
        {form.assetType==='Instrumento de Dívida'&&<>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ISIN / Referência"><input className={inp} value={form.isin??''} onChange={e=>s('isin')(e.target.value)} /></Field>
            <Field label="Moeda"><input className={inp} value={form.currency??'EUR'} onChange={e=>s('currency')(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Maturidade"><input className={inp} type="date" value={form.maturity??''} onChange={e=>s('maturity')(e.target.value)} /></Field>
            <Field label="Taxa / Cupão (%)"><input className={inp} value={form.rate??''} onChange={e=>s('rate')(e.target.value)} placeholder="ex: 5.5" /></Field>
          </div>
        </>}

        {/* Infraestrutura */}
        {form.assetType==='Infraestrutura'&&<div className="grid grid-cols-2 gap-4">
          <Field label="Sector de Infra">
            <select className={inp} value={form.infraSector??''} onChange={e=>s('infraSector')(e.target.value)}>
              <option value="">—</option><option>Energia Renovável</option><option>Energia Convencional</option><option>Transportes</option><option>Telecomunicações</option><option>Água / Saneamento</option><option>Saúde</option><option>Educação</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Localização"><input className={inp} value={form.location} onChange={e=>s('location')(e.target.value)} /></Field>
        </div>}

        {/* Matéria-Prima */}
        {form.assetType==='Matéria-Prima'&&<div className="grid grid-cols-3 gap-4">
          <Field label="Commodity">
            <select className={inp} value={form.commodity??''} onChange={e=>s('commodity')(e.target.value)}>
              <option value="">—</option><option>Ouro</option><option>Prata</option><option>Petróleo Bruto (WTI)</option><option>Petróleo Bruto (Brent)</option><option>Gás Natural</option><option>Cobre</option><option>Alumínio</option><option>Milho</option><option>Trigo</option><option>Café</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Quantidade"><input className={inp} value={form.quantity} onChange={e=>s('quantity')(e.target.value)} /></Field>
          <Field label="Unidade">
            <select className={inp} value={form.unit??''} onChange={e=>s('unit')(e.target.value)}>
              <option value="">—</option><option>oz</option><option>kg</option><option>ton</option><option>bbl</option><option>MMBtu</option><option>bushel</option>
            </select>
          </Field>
        </div>}

        {/* Direitos de PI */}
        {form.assetType==='Direitos de PI'&&<div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de PI">
            <select className={inp} value={form.ipType??''} onChange={e=>s('ipType')(e.target.value)}>
              <option value="">—</option><option>Patente</option><option>Marca Registada</option><option>Software / Código</option><option>Copyright</option><option>Know-how / Trade Secret</option><option>Domínio Web</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Território"><input className={inp} value={form.territory??''} onChange={e=>s('territory')(e.target.value)} placeholder="ex: Portugal, UE, Mundial" /></Field>
        </div>}

        {/* Criptoativo */}
        {form.assetType==='Criptoativo'&&<div className="grid grid-cols-2 gap-4">
          <Field label="Símbolo">
            <select className={inp} value={form.cryptoSymbol??''} onChange={e=>s('cryptoSymbol')(e.target.value)}>
              <option value="">—</option><option>BTC</option><option>ETH</option><option>SOL</option><option>USDT</option><option>USDC</option><option>BNB</option><option>XRP</option><option>ADA</option><option>MATIC</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Quantidade"><input className={inp} value={form.quantity} onChange={e=>s('quantity')(e.target.value)} /></Field>
        </div>}

        {/* Outro */}
        {form.assetType==='Outro'&&<Field label="Descrição"><input className={inp} value={form.description??''} onChange={e=>s('description')(e.target.value)} placeholder="Descreva o ativo" /></Field>}

        <div className="grid grid-cols-3 gap-4">
          <Field label="Valor (€)"><input className={inp} value={form.value} onChange={e=>s('value')(e.target.value)} /></Field>
          <Field label="Data de Entrada"><input className={inp} type="date" value={form.entry} onChange={e=>s('entry')(e.target.value)} /></Field>
          <Field label="Estado"><select className={inp} value={form.status} onChange={e=>s('status')(e.target.value)}><option>Ativo</option><option>Em saída</option><option>Alienado</option></select></Field>
        </div>

        {/* Documento opcional */}
        <Field label="Documento (opcional)">
          <input ref={fileRef} type="file" accept=".doc,.docx,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileChange} />
          {form.file ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 text-[12px] text-gray-700 truncate">{form.file.name}</span>
              <span className="text-[10px] text-gray-400 shrink-0">{form.file.size}</span>
              {(form.file.type==='pdf'||form.file.type==='excel'||form.file.type==='word') && (
                <button onClick={()=>setPreviewFile(form.file!)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Pré-visualizar"><Eye className="w-3.5 h-3.5"/></button>
              )}
              <button onClick={()=>set(p=>({...p,file:undefined}))} className="text-gray-300 hover:text-red-500 transition-colors" title="Remover"><X className="w-3.5 h-3.5"/></button>
            </div>
          ) : (
            <button onClick={()=>fileRef.current?.click()} className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-[12px] text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Anexar documento (PDF, Excel, Word)
            </button>
          )}
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={()=>{ if(form.name){onAdd(form);onClose()} }} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Adicionar Ativo</button>
        </div>
      </div>
    </Modal>
  )
}

// ── FilePreviewModal ───────────────────────────────────────────────────────────
function FilePreviewModal({ file, onClose }: { file: OIAFile; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    async function load() {
      try {
        if (file.type === 'pdf') {
          // PDF — usa o data URL directamente no iframe
          setContent(file.data)
          setLoading(false)
          return
        }

        if (file.type === 'excel') {
          // Excel — converte para tabela HTML via xlsx (já instalado)
          const XLSX = await import('xlsx')
          const base64 = file.data.split(',')[1]
          const binary  = atob(base64)
          const bytes   = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const wb  = XLSX.read(bytes, { type: 'array' })
          const ws  = wb.Sheets[wb.SheetNames[0]]
          const html = XLSX.utils.sheet_to_html(ws, { id: 'xl-preview', editable: false })
          setContent(html)
          setLoading(false)
          return
        }

        if (file.type === 'word') {
          // Word — converte .docx para HTML via mammoth (carregado dinamicamente)
          const mammoth = await import('mammoth')
          const base64  = file.data.split(',')[1]
          const binary  = atob(base64)
          const bytes   = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
          setContent(result.value)
          setLoading(false)
          return
        }

        setError('Tipo de ficheiro sem preview disponível.')
        setLoading(false)
      } catch {
        setError('Não foi possível carregar o preview deste ficheiro.')
        setLoading(false)
      }
    }
    load()
  }, [file])

  const fileIcon = file.type === 'pdf' ? '📄' : file.type === 'excel' ? '📊' : file.type === 'word' ? '📝' : '📎'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl" style={{ height: '90vh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 shrink-0">
          <span className="text-lg">{fileIcon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{file.name}</div>
            <div className="text-[10px] text-gray-400">{file.size} · {file.uploadedAt}</div>
          </div>
          <a href={file.data} download={file.name} title="Descarregar" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
            <Download className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">A carregar preview…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3">⚠️</div>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && content && (
            <>
              {file.type === 'pdf' && (
                <iframe src={content} className="w-full h-full rounded-b-2xl border-0" title={file.name} />
              )}

              {file.type === 'excel' && (
                <div className="overflow-auto h-full p-4">
                  <style>{`
                    #xl-preview { border-collapse: collapse; font-size: 12px; width: 100%; }
                    #xl-preview td, #xl-preview th {
                      border: 1px solid #e5e7eb; padding: 4px 8px;
                      white-space: nowrap; color: #374151;
                    }
                    #xl-preview tr:first-child td { background: #f9fafb; font-weight: 600; }
                    #xl-preview tr:hover td { background: #f0f9ff; }
                  `}</style>
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              )}

              {file.type === 'word' && (
                <div className="overflow-auto h-full p-8">
                  <style>{`
                    .word-preview { max-width: 800px; margin: 0 auto; font-size: 14px; line-height: 1.7; color: #1f2937; }
                    .word-preview h1 { font-size: 1.5rem; font-weight: 700; margin: 1.2em 0 0.5em; }
                    .word-preview h2 { font-size: 1.2rem; font-weight: 700; margin: 1em 0 0.4em; }
                    .word-preview h3 { font-size: 1rem; font-weight: 600; margin: 0.8em 0 0.3em; }
                    .word-preview p  { margin: 0.5em 0; }
                    .word-preview table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                    .word-preview td, .word-preview th { border: 1px solid #d1d5db; padding: 6px 10px; }
                    .word-preview th { background: #f9fafb; font-weight: 600; }
                    .word-preview ul, .word-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
                    .word-preview strong { font-weight: 700; }
                    .word-preview em { font-style: italic; }
                  `}</style>
                  <div className="word-preview" dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FileSection ────────────────────────────────────────────────────────────────
function FileSection({ files, onUpload, onDelete }:{ files:OIAFile[]; onUpload:(f:OIAFile)=>void; onDelete:(id:string)=>void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewFile, setPreviewFile] = useState<OIAFile | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result as string
      const newFile: OIAFile = {
        id: uid(),
        name: file.name,
        size: formatSize(file.size),
        type: fileTypeFromName(file.name),
        uploadedAt: new Date().toISOString().slice(0,10),
        data,
      }
      onUpload(newFile)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const canPreview = (f: OIAFile) => f.type === 'pdf' || f.type === 'excel' || f.type === 'word'

  return (
    <div className="space-y-3">
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Documentos ({files.length})</span>
        <button
          onClick={()=>inputRef.current?.click()}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg"
        >
          <Upload className="w-3 h-3"/>Carregar
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".doc,.docx,.xls,.xlsx,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {files.length === 0 && (
        <div className="py-4 text-center text-[12px] text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
          Sem documentos carregados.
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-800 truncate">{f.name}</div>
                <div className="text-[10px] text-gray-400">{f.size} · {f.uploadedAt}</div>
              </div>
              {canPreview(f) && (
                <button onClick={() => setPreviewFile(f)} className="text-gray-400 hover:text-blue-600 shrink-0 transition-colors" title="Pré-visualizar">
                  <Eye className="w-3.5 h-3.5"/>
                </button>
              )}
              <a href={f.data} download={f.name} className="text-gray-400 hover:text-blue-600 shrink-0 transition-colors" title="Descarregar">
                <Download className="w-3.5 h-3.5"/>
              </a>
              <button onClick={()=>onDelete(f.id)} className="text-gray-300 hover:text-red-500 shrink-0 transition-colors" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Org cards ──────────────────────────────────────────────────────────────────
function CatCard({ cat, count, selected, onClick }:{ cat:Cat; count:number; selected:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} className={clsx(
      'rounded-xl border-2 px-5 py-4 text-center transition-all w-full',
      selected
        ? 'border-blue-600 bg-blue-600 text-white shadow-lg ring-2 ring-blue-200'
        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md text-gray-800',
    )}>
      <div className={clsx('text-[9px] font-bold uppercase tracking-widest mb-1', selected ? 'text-blue-200' : 'text-gray-400')}>{cat.sublabel}</div>
      <div className="text-[13px] font-bold leading-tight">{cat.label}</div>
      <div className={clsx('text-[10px] mt-1.5 font-medium', selected ? 'text-blue-100' : 'text-gray-400')}>{count} fundos</div>
    </button>
  )
}

function GroupCard({ group, count, selected, onClick }:{ group:FundGroup; count:number; selected:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} className={clsx(
      'rounded-xl border-2 px-3 py-3 text-left transition-all w-full',
      selected
        ? 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-200'
        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md',
    )}>
      <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide mb-1">Grupo · {group.fundIds.length} subfundos</div>
      <div className="text-[12px] font-bold text-gray-900 leading-tight">{group.shortName}</div>
      <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{group.name}</div>
      <div className={clsx('mt-2 pt-2 border-t border-gray-100 text-[9px] font-semibold', count > 0 ? 'text-indigo-600' : 'text-gray-400')}>{count} participadas</div>
    </button>
  )
}

function TypePill({ type }:{ type:FundType }) {
  return <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', type==='FCR'?'bg-blue-100 text-blue-700':type==='FIAA'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700')}>{type}</span>
}

function FundCard({ fund, compCount, selected, onClick, onAdd }:{ fund:Fund; compCount:number; selected:boolean; onClick:()=>void; onAdd:()=>void }) {
  return (
    <div className="relative group w-full">
      <button onClick={onClick} className={clsx('rounded-xl border-2 px-3 py-3 text-left transition-all w-full', selected?'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-200':'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md')}>
        <div className="flex items-center justify-between gap-1 mb-2"><TypePill type={fund.type}/><span className="text-[9px] text-gray-400 font-medium">{fund.vintage}</span></div>
        <div className="text-[11px] font-bold text-gray-900 leading-tight">{fund.shortName}</div>
        <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{fund.name}</div>
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
          <span className="text-[11px] font-semibold text-gray-700">{fund.size}</span>
          <span className={clsx('text-[9px] font-semibold', compCount>0?'text-blue-600':'text-gray-400')}>{compCount} emp.</span>
        </div>
      </button>
      <button onClick={e=>{e.stopPropagation();onAdd()}} title="Adicionar empresa" className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-blue-700 z-10"><Plus className="w-3 h-3"/></button>
    </div>
  )
}

function MoicBadge({ moic }:{ moic:number | string | null | undefined }) {
  const m = Number(moic)
  if (!m) return null
  return <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', m>=2?'bg-green-100 text-green-700':m>=1?'bg-blue-100 text-blue-700':'bg-red-100 text-red-700')}>{fmtMoic(m)}</span>
}

function CompanyCard({ company, allFunds, selected, onClick, onAdd }:{ company:Company; allFunds:Fund[]; selected:boolean; onClick:()=>void; onAdd:()=>void }) {
  const labels = company.funds.map(fid=>allFunds.find(f=>f.id===fid)?.shortName??fid)
  return (
    <div className="relative group w-full">
      <button onClick={onClick} className={clsx('rounded-xl border-2 px-3 py-3 text-left transition-all w-full', selected?'border-emerald-600 bg-emerald-50 shadow-lg ring-2 ring-emerald-200':'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md')}>
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <Building2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0"/>
          <div className="flex items-center gap-1 flex-wrap justify-end"><MoicBadge moic={company.moic}/><span className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',company.status==='Ativa'?'bg-green-100 text-green-700':company.status==='Em saída'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600')}>{company.status}</span></div>
        </div>
        <div className="text-[11px] font-bold text-gray-900 leading-tight">{company.name}</div>
        {company.sector&&<div className="text-[10px] text-gray-400 mt-0.5">{company.sector}</div>}
        {labels.length>0&&<div className="flex flex-wrap gap-0.5 mt-1.5">{labels.map(l=><span key={l} className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">{l}</span>)}</div>}
        <div className="grid grid-cols-2 gap-x-2 mt-2 pt-2 border-t border-gray-100">
          <div><div className="text-[9px] text-gray-400">Stake</div><div className="text-[11px] font-bold text-gray-800">{company.stake?`${company.stake}%`:'—'}</div></div>
          <div><div className="text-[9px] text-gray-400">NAV</div><div className="text-[11px] font-bold text-gray-800">{fmtM(company.nav)}</div></div>
        </div>
      </button>
      <button onClick={e=>{e.stopPropagation();onAdd()}} className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-emerald-700 z-10"><Plus className="w-3 h-3"/></button>
    </div>
  )
}

const ASSET_ICON: Record<AssetType, React.ReactNode> = {
  'Empresa':              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Ativo Mobiliário':    <BarChart3  className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Ativo Imobiliário':   <Landmark   className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Instrumento de Dívida': <Coins    className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Infraestrutura':      <Zap        className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Matéria-Prima':       <Package    className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Direitos de PI':      <Cpu        className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
  'Criptoativo':         <Coins      className="w-3.5 h-3.5 text-amber-500 shrink-0"/>,
  'Outro':               <HelpCircle className="w-3.5 h-3.5 text-gray-400 shrink-0"/>,
}

function AssetCard({ asset }:{ asset:Asset }) {
  const sc = asset.status==='Ativo'?'bg-green-100 text-green-700':asset.status==='Em saída'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600'
  const sub = (()=>{
    switch(asset.assetType){
      case 'Empresa':             return [asset.sector,asset.country,asset.stake?`${asset.stake}%`:null].filter(Boolean).join(' · ')
      case 'Ativo Mobiliário':   return [asset.assetClass,asset.ticker].filter(Boolean).join(' · ')
      case 'Ativo Imobiliário':  return [asset.propertyType,asset.location,asset.area?`${asset.area}m²`:null].filter(Boolean).join(' · ')
      case 'Instrumento de Dívida': return [asset.isin,asset.rate?`${asset.rate}%`:null,asset.maturity].filter(Boolean).join(' · ')
      case 'Infraestrutura':     return [asset.infraSector,asset.location].filter(Boolean).join(' · ')
      case 'Matéria-Prima':      return [asset.commodity,asset.quantity&&asset.unit?`${asset.quantity} ${asset.unit}`:asset.quantity||null].filter(Boolean).join(' · ')
      case 'Direitos de PI':     return [asset.ipType,asset.territory].filter(Boolean).join(' · ')
      case 'Criptoativo':        return [asset.cryptoSymbol,asset.quantity].filter(Boolean).join(' · ')
      case 'Outro':              return asset.description||null
      default:                   return null
    }
  })()
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 w-full shadow-sm">
      <div className="flex items-start justify-between gap-1 mb-2">{ASSET_ICON[asset.assetType]}<span className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',sc)}>{asset.status}</span></div>
      <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{asset.assetType}</div>
      <div className="text-[11px] font-bold text-gray-900 leading-tight">{asset.name}</div>
      {sub&&<div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-end">
        <div><div className="text-[9px] text-gray-400">Valor</div><div className="text-[11px] font-bold text-gray-800">{asset.value||'—'}</div></div>
        <div className="text-right"><div className="text-[9px] text-gray-400">Entrada</div><div className="text-[11px] font-bold text-gray-800">{asset.entry||'—'}</div></div>
      </div>
      {asset.file && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-600">
          <FileText className="w-3 h-3 shrink-0"/><span className="truncate">{asset.file.name}</span>
        </div>
      )}
    </div>
  )
}

// ── Reusable org section wrapper ───────────────────────────────────────────────
function OrgSection({ color='blue', header, stemLeft, rowMinW, children }: {
  color?: 'blue'|'indigo'|'emerald'; header: React.ReactNode; stemLeft?: string; rowMinW: number; children: React.ReactNode
}) {
  const border = color==='emerald'?'border-emerald-100':color==='indigo'?'border-indigo-100':'border-blue-100'
  const stemColor = color==='emerald'?'#10b981':color==='indigo'?'#6366f1':'#60a5fa'
  return (
    <div className={clsx('bg-white rounded-2xl border p-6 overflow-x-auto', border)}>
      {header}
      {stemLeft && (
        <div className="relative h-5" style={{ minWidth: rowMinW }}>
          <div className="absolute top-0 bottom-0 w-px" style={{ left: stemLeft, background: stemColor }} />
        </div>
      )}
      <div style={{ minWidth: rowMinW }}>{children}</div>
    </div>
  )
}

// ── Add Tranche Modal ──────────────────────────────────────────────────────────
function AddTrancheModal({ company, allFunds, onClose, onAdd }:{ company:Company; allFunds:Fund[]; onClose:()=>void; onAdd:(t:Omit<Tranche,'id'>)=>void }) {
  const fundOptions = allFunds.filter(f=>company.funds.includes(f.id))
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewFile, setPreviewFile] = useState<OIAFile | null>(null)
  const [form, set] = useState<Omit<Tranche,'id'>>({
    date: new Date().toISOString().slice(0,10),
    fund: fundOptions[0]?.id ?? '',
    type: 'Equity',
    amount: 0,
    shares: 0,
    notes: '',
    file: undefined,
  })
  const s = (k: keyof Omit<Tranche,'id'>) => (v: string | number) => set(p => ({ ...p, [k]: v }))

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = evt => {
      const oiaFile: OIAFile = {
        id: uid(), name: f.name, size: formatSize(f.size),
        type: fileTypeFromName(f.name), uploadedAt: new Date().toISOString().slice(0,10),
        data: evt.target?.result as string,
      }
      set(p => ({ ...p, file: oiaFile }))
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  return (
    <Modal title={`Nova Tranche — ${company.name}`} onClose={onClose}>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data"><input className={inp} type="date" value={form.date} onChange={e=>s('date')(e.target.value)}/></Field>
          <Field label="Fundo">
            <select className={inp} value={form.fund} onChange={e=>s('fund')(e.target.value)}>
              <option value="">—</option>
              {allFunds.map(f=><option key={f.id} value={f.id}>{f.shortName}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Tipo">
          <select className={inp} value={form.type} onChange={e=>s('type')(e.target.value as TrancheType)}>
            <option>Equity</option><option>CLN</option><option>SAFE</option><option>Mútuo</option><option>Prest. Suplementares</option><option>Outro</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Montante (€)"><input className={inp} type="number" value={form.amount||''} onChange={e=>s('amount')(Number(e.target.value))}/></Field>
          <Field label="Acções"><input className={inp} type="number" value={form.shares||''} onChange={e=>s('shares')(Number(e.target.value))}/></Field>
        </div>
        <Field label="Notas"><input className={inp} value={form.notes} onChange={e=>s('notes')(e.target.value)} placeholder="Opcional"/></Field>
        <Field label="Documento (opcional)">
          <input ref={fileRef} type="file" accept=".doc,.docx,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileChange} />
          {form.file ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 text-[12px] text-gray-700 truncate">{form.file.name}</span>
              <span className="text-[10px] text-gray-400">{form.file.size}</span>
              {(form.file.type === 'pdf' || form.file.type === 'excel' || form.file.type === 'word') && (
                <button onClick={() => setPreviewFile(form.file!)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Pré-visualizar"><Eye className="w-3.5 h-3.5"/></button>
              )}
              <button onClick={() => set(p => ({ ...p, file: undefined }))} className="text-gray-300 hover:text-red-500 transition-colors" title="Remover"><X className="w-3.5 h-3.5"/></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-[12px] text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Anexar documento (PDF, Excel, Word)
            </button>
          )}
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={()=>{ onAdd(form); onClose() }} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Tranches panel ─────────────────────────────────────────────────────────────
function TranchesPanel({ company, allFunds, onAdd, onAttachFile, onRemoveFile }:{
  company: Company; allFunds: Fund[]; onAdd: () => void
  onAttachFile: (tid: string, f: OIAFile) => void
  onRemoveFile: (tid: string) => void
}) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [targetTid,    setTargetTid]    = useState<string | null>(null)
  const [previewFile,  setPreviewFile]  = useState<OIAFile | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !targetTid) return
    const reader = new FileReader()
    reader.onload = evt => {
      onAttachFile(targetTid, {
        id: uid(), name: f.name, size: formatSize(f.size),
        type: fileTypeFromName(f.name), uploadedAt: new Date().toISOString().slice(0,10),
        data: evt.target?.result as string,
      })
      setTargetTid(null)
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const canPreview = (f: OIAFile) => f.type === 'pdf' || f.type === 'excel' || f.type === 'word'

  return (
    <div>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      <input ref={fileRef} type="file" accept=".doc,.docx,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {company.tranches.length} tranche{company.tranches.length !== 1 ? 's' : ''}
        </span>
        <button onClick={onAdd} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5"/>Nova Tranche
        </button>
      </div>
      {company.tranches.length === 0
        ? <div className="py-4 text-center text-[12px] text-gray-400 italic border border-dashed border-gray-200 rounded-lg">Sem tranches registadas.</div>
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Fundo</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-right font-medium">Montante</th>
                <th className="px-4 py-2 text-right font-medium">Acções</th>
                <th className="px-4 py-2 text-left font-medium">Notas</th>
                <th className="px-4 py-2 text-center font-medium">Doc.</th>
              </tr>
            </thead>
            <tbody>
              {company.tranches.map(t => {
                const fl = allFunds.find(f => f.id === t.fund)?.shortName ?? t.fund
                return (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-[12px] text-gray-600">{t.date}</td>
                    <td className="px-4 py-2"><span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{fl}</span></td>
                    <td className="px-4 py-2"><span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{t.type}</span></td>
                    <td className="px-4 py-2 text-right text-[12px] font-semibold text-gray-800">{fmtM(t.amount)}</td>
                    <td className="px-4 py-2 text-right text-[12px] text-gray-600">{t.shares ? t.shares.toLocaleString('pt-PT') : '—'}</td>
                    <td className="px-4 py-2 text-[12px] text-gray-500">{t.notes || '—'}</td>
                    <td className="px-4 py-2 text-center">
                      {t.file ? (
                        <div className="flex items-center justify-center gap-1">
                          {canPreview(t.file) && (
                            <button onClick={() => setPreviewFile(t.file!)} title="Pré-visualizar" className="text-gray-400 hover:text-blue-600 transition-colors"><Eye className="w-3.5 h-3.5"/></button>
                          )}
                          <a href={t.file.data} download={t.file.name} title={t.file.name} className="text-gray-400 hover:text-blue-600 transition-colors"><Download className="w-3.5 h-3.5"/></a>
                          <button onClick={() => onRemoveFile(t.id)} title="Remover documento" className="text-gray-300 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setTargetTid(t.id); fileRef.current?.click() }}
                          title="Anexar documento"
                          className="text-gray-300 hover:text-blue-600 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5"/>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      }
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function OIA() {
  const [oiaTab, setOiaTab] = useState<OIATab>('portfolio')

  const [funds,     setFunds]     = useState<Fund[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const initialised = useRef(false)

  useEffect(() => {
    Promise.all([
      sbLoad<Fund>('oia_funds', 'oia_funds', INITIAL_FUNDS.map(f => ({ ...f, files: [] })))
        .then(rows => rows.map(r => ({ ...r, shortName: (r as any).shortname ?? r.shortName }))),
      sbLoad<Company>('oia_companies', 'oia_companies', INITIAL_COMPANIES.map(c => ({ ...c, files: [] }))),
    ]).then(([f, c]) => { setFunds(f); setCompanies(c); initialised.current = true })
  }, [])

  useEffect(() => {
    if (!initialised.current) return
    void sbSaveAll('oia_funds', 'oia_funds', funds)
  }, [funds])

  useEffect(() => {
    if (!initialised.current) return
    void sbSaveAll('oia_companies', 'oia_companies', companies)
  }, [companies])

  const [selCat,  setSelCat]  = useState<CatId|null>(null)
  const [selGid,  setSelGid]  = useState<GroupId|null>(null)
  const [selFund, setSelFund] = useState<string|null>(null)
  const [selCo,   setSelCo]   = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<'tranches'|'assets'|'docs'>('tranches')

  const [showFundModal,   setShowFundModal]   = useState(false)
  const [showCompModal,   setShowCompModal]   = useState(false)
  const [assetCompId,     setAssetCompId]     = useState<string|null>(null)
  const [trancheCompId,   setTrancheCompId]   = useState<string|null>(null)
  const [search,          setSearch]          = useState('')

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedFund = funds.find(f=>f.id===selFund)??null
  const selectedCo   = companies.find(c=>c.id===selCo)??null
  const selectedGroup = FUND_GROUPS.find(g=>g.id===selGid)??null

  const catItems: CatItem[] =
    selCat==='fcr' ? FCR_ITEMS :
    selCat==='mob' ? MOB_IDS.map(fid=>({kind:'fund' as const,fid})) :
    selCat==='esp' ? ESP_IDS.map(fid=>({kind:'fund' as const,fid})) : []

  const groupFundIds = selectedGroup?.fundIds ?? []
  const visibleCos   = selFund ? companies.filter(c=>c.funds.includes(selFund)) : []

  // company counts
  const compCountForFund  = (fid:string) => companies.filter(c=>c.funds.includes(fid)).length
  const compCountForGroup = (gid:GroupId) => { const ids=FUND_GROUPS.find(g=>g.id===gid)!.fundIds; return companies.filter(c=>c.funds.some(f=>ids.includes(f))).length }
  const catFundCount = (cat:CatId) => {
    if (cat==='fcr') return funds.filter(f=>![...MOB_IDS,...ESP_IDS].includes(f.id)).length
    if (cat==='mob') return MOB_IDS.filter(id=>funds.some(f=>f.id===id)).length
    return ESP_IDS.filter(id=>funds.some(f=>f.id===id)).length
  }

  // ── Stem percentages ──────────────────────────────────────────────────────
  const catIdx = CATS.findIndex(c=>c.id===selCat)
  const catStem = stemPct(catIdx, CATS.length)

  const catItemIdx = catItems.findIndex(item=>
    (item.kind==='group'&&item.gid===selGid) ||
    (item.kind==='fund'&&item.fid===selFund&&!selGid)
  )
  const catItemStem = stemPct(catItemIdx, catItems.length)

  const groupFundIdx = groupFundIds.indexOf(selFund??'')
  const groupFundStem = stemPct(groupFundIdx, groupFundIds.length)

  const companyStem  = selGid ? groupFundStem : catItemStem

  // minWidths
  const CAT_W  = 3  * 190
  const ITEM_W = Math.max(catItems.length, 1) * 148
  const GRP_W  = Math.max(groupFundIds.length, 1) * 148
  const CO_W   = Math.max(visibleCos.length, 1) * 148

  // ── Mutations ─────────────────────────────────────────────────────────────
  function addFund(d:Omit<Fund,'id'|'files'>)   { setFunds(p=>[...p,{...d,id:uid(),files:[]}]) }
  function addCompany(d:Omit<Company,'id'|'assets'|'files'>) { setCompanies(p=>[...p,{...d,id:uid(),assets:[],files:[]}]) }
  function addAsset(cid:string,d:Omit<Asset,'id'>)   { setCompanies(p=>p.map(c=>c.id===cid?{...c,assets:[...c.assets,{...d,id:uid()}]}:c)) }
  function addTranche(cid:string,d:Omit<Tranche,'id'>) { setCompanies(p=>p.map(c=>c.id===cid?{...c,tranches:[...c.tranches,{...d,id:uid()}]}:c)) }
  function updateTrancheFile(cid:string, tid:string, file:OIAFile|null) {
    setCompanies(p=>p.map(co=>co.id!==cid?co:{...co,tranches:co.tranches.map(t=>t.id!==tid?t:{...t,file:file??undefined})}))
  }

  function addFundFile(fid:string, f:OIAFile)    { setFunds(p=>p.map(fund=>fund.id===fid?{...fund,files:[...fund.files,f]}:fund)) }
  function deleteFundFile(fid:string, fileId:string) { setFunds(p=>p.map(fund=>fund.id===fid?{...fund,files:fund.files.filter(f=>f.id!==fileId)}:fund)) }
  function addCompanyFile(cid:string, f:OIAFile) { setCompanies(p=>p.map(co=>co.id===cid?{...co,files:[...co.files,f]}:co)) }
  function deleteCompanyFile(cid:string, fileId:string) { setCompanies(p=>p.map(co=>co.id===cid?{...co,files:co.files.filter(f=>f.id!==fileId)}:co)) }

  // ── Pipeline approve callbacks ────────────────────────────────────────────
  function handleApproveInvestimento(item: PipelineItem) {
    if (item.companyId) {
      // Add tranche to existing company
      addTranche(item.companyId, {
        date: item.dataProposta, fund: item.fundId,
        type: item.trancheType,  amount: item.amount,
        shares: item.shares,     notes: item.notes,
      })
    } else {
      // Create new company
      addCompany({
        name: item.companyName, sector: item.sector,
        country: item.country,  stage: item.stage,
        funds: item.fundId ? [item.fundId] : [],
        stake: 0, invested: item.amount, equityInvested: item.amount,
        nav: 0,   moic: 0,   rentEquity: 0, totalShares: item.shares,
        status: 'Ativa',
        tranches: [{
          id: uid(), date: item.dataProposta, fund: item.fundId,
          type: item.trancheType, amount: item.amount,
          shares: item.shares,    notes: item.notes,
        }],
      })
    }
  }

  function handleApproveDesinvestimento(item: PipelineItem) {
    if (item.companyId) {
      setCompanies(p => p.map(c =>
        c.id === item.companyId ? { ...c, status: 'Em saída' as const } : c
      ))
    }
  }

  // ── Download CSV ──────────────────────────────────────────────────────────
  function downloadPortfolioCSV() {
    const headers = ['Empresa','Setor','País','Fundos','Stake%','Total Inv.','Equity Inv.','NAV','MOIC','Rent.Equity%','Estado']
    const rows = companies.map(c => {
      const fundNames = c.funds.map(fid=>funds.find(f=>f.id===fid)?.shortName??fid).join(' | ')
      return [
        c.name,
        c.sector,
        c.country,
        fundNames,
        c.stake ? c.stake.toString() : '0',
        c.invested ? c.invested.toString() : '0',
        c.equityInvested ? c.equityInvested.toString() : '0',
        c.nav ? c.nav.toString() : '0',
        c.moic ? c.moic.toFixed(2) : '0',
        c.rentEquity ? c.rentEquity.toFixed(1) : '0',
        c.status,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
    })
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'portfolio_oia.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const searchFunds     = q ? funds.filter(f => f.shortName.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)).slice(0,6) : []
  const searchCompanies = q ? companies.filter(c => c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q)).slice(0,6) : []
  const hasResults      = searchFunds.length > 0 || searchCompanies.length > 0

  function goToFund(fid:string) {
    const catId:CatId = MOB_IDS.includes(fid)?'mob':ESP_IDS.includes(fid)?'esp':'fcr'
    const grp = FUND_GROUPS.find(g=>g.fundIds.includes(fid))
    setSelCat(catId); setSelGid(grp?.id??null); setSelFund(fid); setSelCo(null)
    setSearch('')
  }
  function goToCompany(co:Company) {
    const fid = co.funds[0]
    if (fid) {
      const catId:CatId = MOB_IDS.includes(fid)?'mob':ESP_IDS.includes(fid)?'esp':'fcr'
      const grp = FUND_GROUPS.find(g=>g.fundIds.includes(fid))
      setSelCat(catId); setSelGid(grp?.id??null); setSelFund(fid)
    }
    setSelCo(co.id); setActiveTab('tranches'); setSearch('')
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function clickCat(id:CatId)   { if(selCat===id){setSelCat(null)}else{setSelCat(id)};setSelGid(null);setSelFund(null);setSelCo(null) }
  function clickGroup(gid:GroupId) { if(selGid===gid){setSelGid(null)}else{setSelGid(gid)};setSelFund(null);setSelCo(null) }
  function clickFund(fid:string) { if(selFund===fid){setSelFund(null)}else{setSelFund(fid)};setSelCo(null) }

  const totalInvested = companies.reduce((s,c)=>s+Number(c.invested||0),0)
  const totalNAV      = companies.reduce((s,c)=>s+Number(c.nav||0),0)
  const avgMoic       = (()=>{ const w=companies.filter(c=>Number(c.moic)>0); return w.length?w.reduce((s,c)=>s+Number(c.moic),0)/w.length:0 })()

  // ── Tab definitions ──────────────────────────────────────────────────────
  const TAB_DEFS: { id: OIATab; label: string; icon: React.ReactNode }[] = [
    { id: 'portfolio',       label: 'Portfolio',         icon: <BarChart3 size={13}/> },
    { id: 'investimentos',   label: 'Investimentos',     icon: <Plus size={13}/> },
    { id: 'desinvestimentos',label: 'Desinvestimentos',  icon: <Download size={13}/> },
    { id: 'comparacao',      label: 'Comparação',        icon: <GitCompareArrows size={13}/> },
  ]

  const companyRefs = companies.map(c => ({ id: c.id, name: c.name, funds: c.funds }))
  const fundRefs    = funds.map(f => ({ id: f.id, shortName: f.shortName }))

  const TabBar = () => (
    <div className="flex border-b border-gray-200 bg-white px-6">
      {TAB_DEFS.map(t => (
        <button key={t.id} onClick={() => setOiaTab(t.id)}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors',
            oiaTab === t.id
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-400 hover:text-gray-700',
          )}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )

  if (oiaTab === 'comparacao') {
    return (
      <div>
        <TabBar/>
        <Comparacao/>
      </div>
    )
  }

  if (oiaTab === 'investimentos') {
    return (
      <div>
        <TabBar/>
        <Pipeline
          kind="investimento"
          companies={companyRefs}
          funds={fundRefs}
          onApprove={handleApproveInvestimento}
        />
      </div>
    )
  }

  if (oiaTab === 'desinvestimentos') {
    return (
      <div>
        <TabBar/>
        <Pipeline
          kind="desinvestimento"
          companies={companyRefs}
          funds={fundRefs}
          onApprove={handleApproveDesinvestimento}
        />
      </div>
    )
  }

  return (
    <div>
      <TabBar/>
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">OIA — Organização de Investimentos Alternativos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            BlueCrow SCR · {funds.length} fundos · {companies.length} participadas · {fmtM(totalInvested)} investido · NAV {fmtM(totalNAV)} · MOIC médio {avgMoic.toFixed(2)}x
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadPortfolioCSV} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors border border-gray-200"><Download className="w-4 h-4"/>Exportar CSV</button>
          <button onClick={()=>setShowFundModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"><Plus className="w-4 h-4"/>Novo Fundo</button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <Search className="w-4 h-4 text-gray-400 shrink-0"/>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>e.key==='Escape'&&setSearch('')}
            placeholder="Pesquisar fundo ou participada…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none"
          />
          {search && (
            <button onClick={()=>setSearch('')} className="text-gray-300 hover:text-gray-600 shrink-0">
              <X className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {q && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-40 overflow-hidden">
            {!hasResults ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Sem resultados para "{search}"</div>
            ) : (
              <>
                {searchFunds.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fundos</div>
                    {searchFunds.map(f=>(
                      <button key={f.id} onMouseDown={()=>goToFund(f.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left">
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase', f.type==='FCR'?'bg-blue-100 text-blue-700':f.type==='FIAA'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700')}>{f.type}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-gray-900 truncate">{f.shortName}</div>
                          <div className="text-[11px] text-gray-400 truncate">{f.name}</div>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{f.vintage}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchCompanies.length > 0 && (
                  <div className={clsx(searchFunds.length > 0 && 'border-t border-gray-100')}>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Participadas</div>
                    {searchCompanies.map(c=>{
                      const fundLabels = c.funds.map(fid=>funds.find(f=>f.id===fid)?.shortName??fid)
                      return (
                        <button key={c.id} onMouseDown={()=>goToCompany(c)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-gray-900 truncate">{c.name}</div>
                            <div className="text-[11px] text-gray-400 truncate">{c.sector||'—'} · {fundLabels.join(', ')}</div>
                          </div>
                          <span className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', c.status==='Ativa'?'bg-green-100 text-green-700':c.status==='Em saída'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500')}>{c.status}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Levels 1–5: Single unified org chart panel ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 overflow-x-auto">
        {/* Level 1+2: SCR → Categories */}
        <div className="flex justify-center">
          <div className="bg-[#0f1f3d] text-white rounded-xl px-8 py-3 shadow-lg text-center min-w-[240px]">
            <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest mb-0.5">Sociedade de Capitais de Risco</div>
            <div className="text-[15px] font-bold">BlueCrow — SCR, S.A.</div>
            <div className="text-[10px] text-gray-400 mt-0.5">CMVM Registada</div>
          </div>
        </div>
        <div className="flex justify-center"><div className="org-stem"/></div>
        <div className="org-row" style={{ minWidth: CAT_W }}>
          {CATS.map(cat=>(
            <div key={cat.id} className="org-col" style={{ minWidth:176, maxWidth:240 }}>
              <div className="org-stem"/>
              <CatCard cat={cat} count={catFundCount(cat.id)} selected={selCat===cat.id} onClick={()=>clickCat(cat.id)} />
            </div>
          ))}
        </div>

        {/* Level 3: Category items */}
        {selCat && catItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <button onClick={()=>{setSelCat(null);setSelGid(null);setSelFund(null);setSelCo(null)}} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4"/></button>
                <ChevronRight className="w-4 h-4 text-gray-300"/>
                <span>{CATS.find(c=>c.id===selCat)!.label} <span className="text-gray-400 font-normal text-xs">— {catItems.length} {selCat==='fcr'?'fundos / grupos':'fundos'}</span></span>
              </div>
              <button onClick={()=>setShowCompModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5"/>Nova Empresa</button>
            </div>
            <div className="relative h-3" style={{ minWidth: ITEM_W }}>
              <div className="absolute top-0 bottom-0 w-px" style={{ left: catStem, background: '#60a5fa' }} />
            </div>
            <div className="flex justify-center"><div className="org-stem-blue"/></div>
            <div className="org-row" style={{ minWidth: ITEM_W }}>
              {catItems.map((item,i)=>(
                <div key={i} className="org-col" style={{minWidth:136,maxWidth:164}}>
                  <div className="org-stem-blue"/>
                  {item.kind==='group' ? (
                    <GroupCard
                      group={FUND_GROUPS.find(g=>g.id===item.gid)!}
                      count={compCountForGroup(item.gid)}
                      selected={selGid===item.gid}
                      onClick={()=>clickGroup(item.gid)}
                    />
                  ) : (
                    <FundCard
                      fund={funds.find(f=>f.id===item.fid)!}
                      compCount={compCountForFund(item.fid)}
                      selected={selFund===item.fid&&!selGid}
                      onClick={()=>clickFund(item.fid)}
                      onAdd={()=>{setSelFund(item.fid);setShowCompModal(true)}}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Level 4: Group funds */}
            {selGid && selectedGroup && (
              <div className="mt-3 pt-3 border-t border-dashed border-indigo-200">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <button onClick={()=>{setSelGid(null);setSelFund(null);setSelCo(null)}} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4"/></button>
                    <ChevronRight className="w-4 h-4 text-gray-300"/>
                    <span>{selectedGroup.shortName} <span className="text-gray-400 font-normal text-xs">— {selectedGroup.fundIds.length} subfundos</span></span>
                  </div>
                  <button onClick={()=>setShowCompModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5"/>Nova Empresa</button>
                </div>
                <div className="relative h-3" style={{ minWidth: GRP_W }}>
                  <div className="absolute top-0 bottom-0 w-px" style={{ left: catItemStem, background: '#6366f1' }} />
                </div>
                <div className="flex justify-center"><div className="org-stem-blue" style={{background:'#6366f1'}}/></div>
                <div className="org-row" style={{ minWidth: GRP_W }}>
                  {selectedGroup.fundIds.map(fid=>{
                    const fund = funds.find(f=>f.id===fid)
                    if (!fund) return null
                    return (
                      <div key={fid} className="org-col" style={{minWidth:136,maxWidth:164}}>
                        <div className="org-stem-blue" style={{background:'#6366f1'}}/>
                        <FundCard
                          fund={fund}
                          compCount={compCountForFund(fid)}
                          selected={selFund===fid}
                          onClick={()=>clickFund(fid)}
                          onAdd={()=>{setSelFund(fid);setShowCompModal(true)}}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Level 5: Companies — inside same panel */}
            {selFund && selectedFund && (
              <div className="mt-3 pt-3 border-t border-dashed border-blue-200">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <button onClick={()=>{setSelFund(null);setSelCo(null)}} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4"/></button>
                    <ChevronRight className="w-4 h-4 text-gray-300"/>
                    <span>{selectedFund.shortName} <span className="text-gray-400 font-normal text-xs">— Participadas ({visibleCos.length})</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileSection
                      files={selectedFund.files}
                      onUpload={f=>addFundFile(selectedFund.id, f)}
                      onDelete={fileId=>deleteFundFile(selectedFund.id, fileId)}
                    />
                    <button onClick={()=>setShowCompModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5"/>Nova Empresa</button>
                  </div>
                </div>
                {visibleCos.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">Sem participadas — clica em <strong>Nova Empresa</strong> para adicionar.</div>
                ) : (
                  <>
                    <div className="flex justify-center"><div className="org-stem-blue"/></div>
                    <div className="org-row" style={{ minWidth: CO_W }}>
                      {visibleCos.map(co=>(
                        <div key={co.id} className="org-col" style={{minWidth:136,maxWidth:164}}>
                          <div className="org-stem-blue"/>
                          <CompanyCard
                            company={co} allFunds={funds}
                            selected={selCo===co.id}
                            onClick={()=>{setSelCo(p=>p===co.id?null:co.id);setActiveTab('tranches')}}
                            onAdd={()=>setAssetCompId(co.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Level 6: Company detail (outside the main panel) ── */}
      {selectedCo && (
        <OrgSection
          color="emerald"
          rowMinW={CO_W}
          header={
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <button onClick={()=>setSelCo(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4"/></button>
                <ChevronRight className="w-4 h-4 text-gray-300"/>
                <span>{selectedCo.name} <span className="text-gray-400 font-normal text-xs">— Detalhe</span></span>
              </div>
              <button onClick={()=>setAssetCompId(selectedCo.id)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5"/>Novo Ativo</button>
            </div>
          }
        >
          <div className="grid grid-cols-4 gap-4 mt-2 mb-4">
            {[
              {l:'Stake',           v:selectedCo.stake?`${selectedCo.stake}%`:'—'},
              {l:'Total Investido', v:fmtM(selectedCo.invested)},
              {l:'NAV',             v:fmtM(selectedCo.nav)},
              {l:'MOIC',            v:fmtMoic(selectedCo.moic)},
            ].map(({l,v})=>(
              <div key={l} className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 mb-0.5">{l}</div>
                <div className="text-[14px] font-bold text-gray-900">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex border-b border-gray-100 mb-4">
            {(['tranches','assets','docs'] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} className={clsx('px-4 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors', activeTab===tab?'text-blue-700 border-blue-600':'text-gray-400 border-transparent hover:text-gray-700')}>
                {tab==='tranches'?`Tranches (${selectedCo.tranches.length})`:tab==='assets'?`Ativos (${selectedCo.assets.length})`:`Documentos (${selectedCo.files.length})`}
              </button>
            ))}
          </div>
          {activeTab==='tranches' && <TranchesPanel company={selectedCo} allFunds={funds} onAdd={()=>setTrancheCompId(selectedCo.id)} onAttachFile={(tid,f)=>updateTrancheFile(selectedCo.id,tid,f)} onRemoveFile={tid=>updateTrancheFile(selectedCo.id,tid,null)}/>}
          {activeTab==='assets' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  {selectedCo.assets.length} ativo{selectedCo.assets.length!==1?'s':''}
                </span>
                <button onClick={()=>setAssetCompId(selectedCo.id)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg">
                  <Plus className="w-3.5 h-3.5"/>Adicionar Ativo
                </button>
              </div>
              {selectedCo.assets.length===0
                ? <div className="py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl italic">Sem ativos registados — clica em <strong>Adicionar Ativo</strong> para começar.</div>
                : <div className="org-row">{selectedCo.assets.map(a=><div key={a.id} className="org-col" style={{minWidth:158,maxWidth:200}}><AssetCard asset={a}/></div>)}</div>
              }
            </div>
          )}
          {activeTab==='docs' && (
            <FileSection
              files={selectedCo.files}
              onUpload={f=>addCompanyFile(selectedCo.id, f)}
              onDelete={fileId=>deleteCompanyFile(selectedCo.id, fileId)}
            />
          )}
        </OrgSection>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {selectedFund ? `Participadas — ${selectedFund.shortName}` : 'Todas as Participadas'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{(selFund?visibleCos:companies).length} empresa(s)</p>
          </div>
          <div className="flex items-center gap-3">
            {selFund&&<button onClick={()=>{setSelFund(null);setSelCo(null)}} className="text-xs text-blue-600 hover:underline">Ver todas</button>}
            <button onClick={()=>setShowCompModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5"/>Nova Empresa</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {(selFund?visibleCos:companies).length===0
            ? <div className="px-6 py-10 text-center text-sm text-gray-400 italic">Sem participadas registadas.</div>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium">Setor</th>
                    <th className="px-4 py-3 text-left font-medium">País</th>
                    <th className="px-4 py-3 text-left font-medium">Fundos</th>
                    <th className="px-4 py-3 text-right font-medium">Stake</th>
                    <th className="px-4 py-3 text-right font-medium">Total Inv.</th>
                    <th className="px-4 py-3 text-right font-medium">Equity Inv.</th>
                    <th className="px-4 py-3 text-right font-medium">NAV</th>
                    <th className="px-4 py-3 text-right font-medium">MOIC</th>
                    <th className="px-4 py-3 text-right font-medium">Rent. Eq.</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(selFund?visibleCos:companies).map((row,i)=>{
                    const labels = row.funds.map(fid=>funds.find(f=>f.id===fid)?.shortName??fid)
                    return (
                      <tr key={row.id}
                        className={clsx('border-b border-gray-50 hover:bg-gray-50 cursor-pointer', i%2===0?'bg-white':'bg-gray-50/40', selCo===row.id&&'bg-emerald-50/40')}
                        onClick={()=>{
                          if(!selFund&&row.funds.length>0){
                            const catForFund = MOB_IDS.includes(row.funds[0])?'mob':ESP_IDS.includes(row.funds[0])?'esp':'fcr'
                            setSelCat(catForFund)
                            setSelFund(row.funds[0])
                          }
                          setSelCo(p=>p===row.id?null:row.id)
                          setActiveTab('tranches')
                        }}
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900 text-[12px]">{row.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-[12px]">{row.sector||'—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-[12px]">{row.country||'—'}</td>
                        <td className="px-4 py-2.5"><div className="flex flex-wrap gap-0.5">{labels.map(l=><span key={l} className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">{l}</span>)}{!labels.length&&<span className="text-gray-400 text-[12px]">—</span>}</div></td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[12px] text-gray-800">{row.stake?`${row.stake}%`:'—'}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{fmtM(row.invested)}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-gray-700">{fmtM(row.equityInvested)}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-800">{fmtM(row.nav)}</td>
                        <td className="px-4 py-2.5 text-right"><span className={clsx('text-[11px] font-bold', Number(row.moic)>=2?'text-green-600':Number(row.moic)>=1?'text-blue-600':Number(row.moic)>0?'text-red-500':'text-gray-400')}>{row.moic?fmtMoic(row.moic):'—'}</span></td>
                        <td className="px-4 py-2.5 text-right text-[12px]">{(()=>{ const re=Number(row.rentEquity); return re?<span className={clsx('font-medium',re>0?'text-green-600':re<0?'text-red-500':'text-gray-400')}>{re.toFixed(1)}%</span>:'—' })()}</td>
                        <td className="px-4 py-2.5"><span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', row.status==='Ativa'?'bg-green-50 text-green-700':row.status==='Em saída'?'bg-amber-50 text-amber-700':'bg-gray-100 text-gray-500')}>{row.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      </div>

      {/* ── Modals ── */}
      {showFundModal && <AddFundModal onClose={()=>setShowFundModal(false)} onAdd={addFund}/>}
      {showCompModal && <AddCompanyModal funds={funds} defaultFundId={selFund??undefined} onClose={()=>setShowCompModal(false)} onAdd={addCompany}/>}
      {assetCompId   && <AddAssetModal companyName={companies.find(c=>c.id===assetCompId)?.name??''} onClose={()=>setAssetCompId(null)} onAdd={d=>addAsset(assetCompId,d)}/>}
      {trancheCompId && (() => { const co = companies.find(c=>c.id===trancheCompId); return co ? <AddTrancheModal company={co} allFunds={funds} onClose={()=>setTrancheCompId(null)} onAdd={d=>addTranche(trancheCompId,d)}/> : null })()}
    </div>
    </div>
  )
}
