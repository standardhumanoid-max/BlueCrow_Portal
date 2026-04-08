# ComplianceHub — Portal Interno

Portal de compliance interno para a BlueCrow Capital.
Stack: **React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Recharts**

---

## Arranque rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
# Edita o ficheiro .env com as tuas chaves Supabase

# 3. Arrancar em modo desenvolvimento
npm run dev
# → http://localhost:5173
```

---

## Estrutura de ficheiros

```
src/
├── components/
│   ├── layout/        ← Sidebar.tsx, Topbar.tsx
│   └── ui/            ← Badge.tsx, KpiCard.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Compliance.tsx
│   ├── ControloInterno.tsx
│   ├── GestaoRiscos.tsx
│   ├── PBCFT/index.tsx     ← KYC completo com gráficos
│   ├── RGPD/index.tsx      ← Checklist, Matriz, DPIA
│   ├── QuadroRegulatorio.tsx
│   └── Placeholder.tsx
├── store/
│   └── useStore.ts    ← Estado global (Zustand)
├── types/
│   └── index.ts       ← Todos os tipos TypeScript
├── hooks/
│   └── useExport.ts   ← Exportar PDF e Excel
└── services/
    └── supabase.ts    ← Cliente Supabase
```

---

## Regra de ouro

**Cada secção do portal = 1 ficheiro independente.**
Mexer em `RGPD/index.tsx` nunca pode quebrar `PBCFT/index.tsx`.

---

## Adicionar uma nova página

1. Cria `src/pages/NovaPagina.tsx`
2. Adiciona o tipo em `src/types/index.ts` (dentro de `PageId`)
3. Adiciona o item no menu em `src/components/layout/Sidebar.tsx`
4. Adiciona o `case` em `src/App.tsx`
5. Adiciona o título em `src/components/layout/Topbar.tsx`

---

## Ligar ao Supabase

1. Vai a **supabase.com** → o teu projeto → Settings → API
2. Copia a URL e a `anon key`
3. Coloca no ficheiro `.env`:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJxxx...
   ```
4. Usa `supabase` de `@/services/supabase` nos teus hooks

---

## Exportar para produção

```bash
npm run build
# Gera a pasta dist/ — copia para o teu servidor ou Docker
```
