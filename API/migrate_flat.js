const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, database:'bluecrow_compliance', user:'postgres', password:'bluecrow123' });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const drops = [
      'comp_risks','comp_clients','comp_incumprimentos','comp_checklist',
      'comp_matriz','comp_dpias','comp_leg_diplomas','comp_leg_analises',
      'comp_leg_consultas','comp_scr_fund_docs','comp_scr_fund_info',
      'comp_oia_comparacoes','comp_oia_pipeline_inv','comp_oia_pipeline_deinv',
      'comp_reportes','comp_reportes_comunicacoes','comp_quadro_reg',
      'comp_ciber_risks','comp_ciber_improvements','comp_ciber_checklist',
      'comp_ciber_changelog','comp_available_years','portal_users'
    ];
    for (const t of drops) await client.query('DROP TABLE IF EXISTS ' + t);
    console.log('Tabelas antigas removidas');

    await client.query(`CREATE TABLE comp_risks (
      id TEXT PRIMARY KEY, entidade TEXT NOT NULL DEFAULT '',
      negocioSuporte TEXT NOT NULL DEFAULT '', nomeProcesso TEXT NOT NULL DEFAULT '',
      ownerProcesso TEXT NOT NULL DEFAULT '', categoria TEXT NOT NULL DEFAULT '',
      risco TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '',
      probabilidade TEXT NOT NULL DEFAULT '', impacto TEXT NOT NULL DEFAULT '',
      riscoConcatenado TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      objetivos TEXT NOT NULL DEFAULT '', mitigacao TEXT NOT NULL DEFAULT '',
      responsavelControlo TEXT NOT NULL DEFAULT '', frequenciaControlo TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_risks OK');

    await client.query(`CREATE TABLE comp_clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '', nif TEXT NOT NULL DEFAULT '',
      nat TEXT NOT NULL DEFAULT '', dom TEXT NOT NULL DEFAULT '',
      ubo TEXT NOT NULL DEFAULT '', inv TEXT NOT NULL DEFAULT '',
      risk TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '',
      pep BOOLEAN NOT NULL DEFAULT false,
      entrada TEXT, aceite TEXT, comment TEXT NOT NULL DEFAULT '',
      funds JSONB NOT NULL DEFAULT '[]', docs JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_clients OK');

    await client.query(`CREATE TABLE comp_incumprimentos (
      id TEXT PRIMARY KEY, descricao TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '',
      gravidade TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_incumprimentos OK');

    await client.query(`CREATE TABLE comp_checklist (
      id TEXT PRIMARY KEY, secao TEXT NOT NULL DEFAULT '',
      item TEXT NOT NULL DEFAULT '', prioridade TEXT NOT NULL DEFAULT '',
      responsavel TEXT NOT NULL DEFAULT '', frequencia TEXT NOT NULL DEFAULT '',
      referencia TEXT NOT NULL DEFAULT '', evidencias TEXT NOT NULL DEFAULT '',
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_checklist OK');

    await client.query(`CREATE TABLE comp_matriz (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '',
      dept TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
      base_legal TEXT NOT NULL DEFAULT '', prazo TEXT NOT NULL DEFAULT '',
      dados_sensiveis TEXT NOT NULL DEFAULT 'Não', pia TEXT NOT NULL DEFAULT 'Não',
      partilha TEXT NOT NULL DEFAULT '', risco TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_matriz OK');

    await client.query(`CREATE TABLE comp_dpias (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '',
      controller TEXT NOT NULL DEFAULT '', importadores TEXT NOT NULL DEFAULT '',
      pais TEXT NOT NULL DEFAULT '', dpo TEXT NOT NULL DEFAULT '',
      mecanismo TEXT NOT NULL DEFAULT '', risco_residual TEXT NOT NULL DEFAULT '',
      cnpd TEXT NOT NULL DEFAULT 'Não', finalidades TEXT NOT NULL DEFAULT '',
      mitigacao TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_dpias OK');

    await client.query(`CREATE TABLE comp_leg_diplomas (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL DEFAULT '',
      referencia TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT '',
      autoridade TEXT NOT NULL DEFAULT '', dataPublicacao TEXT NOT NULL DEFAULT '',
      dataVigor TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      impacto TEXT NOT NULL DEFAULT '', ambito TEXT NOT NULL DEFAULT '',
      descricao TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_leg_diplomas OK');

    await client.query(`CREATE TABLE comp_leg_analises (
      id TEXT PRIMARY KEY, diploma_id TEXT NOT NULL DEFAULT '',
      diploma_titulo TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '',
      responsavel TEXT NOT NULL DEFAULT '', nivel_impacto TEXT NOT NULL DEFAULT '',
      secoes JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_leg_analises OK');

    await client.query(`CREATE TABLE comp_leg_consultas (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL DEFAULT '',
      autoridade TEXT NOT NULL DEFAULT '', abertura TEXT NOT NULL DEFAULT '',
      encerramento TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '', parecer_bc TEXT NOT NULL DEFAULT '',
      observacoes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_leg_consultas OK');

    await client.query(`CREATE TABLE comp_scr_fund_docs (
      id TEXT PRIMARY KEY, fundId TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', fileName TEXT NOT NULL DEFAULT '',
      fileType TEXT NOT NULL DEFAULT '', uploadedAt TEXT NOT NULL DEFAULT '',
      fileData TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_scr_fund_docs OK');

    await client.query(`CREATE TABLE comp_scr_fund_info (
      id TEXT PRIMARY KEY, fundId TEXT NOT NULL DEFAULT '',
      dataCriacao TEXT NOT NULL DEFAULT '',
      montanteSubscricao TEXT NOT NULL DEFAULT '',
      valorUPs TEXT NOT NULL DEFAULT '',
      duracaoAnos NUMERIC, extensaoAnos NUMERIC, percForaPortugal NUMERIC,
      politicaInvestimento TEXT NOT NULL DEFAULT '',
      periodos JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_scr_fund_info OK');

    await client.query(`CREATE TABLE comp_oia_comparacoes (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      fundIds JSONB NOT NULL DEFAULT '[]',
      valores JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_oia_comparacoes OK');

    await client.query(`CREATE TABLE comp_oia_pipeline_inv (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'investimento',
      companyId TEXT NOT NULL DEFAULT '', companyName TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '', fundId TEXT NOT NULL DEFAULT '',
      trancheType TEXT NOT NULL DEFAULT '', amount NUMERIC, shares NUMERIC,
      notes TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '',
      dataProposta TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      observacoes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_oia_pipeline_inv OK');

    await client.query(`CREATE TABLE comp_oia_pipeline_deinv (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'desinvestimento',
      companyId TEXT NOT NULL DEFAULT '', companyName TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '', fundId TEXT NOT NULL DEFAULT '',
      trancheType TEXT NOT NULL DEFAULT '', amount NUMERIC, shares NUMERIC,
      notes TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '',
      dataProposta TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      observacoes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_oia_pipeline_deinv OK');

    await client.query(`CREATE TABLE comp_reportes (
      id TEXT PRIMARY KEY, codigo TEXT NOT NULL DEFAULT '',
      entidade TEXT NOT NULL DEFAULT '', codigoRel TEXT NOT NULL DEFAULT '',
      nome TEXT NOT NULL DEFAULT '', departamento TEXT NOT NULL DEFAULT '',
      periodicidade TEXT NOT NULL DEFAULT '', prazosLegais TEXT NOT NULL DEFAULT '',
      proximaData TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      documento TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      obrigatorio TEXT NOT NULL DEFAULT 'Sim', obs TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_reportes OK');

    await client.query(`CREATE TABLE comp_reportes_comunicacoes (
      id TEXT PRIMARY KEY, codigoReporte TEXT NOT NULL DEFAULT '',
      dataEnvio TEXT NOT NULL DEFAULT '', departamento TEXT NOT NULL DEFAULT '',
      submetido BOOLEAN NOT NULL DEFAULT false,
      dataFormulario TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      mes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_reportes_comunicacoes OK');

    await client.query(`CREATE TABLE comp_quadro_reg (
      id TEXT PRIMARY KEY, categoria TEXT NOT NULL DEFAULT '',
      fonte TEXT NOT NULL DEFAULT '', documento TEXT NOT NULL DEFAULT '',
      descricao TEXT NOT NULL DEFAULT '', dataPublicacao TEXT NOT NULL DEFAULT '',
      entradaVigor TEXT NOT NULL DEFAULT '', aplicabilidade TEXT NOT NULL DEFAULT '',
      notas TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT '',
      autoridade TEXT NOT NULL DEFAULT '', ambito TEXT NOT NULL DEFAULT '',
      file JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_quadro_reg OK');

    await client.query(`CREATE TABLE comp_ciber_risks (
      id TEXT PRIMARY KEY, categoria TEXT NOT NULL DEFAULT '',
      risco TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
      impacto TEXT NOT NULL DEFAULT '', gravidade TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '', recomendacao TEXT NOT NULL DEFAULT '',
      prazo TEXT NOT NULL DEFAULT '', resolvidoEm TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_ciber_risks OK');

    await client.query(`CREATE TABLE comp_ciber_improvements (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL DEFAULT '',
      descricao TEXT NOT NULL DEFAULT '', impacto TEXT NOT NULL DEFAULT '',
      esforco TEXT NOT NULL DEFAULT '', prazo TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL DEFAULT '',
      implementado BOOLEAN NOT NULL DEFAULT false, dataImpl TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_ciber_improvements OK');

    await client.query(`CREATE TABLE comp_ciber_checklist (
      id TEXT PRIMARY KEY, categoria TEXT NOT NULL DEFAULT '',
      item TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '',
      nota TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_ciber_checklist OK');

    await client.query(`CREATE TABLE comp_ciber_changelog (
      id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '',
      versao TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT '',
      titulo TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
      riscos JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_ciber_changelog OK');

    await client.query(`CREATE TABLE comp_available_years (
      id TEXT PRIMARY KEY, year INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('comp_available_years OK');

    await client.query(`CREATE TABLE portal_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '', initials TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer', active BOOLEAN NOT NULL DEFAULT true,
      password TEXT NOT NULL DEFAULT '',
      portals JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('portal_users OK');

    await client.query('COMMIT');
    console.log('\n=== MIGRACAO CONCLUIDA ===');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('ERRO - ROLLBACK:', e.message);
  } finally { client.release(); pool.end(); }
}
run();
