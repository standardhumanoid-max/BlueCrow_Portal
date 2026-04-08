-- ============================================================
-- Compliance Portal — Schema Inicial
-- Colar no Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ─── 1. COMPLIANCE TASKS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_tasks (
  id           text PRIMARY KEY,
  tarefa       text NOT NULL,
  area         text NOT NULL,
  responsavel  text NOT NULL,
  prazo        text NOT NULL,
  prioridade   text NOT NULL CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
  estado       text NOT NULL CHECK (estado IN ('Em curso', 'Por iniciar', 'Em atraso', 'Concluído')),
  progresso    integer NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  created_at   timestamptz DEFAULT now()
);

-- ─── 2. RISKS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risks (
  id            text PRIMARY KEY,
  risco         text NOT NULL,
  categoria     text NOT NULL,
  probabilidade integer NOT NULL CHECK (probabilidade BETWEEN 1 AND 5),
  impacto       integer NOT NULL CHECK (impacto BETWEEN 1 AND 5),
  estado        text NOT NULL CHECK (estado IN ('Crítico', 'Alto', 'Médio', 'Baixo')),
  responsavel   text NOT NULL,
  mitigacao     text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ─── 3. KYC CLIENTS ──────────────────────────────────────────
-- funds e docs guardados como JSONB (arrays)
CREATE TABLE IF NOT EXISTS kyc_clients (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('Pessoa Coletiva', 'Pessoa Singular', 'Investidor Institucional')),
  nif         text NOT NULL,
  nat         text NOT NULL,
  dom         text NOT NULL,
  ubo         text NOT NULL,
  inv         text NOT NULL,
  funds       jsonb NOT NULL DEFAULT '[]',
  risk        text NOT NULL CHECK (risk IN ('Baixo', 'Médio', 'Alto')),
  status      text NOT NULL CHECK (status IN ('Aceite', 'Em Revisão', 'Pendente', 'Recusado')),
  pep         boolean NOT NULL DEFAULT false,
  entrada     text,
  aceite      text,
  comment     text,
  docs        jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now()
);

-- ─── 4. INCUMPRIMENTOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS incumprimentos (
  id          text PRIMARY KEY,
  descricao   text NOT NULL,
  area        text NOT NULL,
  data        text NOT NULL,
  gravidade   text NOT NULL CHECK (gravidade IN ('Alta', 'Média', 'Baixa')),
  estado      text NOT NULL CHECK (estado IN ('Em análise', 'Atribuída', 'Resolvida', 'Fechada')),
  created_at  timestamptz DEFAULT now()
);

-- ─── 5. RGPD CHECKLIST ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS rgpd_checklist (
  id           text PRIMARY KEY,
  secao        text NOT NULL,
  item         text NOT NULL,
  prioridade   text NOT NULL CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
  responsavel  text NOT NULL,
  frequencia   text NOT NULL,
  referencia   text NOT NULL,
  evidencias   text NOT NULL,
  done         boolean NOT NULL DEFAULT false
);

-- ─── 6. RGPD MATRIZ DE TRATAMENTO ────────────────────────────
CREATE TABLE IF NOT EXISTS rgpd_matriz_tratamento (
  id               text PRIMARY KEY,
  nome             text NOT NULL,
  dept             text NOT NULL,
  descricao        text NOT NULL,
  base_legal       text NOT NULL,
  prazo            text NOT NULL,
  dados_sensiveis  text NOT NULL CHECK (dados_sensiveis IN ('Sim', 'Não')),
  pia              text NOT NULL CHECK (pia IN ('Sim', 'Não')),
  partilha         text NOT NULL,
  risco            text NOT NULL CHECK (risco IN ('Baixo', 'Médio', 'Alto')),
  created_at       timestamptz DEFAULT now()
);

-- ─── 7. DPIAS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dpias (
  id              text PRIMARY KEY,
  nome            text NOT NULL,
  controller      text NOT NULL,
  importadores    text NOT NULL,
  pais            text NOT NULL,
  dpo             text NOT NULL,
  mecanismo       text NOT NULL,
  risco_residual  text NOT NULL CHECK (risco_residual IN ('Baixo', 'Médio', 'Alto')),
  cnpd            text NOT NULL CHECK (cnpd IN ('Sim', 'Não')),
  finalidades     text NOT NULL,
  mitigacao       text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Por agora desativado para uso interno sem autenticação.
-- Ativar quando implementares login.
-- ============================================================
ALTER TABLE compliance_tasks        DISABLE ROW LEVEL SECURITY;
ALTER TABLE risks                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_clients             DISABLE ROW LEVEL SECURITY;
ALTER TABLE incumprimentos          DISABLE ROW LEVEL SECURITY;
ALTER TABLE rgpd_checklist          DISABLE ROW LEVEL SECURITY;
ALTER TABLE rgpd_matriz_tratamento  DISABLE ROW LEVEL SECURITY;
ALTER TABLE dpias                   DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA — Dados iniciais de exemplo
-- ============================================================

-- Compliance Tasks
INSERT INTO compliance_tasks (id, tarefa, area, responsavel, prazo, prioridade, estado, progresso) VALUES
  ('PAC-001', 'Revisão da política de conflitos de interesse', 'Governance',    'Ana Martins', '31 Mar 2026', 'Alta',  'Em curso',    60),
  ('PAC-002', 'Atualização do manual de compliance',           'Documentação',  'João Costa',  '15 Abr 2026', 'Alta',  'Por iniciar', 0),
  ('PAC-003', 'Formação obrigatória — RGPD',                   'Formação',      'Carla Neves', '30 Abr 2026', 'Média', 'Em atraso',   30),
  ('PAC-004', 'Auditoria interna Q1',                          'Auditoria',     'Ana Martins', '5 Abr 2026',  'Alta',  'Em curso',    45),
  ('PAC-005', 'Relatório semestral ao conselho',               'Reporting',     'João Costa',  '30 Jun 2026', 'Média', 'Por iniciar', 0),
  ('PAC-006', 'Revisão de procedimentos KYC',                  'PBC/FT',        'Rui Silva',   '20 Mar 2026', 'Alta',  'Em atraso',   75)
ON CONFLICT (id) DO NOTHING;

-- Risks
INSERT INTO risks (id, risco, categoria, probabilidade, impacto, estado, responsavel, mitigacao) VALUES
  ('R-01', 'Incumprimento regulatório CMVM',    'Regulatório', 4, 5, 'Crítico', 'Ana Martins', 'Monitorização mensal da legislação.'),
  ('R-02', 'Violação de dados pessoais (RGPD)', 'Operacional', 3, 5, 'Alto',    'Carla Neves', 'Encriptação e controlos de acesso.'),
  ('R-03', 'Branqueamento de capitais',         'PBC/FT',      2, 5, 'Alto',    'Rui Silva',   'Revisão KYC trimestral.'),
  ('R-04', 'Falha de continuidade de negócio',  'Operacional', 2, 4, 'Médio',   'João Costa',  'Plano de continuidade anual.'),
  ('R-05', 'Conflito de interesses',            'Governance',  3, 3, 'Médio',   'Ana Martins', 'Registo obrigatório de conflitos.'),
  ('R-06', 'Erro operacional em reporting',     'Operacional', 3, 2, 'Baixo',   'Carla Neves', 'Dupla validação antes de submissão.')
ON CONFLICT (id) DO NOTHING;

-- KYC Clients
INSERT INTO kyc_clients (id, name, type, nif, nat, dom, ubo, inv, funds, risk, status, pep, entrada, aceite, comment, docs) VALUES
  ('CLI-001', 'Grupo Ferreira & Associados, S.A.', 'Pessoa Coletiva',         'PT502134876', 'Portugal',    'Lisboa',      'Manuel Ferreira', '250.000€', '["Portuguese Agrobusiness Fund","Finance Fund"]',          'Baixo', 'Aceite',     false, '2024-01-15', '2024-02-03', 'Perfil baixo risco. Revisão: Jan 2027.',          '[{"n":"Cartão ID","s":"ok"},{"n":"Comprovativo Morada","s":"ok"},{"n":"Origem de Fundos","s":"ok"}]'),
  ('CLI-002', 'Investimentos Silva & Costa, Lda.', 'Pessoa Coletiva',         'PT509876543', 'Portugal',    'Porto',       'Ana Costa',       '100.000€', '["Next Tech Fund I","Hermes Fund"]',                        'Médio', 'Em Revisão', false, '2025-01-20', NULL,         '3 docs em falta. Aguarda resposta.',              '[{"n":"Cartão ID","s":"ok"},{"n":"Certidão Comercial","s":"missing"},{"n":"Declaração UBO","s":"missing"}]'),
  ('CLI-003', 'Dr. João Rodrigues',                'Pessoa Singular',         'PT123456789', 'Portugal',    'Cascais',     'João Rodrigues',  '50.000€',  '["Global Opportunities PPR"]',                             'Baixo', 'Aceite',     false, '2024-03-10', '2024-03-22', 'Perfil conservador.',                             '[{"n":"CC","s":"ok"},{"n":"Comprovativo Morada","s":"ok"},{"n":"FATCA/CRS","s":"ok"}]'),
  ('CLI-004', 'Sophía Papadopoulos',               'Pessoa Singular',         'GR987654321', 'Grécia',      'Atenas',      'Sophía Papado.',  '200.000€', '["Hermes Fund","Football Strategies Fund"]',                'Alto',  'Em Revisão', true,  '2025-02-08', NULL,         '⚠ PEP — EDD obrigatória.',                       '[{"n":"Passaporte","s":"ok"},{"n":"Decl. PEP","s":"ok"},{"n":"Origem de Fundos","s":"missing"}]'),
  ('CLI-005', 'Fundo de Pensões Galeria, FCR',     'Investidor Institucional','PT501234567', 'Portugal',    'Lisboa',      'N/A — Entidade',  '1.500.000€','["Portuguese Agrobusiness Fund","Global Listed Property Fund"]','Baixo', 'Aceite',    false, '2023-11-05', '2023-11-18', 'Regulado ASF. EDD simplificada.',                '[{"n":"Constituição","s":"ok"},{"n":"Autorização ASF","s":"ok"}]'),
  ('CLI-006', 'BrightStar Holdings Ltd.',          'Pessoa Coletiva',         'KY654321987', 'Ilhas Cayman','Grand Cayman','James O''Brien',  '500.000€', '["Finance Fund"]',                                         'Alto',  'Pendente',   false, '2025-01-10', NULL,         'Jurisdição de alto risco. EDD em curso.',         '[{"n":"Certidão Comercial","s":"missing"},{"n":"Declaração UBO","s":"missing"},{"n":"Origem de Fundos","s":"missing"}]'),
  ('CLI-007', 'Nordic Capital Partners AS',        'Investidor Institucional','NO987456123', 'Noruega',     'Oslo',        'Lars Eriksen',    '750.000€', '["Next Tech Fund I","Global Discovery Fund"]',              'Baixo', 'Aceite',     false, '2024-11-01', '2024-11-15', 'Due diligence simplificada. EEE.',                '[{"n":"Reg. Entidade","s":"ok"},{"n":"FATCA/CRS","s":"ok"}]')
ON CONFLICT (id) DO NOTHING;

-- Incumprimentos
INSERT INTO incumprimentos (id, descricao, area, data, gravidade, estado) VALUES
  ('INC-001', 'Falta de registo de acesso físico',   'Segurança', '14 Mar 2026', 'Alta',  'Em análise'),
  ('INC-002', 'Política de passwords desatualizada', 'TI',        '12 Mar 2026', 'Média', 'Atribuída'),
  ('INC-003', 'Backup sem validação mensal',         'TI',        '3 Mar 2026',  'Baixa', 'Resolvida')
ON CONFLICT (id) DO NOTHING;

-- RGPD Checklist
INSERT INTO rgpd_checklist (id, secao, item, prioridade, responsavel, frequencia, referencia, evidencias, done) VALUES
  ('CL-01', 'Governança', 'DPO nomeado e comunicado à CNPD',                             'Alta',  'Direcção / DPO', 'Anual',       'Art. 37-39 RGPD', 'Acta de nomeação',                          false),
  ('CL-02', 'Governança', 'Política interna de proteção de dados aprovada e divulgada',  'Alta',  'DPO',            'Anual',       'Art. 24, 25 RGPD','Documento de política',                     false),
  ('CL-03', 'Governança', 'Formação de colaboradores em privacidade e segurança',        'Média', 'RH / DPO',       'Anual',       'Art. 39(1)(b)',   'Plano de formação, listas de presenças',    false),
  ('CL-04', 'Mapeamento', 'Inventário/Registo de atividades de tratamento (RoPA)',       'Alta',  'DPO',            'Trimestral',  'Art. 30 RGPD',   'Registo por processo com base legal',       false),
  ('CL-05', 'Mapeamento', 'Classificação de dados (comuns, especiais, judiciais)',       'Alta',  'DPO / TI',       'Semestral',   'Art. 9, 10 RGPD','Matriz de classificação',                   false),
  ('CL-06', 'Segurança',  'Encriptação em repouso e em trânsito nos sistemas críticos', 'Alta',  'TI / Segurança', 'Anual',       'Art. 32 RGPD',   'Relatórios de configuração',                false),
  ('CL-07', 'Segurança',  'Gestão de acessos (RBAC), revisão periódica e logs',         'Alta',  'TI',             'Trimestral',  'Art. 32 RGPD',   'Listas de acessos, logs',                   false),
  ('CL-08', 'Incidentes', 'Plano de resposta a incidentes e violação de dados',         'Alta',  'DPO / Segurança','Anual',       'Art. 33-34 RGPD','Procedimento aprovado, playbooks',          false),
  ('CL-09', 'Incidentes', 'Capacidade de notificar CNPD em 72h e titulares',            'Alta',  'DPO',            'Anual',       'Art. 33-34 RGPD','Templates, registo de incidentes',          false),
  ('CL-10', 'Contratos',  'Cláusulas RGPD com subcontratantes (DPA)',                   'Alta',  'Jurídico / DPO', 'Contínuo',    'Art. 28, 46 RGPD','Anexos contratuais, SCCs',                 false),
  ('CL-11', 'Contratos',  'Transferências internacionais (EEE/fora EEE) conformes',     'Alta',  'Jurídico / DPO', 'Contínuo',    'Art. 44-49 RGPD','SCCs, BCRs, avaliação país',               false),
  ('CL-12', 'AIPD',       'AIPD realizada para tratamentos de alto risco',              'Alta',  'DPO',            'Quando aplic.','Art. 35-36 RGPD','Relatórios de AIPD',                       false),
  ('CL-13', 'Retenção',   'Política de retenção e eliminação de dados',                 'Média', 'DPO / TI',       'Anual',       'Art. 5(1)(e)',   'Cronograma de retenção',                    false)
ON CONFLICT (id) DO NOTHING;

-- RGPD Matriz de Tratamento
INSERT INTO rgpd_matriz_tratamento (id, nome, dept, descricao, base_legal, prazo, dados_sensiveis, pia, partilha, risco) VALUES
  ('T001', 'Processo de KYC',                 'Compliance', 'Receção e validação de documentos de investidores', 'Lei PBC/FT',       '10 anos', 'Não', 'Sim', 'Interno e Externo', 'Médio'),
  ('T002', 'Canal de denúncias',              'Compliance', 'Receção e tratamento de denúncias internas',        'Obrigação legal',  '5 anos',  'Sim', 'Sim', 'Interno',           'Alto'),
  ('T003', 'Exercício de direitos',           'Compliance', 'Gestão de pedidos de acesso e retificação',         'Art. 6.º(1)(c)',   '10 anos', 'Não', 'Não', 'Não',               'Baixo'),
  ('T004', 'Screening PEPs e Adverse Media',  'Compliance', 'Identificação de pessoas politicamente expostas',   'Obrigação legal',  '10 anos', 'Sim', 'Sim', 'Externo',           'Alto'),
  ('T005', 'Formação',                        'RH',         'Registo de formações obrigatórias',                 'Interesse legítimo','5 anos', 'Não', 'Não', 'Interno',           'Baixo')
ON CONFLICT (id) DO NOTHING;
