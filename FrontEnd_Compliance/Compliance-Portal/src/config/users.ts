// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E CONSTANTES DE PERFIS
// Os utilizadores são geridos na base de dados (tabela portal_users)
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'gestor' | 'analista' | 'viewer'

export type Portal = 'compliance' | 'asset_valuation'

export interface AppUser {
  id:       string
  email:    string
  name:     string
  initials: string
  role:     Role
  portals:  Portal[]
  active:   boolean
}

// ── Labels de role (para exibição) ────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  admin:    'Administrador',
  gestor:   'Gestor de Compliance',
  analista: 'Analista',
  viewer:   'Visualizador',
}

export const ROLE_COLORS: Record<Role, string> = {
  admin:    'bg-red-100 text-red-700',
  gestor:   'bg-blue-100 text-blue-700',
  analista: 'bg-amber-100 text-amber-700',
  viewer:   'bg-gray-100 text-gray-600',
}

// ── Permissões por módulo ──────────────────────────────────────────────────────
export type Permission =
  | 'compliance:write'
  | 'controlo:write'
  | 'riscos:write'
  | 'pbcft:write'
  | 'rgpd:write'
  | 'oia:write'
  | 'users:manage'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'compliance:write',
    'controlo:write',
    'riscos:write',
    'pbcft:write',
    'rgpd:write',
    'oia:write',
    'users:manage',
  ],
  gestor: [
    'compliance:write',
    'controlo:write',
    'riscos:write',
    'pbcft:write',
    'rgpd:write',
    'oia:write',
  ],
  analista: [
    'compliance:write',
    'riscos:write',
  ],
  viewer: [],
}
