import * as XLSX from 'xlsx'
import type { Asset } from './api'

export interface ImportedValuationRow {
  asset_name: string
  years: { year: string; value: number | null }[]
}

export interface ParsedImport {
  assets: Partial<Asset>[]
  valuations: ImportedValuationRow[]
  errors: string[]
  detectedHeaders: string[]
  unmappedHeaders: string[]
}

// ── Column map: normalised Excel header → Asset DB field ──────────────────────
// Matches the clean ga_assets schema. Excel variants listed per field.

export const ASSET_COL_MAP: Record<string, keyof Asset> = {
  // Identity
  name:                'name',
  spv:                 'spv',
  location:            'location',
  typology:            'typology',
  land_area:           'land_area',
  build_area:          'build_area',
  build_are:           'build_area',
  tenant:              'tenant',
  acquisition_date:    'acquisition_date',
  maps_link:           'maps_link',
  general_notes:       'general_notes',
  status:              'status',

  // Acquisition costs
  purchase_price:      'purchase_price',
  stamp_duty:          'stamp_duty',
  notary_fees:         'notary_fees',
  notary_fee:          'notary_fees',

  // CAPEX
  capex_current:       'capex_current',
  capex_curr:          'capex_current',
  apex_curr:           'capex_current',
  capex_realizado:     'capex_current',

  // OPEX
  opex_current:        'opex_current',
  opex_curr:           'opex_current',
  opex_realizado:      'opex_current',

  // Capital cost
  capital_cost:        'capital_cost',         // rate %
  capital_cost_v:      'capital_cost_v',        // override value
  capital_cost_valor:  'capital_cost_v',

  // Income
  income_current:      'income_current',
  income_curr:         'income_current',
  income_atual:        'income_current',

  // Sale
  bidding_offer:       'bidding_offer',
  bidding_off:         'bidding_offer',
  oferta:              'bidding_offer',
  transaction_fee:     'transaction_fee',
  fee_transacao:       'transaction_fee',
  commercialization:   'commercialization',
  margem_comercializacao: 'commercialization',
  asking_price:        'asking_price',
  preco_pedido:        'asking_price',
}

// Columns to silently ignore (computed / display-only in Excel)
export const IGNORED_COLS = new Set([
  'noi',
  'valor_inv',
  'valor_avr',
  'valor invxcorr',
  'valor avrxcorr',
  'valor_invxcorr',
  'valor_avrxcorr',
  'breakeven',
  'break_even',
  'yield',
  'asking_bcc',
  'bluecrow_gross',
  'bluecrow_net',
  'delta_asking',
  'delta_bov',
  'custo_total',
  'break_even_cash',
])

const NUMERIC_FIELDS = new Set<keyof Asset>([
  'land_area', 'build_area',
  'purchase_price', 'stamp_duty', 'notary_fees',
  'capex_current', 'opex_current',
  'capital_cost', 'capital_cost_v',
  'income_current',
  'bidding_offer', 'transaction_fee', 'commercialization', 'asking_price',
])

export function normaliseKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
}

// ── Main parser ────────────────────────────────────────────────────────────────

export function parseImportFile(file: File): Promise<ParsedImport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'))
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })

        const errors: string[] = []

        const assetsSheetName    = workbook.SheetNames.find(s => s.toUpperCase() === 'APP_ASSETS')
        const valuationsSheetName = workbook.SheetNames.find(s => s.toUpperCase() === 'APP_VALUATIONS')

        if (!assetsSheetName) {
          return resolve({
            assets: [], valuations: [], errors: ['Folha APP_ASSETS não encontrada no ficheiro.'],
            detectedHeaders: [], unmappedHeaders: [],
          })
        }

        const assetsSheet = workbook.Sheets[assetsSheetName]
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(assetsSheet, {
          defval: null,
          raw: false,
        })

        const detectedHeaders: string[] = rawRows.length > 0 ? Object.keys(rawRows[0]) : []
        const unmappedHeaders: string[] = []

        detectedHeaders.forEach(h => {
          const norm = normaliseKey(h)
          if (!IGNORED_COLS.has(norm) && !ASSET_COL_MAP[norm]) {
            unmappedHeaders.push(h)
          }
        })

        const assets: Partial<Asset>[] = []

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i]
          const asset: Partial<Asset> = {}
          let hasName = false

          for (const [rawCol, rawVal] of Object.entries(row)) {
            const normKey = normaliseKey(rawCol)
            if (IGNORED_COLS.has(normKey)) continue

            const fieldName = ASSET_COL_MAP[normKey]
            if (!fieldName) continue

            if (fieldName === 'name') {
              if (!rawVal) continue
              hasName = true
              asset.name = String(rawVal).trim()
              continue
            }

            if (rawVal === null || rawVal === '' || rawVal === undefined) {
              ;(asset as any)[fieldName] = null
              continue
            }

            if (NUMERIC_FIELDS.has(fieldName)) {
              const cleaned = String(rawVal)
                .replace(/[€$\s]/g, '')
                .replace(/\.(?=\d{3}(,|$))/g, '')
                .replace(',', '.')
              const n = parseFloat(cleaned)
              ;(asset as any)[fieldName] = isNaN(n) ? null : n
            } else if (fieldName === 'acquisition_date') {
              const d = new Date(rawVal)
              ;(asset as any)[fieldName] = isNaN(d.getTime()) ? String(rawVal) : d.toISOString().slice(0, 10)
            } else {
              ;(asset as any)[fieldName] = String(rawVal).trim() || null
            }
          }

          if (!hasName) {
            errors.push(`Linha ${i + 2}: campo "name" ausente — ignorada.`)
            continue
          }

          for (const f of NUMERIC_FIELDS) {
            if ((asset as any)[f] === undefined) (asset as any)[f] = null
          }

          assets.push(asset)
        }

        // ── Parse APP_VALUATIONS ──
        const valuations: ImportedValuationRow[] = []

        if (valuationsSheetName) {
          const valSheet = workbook.Sheets[valuationsSheetName]
          const valRows: Record<string, any>[] = XLSX.utils.sheet_to_json(valSheet, {
            defval: null,
            raw: false,
          })

          for (let i = 0; i < valRows.length; i++) {
            const row = valRows[i]
            const firstKey = Object.keys(row)[0]
            const assetName = row[firstKey]
            if (!assetName) continue

            const years: { year: string; value: number | null }[] = []

            for (const [col, val] of Object.entries(row)) {
              if (col === firstKey) continue
              if (/^\d{4}$/.test(String(col).trim())) {
                const cleaned = String(val ?? '').replace(/[€$\s]/g, '').replace(',', '.')
                const n = parseFloat(cleaned)
                years.push({ year: String(col).trim(), value: isNaN(n) ? null : n })
              }
            }

            if (years.length > 0) {
              valuations.push({ asset_name: String(assetName).trim(), years })
            }
          }
        }

        resolve({ assets, valuations, errors, detectedHeaders, unmappedHeaders })
      } catch (err: any) {
        reject(new Error(`Erro ao processar ficheiro: ${err.message}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
