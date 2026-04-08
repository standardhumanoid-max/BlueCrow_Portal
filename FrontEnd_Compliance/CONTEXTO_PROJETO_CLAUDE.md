# BlueCrow Capital — Compliance Portal · Contexto do Projeto

## O que é

Portal web interno de compliance para a **BlueCrow Capital**, sociedade gestora portuguesa de SCR (Sociedade de Capital de Risco) e FIA (Fundos de Investimento Alternativo). Desenvolvido em React/TypeScript, corre no browser sem backend dedicado (dados em localStorage + Supabase).

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Estado global | Zustand (`src/store/useStore.ts`) |
| Autenticação | Context próprio (`src/context/AuthContext.tsx`) — utilizadores em `src/config/users.ts` |
| Persistência | localStorage (seed data) + Supabase (dados de compliance) |
| Estilos | Tailwind CSS — classes utilitárias `form-input`, `form-label`, `btn`, `btn-primary`, `btn-outline`, `btn-sm` |
| Ícones | Lucide React |
| IA | Claude API (`claude-sonnet-4-6`) — acesso direto browser com header `anthropic-dangerous-direct-browser-access: true` |
| PDF | jsPDF |

---

## Estrutura de ficheiros relevante

```
src/
  App.tsx                   — roteamento por pageId (switch/case)
  config/users.ts           — utilizadores e roles
  store/useStore.ts         — estado global (currentPage, alertas, loadAll)
  context/AuthContext.tsx   — auth, logout, isAdmin
  components/layout/
    Sidebar.tsx             — menu lateral com NAV sections
    Topbar.tsx              — barra superior
  pages/
    Dashboard.tsx
    Compliance.tsx
    ControloInterno.tsx
    GestaoRiscos.tsx
    PBCFT/
    RGPD/
    OIA/index.tsx           — módulo "Investimentos" (ver detalhes abaixo)
    SCR/index.tsx           — módulo "Fundos" (ver detalhes abaixo)
    CMVM/index.tsx          — módulo "CMVM" (ver detalhes abaixo)
    Legislacao/index.tsx    — módulo "Legislação" com análise IA
    QuadroRegulatorio.tsx
    Reportes/
    AssistenteIA/index.tsx  — chat com Claude API
    Auditoria.tsx
    Ciberseguranca.tsx
    Roadmap.tsx
    Utilizadores/
    Login/
```

---

## Navegação (pageIds no router)

```
dashboard · compliance · controlo · riscos · pbcft · rgpd · regulatorio
legislacao · politicas · formacao · estrutura · oia · scr · cmvm
utilizadores · assistente · reportes · auditoria · ciberseguranca · roadmap
```

**Labels no menu:**
- `oia` → "Investimentos"
- `scr` → "Fundos"
- `cmvm` → "CMVM"

---

## Roles e permissões

```typescript
type Role = 'admin' | 'gestor' | 'analista' | 'viewer'
```
- `admin` — acesso total (Utilizadores, Auditoria, Cibersegurança, Roadmap)
- `gestor` — acesso a Cibersegurança e Roadmap
- `analista` / `viewer` — acesso limitado

---

## Padrões de código

### Persistência localStorage
```typescript
const MY_KEY = 'my_key'
const load = <T,>(key: string, fallback: T[]): T[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
const save = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}
const [items, setItems] = useState<MyType[]>(() => load(MY_KEY, SEED_DATA))
```

### Datas — formato DD.MM.YYYY em display, YYYY-MM-DD em inputs
```typescript
function toInputDate(s: string): string  // DD.MM.YYYY → YYYY-MM-DD
function fromInputDate(s: string): string // YYYY-MM-DD → DD.MM.YYYY
function parseDate(s: string): Date | null // suporta ambos formatos
```

### Drawer lateral (padrão de detalhe/edição)
```tsx
{detailItem && (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDetailItem(null)}/>
    <div className="fixed right-0 top-0 h-full w-[540px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* header + tabs + content */}
    </div>
  </>
)}
```

### Modal
```tsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[600px] max-h-[90vh] overflow-y-auto shadow-xl">
    {/* content */}
  </div>
</div>
```

### Agrupamento por ano em tabelas
```typescript
const byYear = useMemo(() => {
  const map = new Map<number, T[]>()
  for (const item of list) {
    const y = parseDate(item.data)?.getFullYear() ?? 0
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(item)
  }
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
}, [list])
// Renderizar: supByYear.flatMap(([year, items]) => [<tr key={`y-${year}`} header/>, ...items.map(row)])
```

---

## Módulo: Investimentos (`oia`)

Gestão de investimentos e desinvestimentos dos fundos BlueCrow. Regista empresas participadas, ativos (mobiliários, imobiliários, dívida, infraestrutura, etc.) e tranches de investimento.

**Tipos principais:**
```typescript
type FundType      = 'FCR' | 'FIAA' | 'PPR'
type AssetType     = 'Empresa' | 'Ativo Mobiliário' | 'Ativo Imobiliário' | 'Instrumento de Dívida' | 'Infraestrutura' | 'Matéria-Prima' | 'Direitos de PI' | 'Criptoativo' | 'Outro'
type TrancheType   = 'Equity' | 'CLN' | 'SAFE' | 'Mútuo' | 'Prest. Suplementares' | 'Outro'

interface Company { id, name, sector, country, stage, funds: string[], stake, invested, equityInvested, nav, moic, rentEquity, totalShares, status, tranches: Tranche[], assets: Asset[], files: OIAFile[] }
interface Fund    { id, name, shortName, type, vintage, size, status, files }
interface Tranche { id, date, fund, type: TrancheType, amount, shares, notes, file? }
interface Asset   { id, assetType, name, sector, country, stake, value, entry, status, ...type-specific fields }
```

**Organização por categorias:**
- FCR (Capitais de Risco): grupos BCIF I–V, BCDF I, + fundos individuais
- Mobiliários (FIAA · PPR)
- Especializado (Trade Finance)

**~22 empresas participadas** incluindo: Agentifai, KIT-AR, Sensei, IVV Automação, Tonic Easy Medical, Paynest, Bandora, Leadzai, BIGgroup, LEF S.A., Viveiros da Espargueira, Ingredient Odyssey, Oceano Fresco, Congelagos, Silicolife, Ophiomics, Thunder Foods, Gra Nutra, Acecann, Findster, Anybrain, BGW

---

## Módulo: Fundos (`scr`)

Lista de todos os fundos geridos, organizados em 4 segmentos colapsáveis.

**22 fundos:**
| Segmento | IDs |
|---|---|
| FCR — Capitais de Risco | BCIF I–V, Viriatus, BCG I, BCN I, BC Impact, BCNT I, GGT, BCDF I/A–E |
| FIAA — Mobiliários | BC Listed Property, BC Global Discovery, BC Short Term, BC Portugal Select |
| Especializado | BC Trade Finance |
| PPR | BC Global Opp. PPR |

**Nomes completos selecionados:**
- `BCNT1` — BlueCrow Next Tech Fund I, FCR (60M€, vintage 2021)
- `BCDF1D` — BlueCrow Development Fund I — Subfundo D · Hermes Fund (200M€)
- `BCDF1E` — BlueCrow Development Fund I — Subfundo E · Finance Fund (120M€)
- `BCLPF` — BlueCrow Global Listed Property Fund — FIAA (300M€)

---

## Módulo: CMVM (`cmvm`)

Gestão dos processos de supervisão da CMVM e comunicações associadas.

**Tipos:**
```typescript
type SuperEstado = 'Pendente' | 'Em curso' | 'Respondido' | 'Fechado'
type ComEstado   = 'Em preparação' | 'Enviada' | 'Pendente' | 'Arquivo'
type ComTipo     = 'Ofício' | 'Circular' | 'Carta' | 'Email' | 'Outra'

interface Supervisao { id, identificacao, data_comunicacao, assunto, detalhes, responsaveis, departamento, resposta_bc, data_resposta_bc, data_limite, estado, observacoes }
interface SupComunicacao { id, supervisao_id, ref, data, tipo, assunto, responsavel, estado, observacoes }
interface Resposta { id, supervisao_ids: string[], data, descricao, responsavel, ficheiros: RespostaFicheiro[] }
interface Comunicacao { id, ref, data, tipo, assunto, destinatario, responsavel, estado, observacoes }
```

**localStorage keys:** `cmvm_supervisoes`, `cmvm_sup_comunicacoes`, `cmvm_respostas`, `cmvm_comunicacoes`

**Funcionalidades:**
- 17 supervisões reais (SUP/xxx/yyyy/SSM/DPI|DPA e SAI-EMAU/yyyy/xxx)
- Calendário de supervisões com eventos clicáveis (recebido ↓, prazo ⚑, respondido ✓)
- Drawer com 3 tabs: Detalhes | Comunicações | Respostas
- Comunicações específicas por processo (CRUD inline no drawer)
- Respostas com upload de ficheiros e link a múltiplas supervisões
- Tabela agrupada por ano
- Sub-tab "Respostas" com todas as respostas + "Nova Resposta" global

---

## Módulo: Legislação (`legislacao`)

Radar legislativo com análise IA via Claude API.

**3 tabs:** Radar Legislativo | Análise IA | Consultas Públicas

**Tipos:**
```typescript
type TipoDiploma = 'Diretiva UE' | 'Regulamento UE' | 'Lei' | 'Decreto-Lei' | 'Regulamento CMVM' | 'Instrução BdP' | 'Portaria' | 'Outro'
type Impacto = 'Alto' | 'Médio' | 'Baixo' | '—'
interface Diploma { id, titulo, referencia, tipo, autoridade, dataPublicacao, dataVigor, estado, impacto, ambito, descricao, observacoes }
interface AnaliseIA { id, diploma_id, diploma_titulo, data, responsavel, secoes: {titulo, conteudo}[], nivel_impacto }
interface ConsultaPublica { id, titulo, autoridade, abertura, encerramento, estado, link, parecer_bc, observacoes }
```

**Análise IA:** usa `claude-sonnet-4-6`, gera 7 secções (Resumo, Aplicabilidade, Nível de Impacto, Obrigações, Prazos, Diplomas Relacionados, Recomendações). Chave API partilhada com AssistenteIA (`anthropic_api_key` em localStorage).

**10 diplomas seed:** AIFMD II, DORA, CSRD, SFDR, Reg. CMVM 3/2025, EMIR REFIT, AMLR, CRD VI, SFDR Review, EU AI Act

---

## Módulo: Assistente IA (`assistente`)

Chat com Claude API (`claude-sonnet-4-6`). System prompt especializado em compliance SCR/FIA BlueCrow Capital. Chave API gerida pelo utilizador em localStorage.

---

## Outros módulos operacionais

| Módulo | pageId | Estado |
|---|---|---|
| Dashboard | `dashboard` | Operacional — KPIs, alertas, tarefas |
| Compliance | `compliance` | Operacional — obrigações, tarefas, calendário |
| Controlo Interno | `controlo` | Operacional |
| Gestão de Riscos | `riscos` | Operacional — matriz de riscos |
| PBC/FT | `pbcft` | Operacional |
| RGPD | `rgpd` | Operacional |
| Quadro Regulatório | `regulatorio` | Operacional |
| Reportes | `reportes` | Operacional |
| Auditoria | `auditoria` | Operacional — registo de auditoria (admin) |
| Cibersegurança | `ciberseguranca` | Operacional (admin/gestor) |
| Roadmap | `roadmap` | Operacional (admin/gestor) |
| Utilizadores | `utilizadores` | Operacional (admin) |

**Placeholder (em desenvolvimento):** `politicas`, `formacao`, `estrutura`

---

## Responsáveis de compliance (nomes reais usados nos dados)

Florbela Racine · Sandra Lage · Catarina Moreira · Nuno Gaspar · Sofia Lopes · Pedro Costa · Ana Ferreira

---

## Convenções e preferências

- Português europeu em toda a UI (labels, mensagens, toasts)
- Datas sempre em DD.MM.YYYY no display
- Tabelas com `text-[11px]`, badges com `text-[10px]`, cabeçalhos `text-[10px] uppercase tracking-wide`
- Drawer lateral para edição/detalhe; modal centrado para criação
- Confirmação com `confirm()` nativo antes de eliminar
- Badges de estado com cores semânticas: verde=OK, âmbar=pendente, vermelho=urgente/erro, cinzento=fechado
- Sem React Router — navegação por `setPage(pageId)` no Zustand store
- Sem emoji na UI (exceto nos ícones de análise IA)
- Ficheiros guardados como base64 dataURL no localStorage
