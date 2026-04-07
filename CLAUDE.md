# BlueCrow Capital — Plataforma Interna

## Visão geral

Plataforma React + Vite + TypeScript com múltiplos sub-portais independentes.
API Node.js/Express em `/API` com duas bases de dados PostgreSQL (compliance e asset valuation).

```
Portal/
├── API/                          ← Node.js/Express (porta 3001)
│   └── src/
│       ├── index.js              ← registo de rotas
│       ├── db.js                 ← pools: avPool, compPool
│       └── routes/
│           ├── compStore.js      ← CRUD genérico (tabelas comp_*)
│           ├── admin.js          ← /api/admin/users (CRUD utilizadores)
│           └── ...
└── FrontEnd_Compliance/
    └── Compliance-Portal/
        └── src/
            ├── App.tsx           ← router principal (hub + sub-portais)
            ├── portals/          ← cada sub-portal aqui
            │   ├── hub/          ← PortalHub (login + seleção de portal)
            │   ├── compliance/   ← já existente
            │   ├── asset-valuation/
            │   └── admin/
            ├── pages/            ← páginas internas do portal Compliance
            ├── context/
            │   └── AuthContext.tsx
            ├── store/
            │   └── useStore.ts   ← Zustand (estado global)
            └── config/
                └── users.ts      ← tipos Role, Portal, AppUser
```

---

## Como adicionar um novo sub-portal

### 1. Criar a pasta do portal

```
src/portals/<nome>/
└── <Nome>Portal.tsx
```

### 2. Requisitos obrigatórios do componente raiz

```tsx
// O portal DEVE aceitar onBackToHub como prop
export function MeuPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user, logout } = useAuth()
  // ...
}
```

**Posição padrão das features transversais: canto inferior esquerdo do sidebar.**

O portal DEVE ter dois botões no footer do sidebar:
- **"Portal"** (`LayoutGrid` icon) → chama `onBackToHub()` — volta ao hub de seleção
- **"Sair"** (`LogOut` icon) → chama `logout()` depois `onBackToHub()` — termina sessão

Exemplo para portais de tema escuro (dark sidebar):
```tsx
// imports: import { LayoutGrid, LogOut } from 'lucide-react'
// imports: import { useAuth } from '@/context/AuthContext'
const { user, logout } = useAuth()

// No footer do sidebar:
<div className="px-4 py-4 border-t border-white/5 space-y-3">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[9px] font-bold">
      {user.initials}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-slate-200 text-[11px] font-semibold leading-none truncate">{user.name.split(' ')[0]}</div>
      <div className="text-slate-500 text-[9px] mt-0.5 capitalize">{user.role}</div>
    </div>
  </div>
  <div className="flex gap-2">
    <button onClick={onBackToHub}
      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium
                 text-slate-400 hover:text-white hover:bg-white/10 px-2.5 py-1.5
                 rounded-lg transition-colors border border-white/10">
      <LayoutGrid size={11} /> Portal
    </button>
    <button onClick={() => { logout(); onBackToHub() }}
      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium
                 text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5
                 rounded-lg transition-colors border border-white/10">
      <LogOut size={11} /> Sair
    </button>
  </div>
</div>
```

> **Não colocar estes botões no Topbar/header** — pertencem ao sidebar inferior esquerdo.

### 3. Registar o portal em PortalHub.tsx

Ficheiro: `src/portals/hub/PortalHub.tsx`

```tsx
// Adicionar ao tipo
export type PortalId = '...' | 'meu-portal'

// Adicionar ao array PORTALS
{
  id:          'meu-portal',
  title:       'Nome do Portal',
  subtitle:    'Portal Subtitle',
  description: 'Descrição curta para o card no hub.',
  gradient:    'from-emerald-800 via-teal-900 to-slate-900',  // classe Tailwind
  iconPath:    'M...',   // SVG path string (24x24 viewBox)
  active:      true,
  // adminOnly: true,    // opcional — só visível para admins
}

// Se precisar de controlo de acesso por utilizador, adicionar a PORTAL_KEY:
const PORTAL_KEY = {
  'meu-portal': 'meu_portal',  // deve coincidir com o valor em portal_users.portals[]
}
```

### 4. Registar a rota em App.tsx

Ficheiro: `src/App.tsx`

```tsx
import { MeuPortal } from '@/portals/meu-portal/MeuPortal'

// Dentro de AppContent, após os outros portais:
if (activePortal === 'meu-portal') {
  return <MeuPortal onBackToHub={() => onSelectPortal('hub')} />
}
```

---

## Autenticação

```tsx
import { useAuth } from '@/context/AuthContext'

const { user, logout, can, canPortal, isAdmin, authLoading } = useAuth()
```

- `user` — utilizador autenticado (`AppUser | null`)
- `user.role` — `'admin' | 'gestor' | 'analista' | 'viewer'`
- `user.portals` — array de portais a que tem acesso: `'compliance' | 'asset_valuation' | ...`
- `isAdmin` — `true` se `user.role === 'admin'`
- `can('compliance:write')` — verifica permissão específica
- `authLoading` — `true` enquanto os utilizadores estão a ser carregados da BD

**Não fazer redirect durante o render.** Usar `useEffect`:
```tsx
useEffect(() => {
  if (!authLoading && !user) onBackToHub()
}, [authLoading, user])
```

---

## API

Base URL: `http://localhost:3001`

### Rotas existentes

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/comp/:tabela` | Ler tabela compliance (ver whitelist em compStore.js) |
| POST | `/api/comp/:tabela` | Upsert por `id` |
| DELETE | `/api/comp/:tabela/:id` | Eliminar registo |
| GET | `/api/admin/users` | Lista utilizadores (sem password) |
| POST | `/api/admin/users` | Criar ou atualizar utilizador |
| DELETE | `/api/admin/users/:id` | Eliminar utilizador |
| GET | `/api/health` | Estado das duas BDs |

### Criar novas rotas de API

1. Criar `API/src/routes/<nome>.js`
2. Registar em `API/src/index.js`:
   ```js
   const meuRouter = require('./routes/meu-portal')
   app.use('/api/meu-portal', meuRouter)
   ```
3. **Reiniciar o servidor** após alterar `index.js`

### Bases de dados

- `compPool` — BD compliance (tabelas `comp_*`, `portal_users`)
- `avPool` — BD asset valuation

---

## Símbolo BlueCrow

O símbolo da marca é `/simbolo.ico` (ficheiro estático em `public/`).
Usar sempre este símbolo no cabeçalho/logo de todos os portais — **nunca** substituir por ícones lucide ou letras.

```tsx
// Sidebar com fundo claro (ex: portal Compliance)
<img src="/simbolo.ico" alt="BlueCrow" className="w-8 h-8 object-contain" />

// Sidebar com fundo escuro (ex: Admin, Asset Valuation, Hub)
<img src="/simbolo.ico" alt="BlueCrow" className="w-6 h-6 object-contain"
     style={{ filter: 'brightness(0) invert(1)' }} />
```

---

## Estilo e design

- **Framework CSS:** Tailwind CSS
- **Tema do hub e sidebars de portais:** dark (`bg-slate-900`, texto `text-slate-*`)
- **Tema de páginas internas:** light (`bg-[#f5f6fa]`, branco)
- **Componentes:** sem biblioteca de UI — tudo custom com Tailwind
- **Ícones:** `lucide-react`
- **Gradientes dos cards do hub:** usar `from-*-800 via-*-900 to-slate-900`

---

## Controlo de acesso por portal

A tabela `portal_users` tem uma coluna JSONB `portals` com os portais a que cada utilizador tem acesso.

Para um novo portal com controlo de acesso:
1. Adicionar a chave em `PORTAL_KEY` em `PortalHub.tsx`
2. A chave deve ser adicionada ao array `portals` de cada utilizador pelo admin (via Painel Administrador)
3. O hub filtra automaticamente os portais visíveis com base nesta configuração

---

## Padrões importantes

### Dados da BD com colunas camelCase

PostgreSQL devolve colunas em lowercase. Se o tipo TypeScript usa camelCase, normalizar após fetch:
```ts
rows.map(r => ({ ...r, shortName: (r as any).shortname ?? r.shortName }))
```

### JSONB arrays em inserções

Ao inserir arrays em colunas JSONB via node-postgres, usar `JSON.stringify`:
```js
// CORRETO
params = [..., JSON.stringify(portals ?? [])]
// ERRADO — node-postgres serializa como array PostgreSQL {a,b} em vez de JSON [\"a\",\"b\"]
params = [..., portals]
```

### Registo de auditoria

Todas as ações relevantes devem ser registadas:
```ts
import { useStore } from '@/store/useStore'
useStore.getState().addAuditLog({
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT',
  entity: 'Nome da entidade',
  entity_label: 'Descrição legível',
})
```
