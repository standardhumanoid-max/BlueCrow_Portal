// URL base da API — configurável via variável de ambiente no build
// Dev: http://localhost:3001   |   LAN: http://192.168.8.186:3001
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'
