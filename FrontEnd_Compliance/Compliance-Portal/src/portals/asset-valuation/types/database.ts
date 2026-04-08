export const FUNDS = ['BIF1','BIF2','BIF3','BIF4','BIF5','Next Tech','Global G.','Growth'] as const
export type Fund = typeof FUNDS[number]

export const CONVERTIBLE = ['SAFE','CLN','Prest. Suplementares'] as const
export type ConvertibleType = typeof CONVERTIBLE[number]
export type TrancheType = ConvertibleType | 'Equity' | 'Mútuo' | 'Evento Cap Table'

export interface Tranche {
  id: string
  fund: Fund
  type: TrancheType
  amount: number
  shares?: number
  pricePerShare?: number
  date?: string
  converted?: boolean
  fromConversion?: boolean
  totalSharesAtEvent?: number
  ownershipOverride?: number | ''
}

export interface Sale {
  id: string
  fund: Fund
  amount: number
  shares?: number
  date?: string
}

export interface LogEntry {
  id: string
  date: string
  text: string
}

export interface FinancialYear {
  id: string
  year: number
  revenue?: number
  equity?: number          // Capital Próprio
  totalAssets?: number
  totalLiabilities?: number
  netProfit?: number
}

export type ShareholderType = 'Founders' | 'VC' | 'Employee' | 'Other'

export interface CapTableShareholder {
  id: string
  name: string
  type: ShareholderType
  shares?: number          // known share count
  pct?: number             // override % if shares unknown
  round?: string           // e.g. "Seed", "Series A"
  notes?: string
}

export interface RunwayData {
  cashBalance?: number     // €
  monthlyBurn?: number     // € / month
  lastUpdated?: string     // date of data
  notes?: string
}

export interface PipelineHistoryEntry {
  id: string
  fromStage?: string
  toStage: string
  changedAt: string
  note?: string
}

export interface PipelineData {
  currentStage?: string
  dates?: Record<string, string>
  notes?: string
  history?: PipelineHistoryEntry[]
}

export const COMPANY_TYPES = ['Equity', 'Imobiliário', 'Outro'] as const
export type CompanyType = typeof COMPANY_TYPES[number]

export const PRIORITY_OPTIONS = ['Alta', 'Média', 'Baixa', 'Watchlist'] as const
export type Priority = typeof PRIORITY_OPTIONS[number]

export interface CompanyDocument {
  id: string
  title: string
  url?: string
}

export interface Company {
  id: string
  name: string
  companyType?: CompanyType
  sector?: string
  country?: string
  website?: string
  balanceteUrl?: string
  summary?: string
  totalShares?: number
  esop?: number
  otherDilutive?: number
  seriesBShares?: number
  seriesBPrice?: number
  priority?: Priority
  scoreFinancial?: number
  scoreLiquidity?: number
  scoreStrategic?: number
  fundShares?: Record<string, number>
  fundSharesOverride?: Record<string, number>
  tranches: Tranche[]
  sales: Sale[]
  log: LogEntry[]
  financials?: FinancialYear[]
  capTable?: CapTableShareholder[]
  runway?: RunwayData
  pipeline?: PipelineData
  documents?: CompanyDocument[]
}

export const VALUATION_METHODS = ['DCF', 'TMR', 'Custo de Aquisição', 'Múltiplos', 'NAV Imobiliário', 'Outro'] as const
export type ValuationMethod = typeof VALUATION_METHODS[number]

export interface DebtAssessmentItem {
  id: string
  label: string          // e.g. "Mútuo BIF3", "Suprimentos BIF1"
  instrumentType?: TrancheType  // tipo do instrumento (para itens externos sem tranche)
  nominalValue: number
  fairValue: number
  rate?: number          // taxa de juro do instrumento (%)
  kd?: number            // taxa de desconto usada (%)
  notes?: string
}

export interface BPAssumptions {
  revenueCagr?: number        // % — CAGR receita no período explícito
  ebitdaMarginTY?: number     // % — EBITDA margin no ano terminal
  ebitMarginTY?: number       // % — EBIT margin no ano terminal
  capexRevenueTY?: number     // % — CAPEX / Receita no ano terminal
  nwcRevenueTY?: number       // % — NWC / Receita no ano terminal
  explicitYears?: number      // nº de anos do período explícito
  notes?: string              // notas livres sobre os pressupostos
}

export interface Valuation {
  id: string
  companyId: string
  date: string
  equityValue: number
  method?: ValuationMethod
  wacc?: number           // %
  beta?: number
  ke?: number             // %
  kd?: number             // %
  notes?: string
  bpPath?: string         // caminho da pasta do BP usado
  bpAssumptions?: BPAssumptions
  debtAssessment?: DebtAssessmentItem[]
}

export interface FundAdjustment {
  id: string
  date: string
  amount: number
  description?: string
  type?: string
}

export interface FundData {
  subscrito: number
  adjustments: FundAdjustment[]
}

export interface AppDatabase {
  companies: Company[]
  valuations: Valuation[]
  funds: Partial<Record<Fund, FundData>>
}
