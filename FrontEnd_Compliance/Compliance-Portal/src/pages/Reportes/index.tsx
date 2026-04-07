import { useState, useMemo, useRef, useEffect } from 'react'
import { Mail, Search, Upload, CheckCircle2, AlertCircle, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Reporte {
  id?: string
  codigo: string; entidade: string; codigoRel: string; nome: string
  departamento: string; periodicidade: string; prazosLegais: string
  proximaData: string; email: string
  // Extended fields
  documento?:   string
  estado?:      string   // 'Sim' | 'Não'
  obrigatorio?: string   // 'Sim' | 'Não'
  obs?:         string
}

interface ComunicacaoCMVM {
  id?: string
  codigoReporte: string; dataEnvio: string; departamento: string
  submetido: boolean; dataFormulario: string; email: string; mes: string
}


// ─── Data — Calendário ────────────────────────────────────────────────────────
const REPORTES: Reporte[] = [
  { codigo:'SCI.RCL',   entidade:'SCI',   codigoRel:'RCL', nome:'Reporte de Reclamações de Investidores não profissionais',                                                                    departamento:'Compliance', periodicidade:'Semestral',  prazosLegais:'31 jan / 31 jul',              proximaData:'2026-07-31', email:'mip@bluecrowcapital.com' },
  { codigo:'SCI.DEI',   entidade:'SCI',   codigoRel:'DEI', nome:'Reporte de rubricas das Demonstrações Financeiras e Contas Extrapatrimoniais em base individual',                             departamento:'Financeiro', periodicidade:'Trimestral', prazosLegais:'31 jan / 30 abr / 31 jul / 31 out', proximaData:'2026-04-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCI.E3I',   entidade:'SCI',   codigoRel:'E3I', nome:'Prudential relativo a empresas de investimento de Classe 3 em base individual',                                               departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'11 fev',                       proximaData:'2026-02-11', email:'mip@bluecrowcapital.com' },
  { codigo:'SCI.AML',   entidade:'SCI',   codigoRel:'AML', nome:'Reporte das Entidades Obrigadas de Natureza Financeira (PBC/FT)',                                                             departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'31 mar / 30 jun',              proximaData:'2026-06-30', email:'mrg@bluecrowcapital.com' },
  { codigo:'SCI.PQ',    entidade:'SCI',   codigoRel:'PQ',  nome:'Detentores de Participações Qualificadas',                                                                                    departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'30 abr',                       proximaData:'2026-06-30', email:'fas@bluecrowcapital.com' },
  { codigo:'SCI.REC',   entidade:'SCI',   codigoRel:'REC', nome:'Relatório e Contas',                                                                                                          departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'30 jun',                       proximaData:'2026-06-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.AIM',   entidade:'SCR',   codigoRel:'AIM', nome:'ESMA AIFMD',                                                                                                                  departamento:'BackOffice', periodicidade:'Anual',      prazosLegais:'31 jan',                       proximaData:'2026-01-31', email:'ima@bluecrowcapital.com' },
  { codigo:'SCR.SGD',   entidade:'SCR',   codigoRel:'SGD', nome:'Reporte de informação relativa aos requisitos prudenciais',                                                                    departamento:'Financeiro', periodicidade:'Trimestral', prazosLegais:'31 jan / 30 abr / 31 jul / 31 out', proximaData:'2026-04-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.RDB',   entidade:'SCR',   codigoRel:'RDB', nome:'Reporte de Rubricas do Balanço, da Demonstração dos Resultados e da Demonstração do Outro Rendimento Integral',              departamento:'Financeiro', periodicidade:'Trimestral', prazosLegais:'31 jan / 30 abr / 31 jul / 31 out', proximaData:'2026-04-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.CRP',   entidade:'SCR',   codigoRel:'CRP', nome:'Reporte de informação relativa à composição da carteira',                                                                     departamento:'Financeiro', periodicidade:'Semestral',  prazosLegais:'28 fev / 31 ago',              proximaData:'2026-08-31', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.RCL',   entidade:'SCR',   codigoRel:'RCL', nome:'Reporte de Reclamações de Investidores não profissionais',                                                                    departamento:'Compliance', periodicidade:'Semestral',  prazosLegais:'31 jan / 31 jul',              proximaData:'2026-07-31', email:'mrg@bluecrowcapital.com' },
  { codigo:'SCR.AML',   entidade:'SCR',   codigoRel:'AML', nome:'Reporte das Entidades Obrigadas de Natureza Financeira (PBC/FT)',                                                             departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'31 mar / 30 jun',              proximaData:'2026-06-30', email:'mrg@bluecrowcapital.com' },
  { codigo:'SCR.CLC',   entidade:'SCR',   codigoRel:'CLC', nome:'Reporte da Certificação Legal das Contas',                                                                                    departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'31 mar / 30 jun',              proximaData:'2026-06-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.REC',   entidade:'SCR',   codigoRel:'REC', nome:'Reporte do Relatório e Contas Anual',                                                                                         departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'30 jun',                       proximaData:'2026-06-30', email:'mip@bluecrowcapital.com' },
  { codigo:'SCR.RAI',   entidade:'SCR',   codigoRel:'RAI', nome:'Relatório de autoavaliação dos sistemas de governo e controlo interno',                                                       departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'30 jun',                       proximaData:'2026-06-30', email:'mrg@bluecrowcapital.com' },
  { codigo:'SCR.RAA',   entidade:'SCR',   codigoRel:'RAA', nome:'Reporte sobre as deficiências detetadas',                                                                                     departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'30 jun',                       proximaData:'2026-06-30', email:'mrg@bluecrowcapital.com' },
  { codigo:'SCR.SII',   entidade:'SCR',   codigoRel:'SII', nome:'Reporte Sistema de Indemnização aos Investidores',                                                                            departamento:'Compliance', periodicidade:'Trimestral', prazosLegais:'30 abr / 31 jan / 31 jul',     proximaData:'2026-04-30', email:'spm@bluecrowcapital.com' },
  { codigo:'OIACR.CRT', entidade:'OIACR', codigoRel:'CRT', nome:'Reporte de informação relativa à composição da carteira',                                                                     departamento:'BackOffice', periodicidade:'Semestral',  prazosLegais:'28 fev / 31 ago',              proximaData:'2026-08-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIACR.CEP', entidade:'OIACR', codigoRel:'CEP', nome:'Reporte de informação relativa à atividade',                                                                                  departamento:'BackOffice', periodicidade:'Semestral',  prazosLegais:'28 fev / 31 ago',              proximaData:'2026-08-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIACR.DFI', entidade:'OIACR', codigoRel:'DFI', nome:'Reporte de Rubricas do Balanço, Demonstração dos Resultados',                                                                 departamento:'BackOffice', periodicidade:'Semestral',  prazosLegais:'28 fev / 31 ago',              proximaData:'2026-08-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIACR.FRC', entidade:'OIACR', codigoRel:'FRC', nome:'Reporte do Relatório e Contas',                                                                                               departamento:'BackOffice', periodicidade:'Anual',      prazosLegais:'31 mai',                       proximaData:'2026-05-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIACR.RDA', entidade:'OIACR', codigoRel:'RDA', nome:'Relatório de Auditoria',                                                                                                      departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'31 mai',                       proximaData:'2026-05-31', email:'mip@bluecrowcapital.com' },
  { codigo:'OIAVM.CFM', entidade:'OIAVM', codigoRel:'CFM', nome:'Reporte de composição da carteira',                                                                                           departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.AFM', entidade:'OIAVM', codigoRel:'AFM', nome:'Reporte do ficheiro da atividade',                                                                                            departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.DEF', entidade:'OIAVM', codigoRel:'DEF', nome:'Reporte de Rubricas do Balanço, Demonstração dos Resultados',                                                                 departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'Final do mês seguinte',        proximaData:'2026-03-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.FRC', entidade:'OIAVM', codigoRel:'FRC', nome:'Reporte do Relatório e Contas',                                                                                               departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'31 mai',                       proximaData:'2026-05-31', email:'mip@bluecrowcapital.com' },
  { codigo:'OIAVM.RDA', entidade:'OIAVM', codigoRel:'RDA', nome:'Relatório da Auditoria',                                                                                                      departamento:'Financeiro', periodicidade:'Anual',      prazosLegais:'31 mai',                       proximaData:'2026-05-31', email:'mip@bluecrowcapital.com' },
  { codigo:'OIAVM.VAR', entidade:'OIAVM', codigoRel:'VAR', nome:'Reporte do ficheiro value at risk',                                                                                           departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'10.º dia útil do mês',         proximaData:'2026-04-16', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.TGC', entidade:'OIAVM', codigoRel:'TGC', nome:'Reporte do ficheiro relativo à rotação média da carteira e indicador sintético de risco e remuneração',                      departamento:'BackOffice', periodicidade:'Semestral',  prazosLegais:'10.º dia útil após 30 abr / 30 out', proximaData:'2026-05-14', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.AIF', entidade:'OIAVM', codigoRel:'AIF', nome:'ESMA AIFMD',                                                                                                                  departamento:'BackOffice', periodicidade:'Anual',      prazosLegais:'31 jan',                       proximaData:'2026-01-31', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.ENC', entidade:'OIAVM', codigoRel:'ENC', nome:'Reporte dos encargos associados à comercialização dos OIC e à TEC',                                                          departamento:'BackOffice', periodicidade:'Anual',      prazosLegais:'10.º dia útil após 30 abr',    proximaData:'2026-05-14', email:'ima@bluecrowcapital.com' },
  { codigo:'OIAVM.VUP', entidade:'OIAVM', codigoRel:'VUP', nome:'Reporte do valor das unidades de participação',                                                                               departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil após o mês',      proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.RTO',   entidade:'RTO',   codigoRel:'RTO', nome:'Receção e transmissão de ordens por conta de outrem',                                                                         departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.CCG',   entidade:'RTO',   codigoRel:'CCG', nome:'Reporte de informação sobre o perfil das carteiras sob gestão',                                                               departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.GCO',   entidade:'RTO',   codigoRel:'GCO', nome:'Reporte de informação sobre as carteiras sob gestão',                                                                         departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.OPR',   entidade:'RTO',   codigoRel:'OPR', nome:'Reporte de operações das carteiras sob gestão',                                                                               departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.RUP',   entidade:'RTO',   codigoRel:'RUP', nome:'Reporte de Informação relativa ao registo e depósito de UP por conta de outrem',                                              departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'ima@bluecrowcapital.com' },
  { codigo:'RTO.CRP',   entidade:'RTO',   codigoRel:'CRP', nome:'Reporte de informação relativa à composição da carteira (Reporte de carteira própria)',                                       departamento:'BackOffice', periodicidade:'Semestral',  prazosLegais:'28 fev / 31 ago',              proximaData:'2026-08-31', email:'ima@bluecrowcapital.com' },
  { codigo:'TESTE.MRG', entidade:'TESTE', codigoRel:'MRG', nome:'Reporte de Teste para Sistema de Alertas Automático (MRG)',                                                                   departamento:'Compliance', periodicidade:'Anual',      prazosLegais:'31 jan / 30 abr / 31 jul',     proximaData:'2026-04-30', email:'mrg@bluecrowcapital.com' },
  { codigo:'TESTE.CFM', entidade:'TESTE', codigoRel:'CFM', nome:'Teste ao sistema RAM (SAM)',                                                                                                  departamento:'Compliance', periodicidade:'Mensal',     prazosLegais:'5.º dia útil do mês',          proximaData:'2026-04-09', email:'spm@bluecrowcapital.com' },
  // Novos reportes
  { codigo:'OIAVM.ERR', entidade:'OIAVM', codigoRel:'ERR', nome:'Erros no cálculo do valor da UP',                                                                                            departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'Até ao 10.º dia útil após detecção', proximaData:'', email:'ima@bluecrowcapital.com', estado:'Não',  obrigatorio:''    },
  { codigo:'OIAVM.COP', entidade:'OIAVM', codigoRel:'COP', nome:'Reporte do ficheiro sobre transações',                                                                                       departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'Até ao 3.º dia útil da receção',     proximaData:'', email:'ima@bluecrowcapital.com', estado:'Não',  obrigatorio:'Não' },
  { codigo:'RTO.PRC',   entidade:'RTO',   codigoRel:'PRC', nome:'Preçário para investidores não profissionais',                                                                                departamento:'',           periodicidade:'Anual',      prazosLegais:'1.º dia útil após 30 de abril',      proximaData:'2026-05-04', email:'ima@bluecrowcapital.com', estado:'Não', obrigatorio:'Sim' },
  { codigo:'RTO.RCO',   entidade:'RTO',   codigoRel:'RCO', nome:'Reporte de Informação relativo ao registo e depósito por conta de outrem',                                                   departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil',                       proximaData:'2026-04-09', email:'ima@bluecrowcapital.com', estado:'Não', obs:'Inexistência' },
  { codigo:'RTO.RCP',   entidade:'RTO',   codigoRel:'RCP', nome:'Reporte de informação relativa ao registo e depósito da carteira própria',                                                   departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil',                       proximaData:'2026-04-09', email:'ima@bluecrowcapital.com', estado:'Não', obs:'Inexistência' },
  { codigo:'RTO.RTE',   entidade:'RTO',   codigoRel:'RTE', nome:'Reporte de receção, transmissão e execução de ordens por conta de outrem',                                                   departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'5.º dia útil',                       proximaData:'2026-04-09', email:'ima@bluecrowcapital.com', estado:'Não', obs:'Inexistência' },
  { codigo:'RTO.TGC2',  entidade:'RTO',   codigoRel:'TGC', nome:'Reporte do ficheiro relativo à rotação média da carteira e indicador sintético de risco e remuneração',                     departamento:'BackOffice', periodicidade:'Anual',      prazosLegais:'10.º dia útil após 30/04',           proximaData:'2026-05-14', email:'ima@bluecrowcapital.com' },
  { codigo:'PONT.PAD',  entidade:'Pontuais', codigoRel:'PAD', nome:'Reporte dos pareceres quando as avaliações dos OIA que invistam predominantemente em ativos não financeiros',             departamento:'BackOffice', periodicidade:'Pontual',    prazosLegais:'Até ao 5.º dia útil após a receção', proximaData:'', email:'ima@bluecrowcapital.com', estado:'Não' },
  { codigo:'PONT.PVE',  entidade:'Pontuais', codigoRel:'PVE', nome:'Reporte do Plano de Viabilidade Económica e Financeira',                                                                  departamento:'Financeiro', periodicidade:'Pontual',    prazosLegais:'1 mês após o incumprimento',         proximaData:'', email:'mip@bluecrowcapital.com', estado:'Sim',  obrigatorio:'Sim' },
  { codigo:'NPR.NPR',   entidade:'NPR',   codigoRel:'NPR', nome:'Reporte da negociação por conta própria',                                                                                    departamento:'',           periodicidade:'Mensal',     prazosLegais:'5.º dia útil',                       proximaData:'2026-04-09', email:'ima@bluecrowcapital.com', estado:'Não' },
  { codigo:'MLI.MLI',   entidade:'MLI',   codigoRel:'MLI', nome:'Reporte das memórias da evolução do processo de liquidação dos OIA',                                                         departamento:'BackOffice', periodicidade:'Mensal',     prazosLegais:'Até ao 10.º dia útil de cada mês',   proximaData:'', email:'ima@bluecrowcapital.com', estado:'Não',  obrigatorio:'Não' },
]

// ─── Data — Registo CMVM ──────────────────────────────────────────────────────
const COMUNICACOES: ComunicacaoCMVM[] = [
  // Janeiro — DEF (6 fundos)
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:15', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:15', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:16', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:17', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:17', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:18', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  // Fevereiro — DEF
  { codigoReporte:'DEF', dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:19', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF', dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:19', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // GCO, RCL
  { codigoReporte:'GCO', dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:20', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'RCL', dataEnvio:'2026-01-29', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:21', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  // CFM — Janeiro
  { codigoReporte:'CFM', dataEnvio:'2026-01-01', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:27', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'CFM', dataEnvio:'2026-01-01', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:28', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'CFM', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:28', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'CFM', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:28', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  // CFM — Fevereiro
  { codigoReporte:'CFM', dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:28', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CFM', dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:29', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CFM', dataEnvio:'2026-02-01', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-03 18:29', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // AFM Fundos — Janeiro
  { codigoReporte:'AFM Select Fund',                dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'AFM Short Term Fund',            dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'AFM Global Discovery Fund',      dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'AFM Global Listed Property Fund',dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'AFM Opportunities PPR',          dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  // AFM Fundos — Fevereiro
  { codigoReporte:'AFM Select Fund',                dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AFM Short Term Fund',            dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AFM Global Discovery Fund',      dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AFM Global Listed Property Fund',dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AFM Opportunities PPR',          dataEnvio:'2026-02-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:24', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // CCG, OPR, RDB, ENC
  { codigoReporte:'CCG', dataEnvio:'2026-01-01', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:25', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'OPR', dataEnvio:'2026-01-05', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:26', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'RDB', dataEnvio:'2026-01-29', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:27', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'ENC', dataEnvio:'2026-01-14', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:27', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  // VUP — Janeiro / Fevereiro
  { codigoReporte:'VUP', dataEnvio:'2026-01-02', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:29', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'VUP', dataEnvio:'2026-02-26', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:30', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'VUP', dataEnvio:'2026-02-19', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:30', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // AIF Fundos — Fevereiro
  { codigoReporte:'AIF Innovation Fund I',          dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Innovation Fund II',         dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Innovation Fund III',        dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Innovation Fund IV',         dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Innovation Fund V',          dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Virlatus Fund',              dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Growth Fund',                dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Northern Fund I',            dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Impact Fund',                dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Next Tech Fund I',           dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Global Growth Tech Fund',    dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Subfundo A',                 dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Subfundo B',                 dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Subfundo C',                 dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Subfundo D',                 dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Subfundo E',                 dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Select Fund',                dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Short Term Fund',            dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Global Discovery Fund',      dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Global Listed Property Fund',dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'AIF Opportunities PPR',          dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:31', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // SGD
  { codigoReporte:'SGD', dataEnvio:'2026-01-29', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:32', email:'spm@bluecrowcapital.com', mes:'janeiro' },
  { codigoReporte:'SGD', dataEnvio:'2026-02-27', departamento:'Compliance', submetido:true, dataFormulario:'2026-02-05 11:32', email:'spm@bluecrowcapital.com', mes:'fevereiro' },
  // CRP (conta específica)
  { codigoReporte:'CRP13853700215123|1', dataEnvio:'2026-02-22', departamento:'Financeiro', submetido:true, dataFormulario:'2026-02-28 19:09', email:'mip@bluecrowcapital.com', mes:'fevereiro' },
  // DEF Fundos — Fevereiro (BackOffice)
  { codigoReporte:'DEF Innovation Fund I',          dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Innovation Fund II',         dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Innovation Fund III',        dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Innovation Fund IV',         dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Innovation Fund V',          dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Virlatus Fund',              dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Growth Fund I',              dataEnvio:'2026-02-18', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Northern Fund I',            dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Impact Fund',                dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Next Tech Fund I',           dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Global Growth Tech Fund',    dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Subfundo A',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Subfundo B',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Subfundo C',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Subfundo D',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'DEF Subfundo E',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:29', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  // CRT Fundos — Fevereiro (BackOffice)
  { codigoReporte:'CRT Innovation Fund I',          dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Innovation Fund II',         dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Innovation Fund III',        dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Innovation Fund IV',         dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Innovation Fund V',          dataEnvio:'2026-03-01', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 08:14', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Virlatus Fund',              dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Growth Fund I',              dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Northern Fund I',            dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Impact Fund',                dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Next Tech Fund',             dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Global Growth Tech Fund',    dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Subfundo A',                 dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Subfundo B',                 dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Subfundo C',                 dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Subfundo D',                 dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Subfundo E',                 dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CRT Opportunities PPR',          dataEnvio:'2026-02-27', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  // AFM Março (BackOffice)
  { codigoReporte:'AFM Global Listed Property Fund',dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'AFM Select Fund',                dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'AFM Short Term Fund',            dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'ima@bluecrowcapital.com', mes:'março' },
  // CEP Fundos — Fevereiro (BackOffice)
  { codigoReporte:'CEP Innovation Fund I',          dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Innovation Fund II',         dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Innovation Fund III',        dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Innovation Fund IV',         dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Innovation Fund V',          dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Virlatus Fund',              dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Growth Fund I',              dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Northern Fund I',            dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Impact Fund',                dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Next Tech Fund I',           dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Global Growth Tech Fund',    dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Subfundo A',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Subfundo B',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Subfundo C',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Subfundo D',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Subfundo E',                 dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  { codigoReporte:'CEP Opportunities PPR',          dataEnvio:'2026-02-24', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:30', email:'dmy@bluecrowcapital.com', mes:'fevereiro' },
  // CFM Março (BackOffice + Compliance)
  { codigoReporte:'CFM',                            dataEnvio:'2026-03-01', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:32', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'CFM Global Listed Property Fund',dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:32', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'CFM Global Discovery Fund',      dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:32', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'CFM Short Term Fund',            dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:32', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'CFM Select Fund',                dataEnvio:'2026-03-02', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:32', email:'ima@bluecrowcapital.com', mes:'março' },
  // CCG, GCO, OPR — Março
  { codigoReporte:'CCG', dataEnvio:'2026-03-03', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:33', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'GCO', dataEnvio:'2026-03-03', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:33', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'OPR', dataEnvio:'2026-03-03', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-02 14:33', email:'ima@bluecrowcapital.com', mes:'março' },
  // VUP Fundos — Março
  { codigoReporte:'VUP Opportunities PPR',          dataEnvio:'2026-03-09', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-09 12:36', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Global Listed Property Fund',dataEnvio:'2026-03-09', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-09 12:36', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Global Discovery Fund',      dataEnvio:'2026-03-09', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-09 12:36', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Short Term Fund',            dataEnvio:'2026-03-09', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-09 12:36', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Select Fund',                dataEnvio:'2026-03-09', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-09 15:00', email:'spm@bluecrowcapital.com', mes:'março' },
  // VUP Fundos — Março (2.ª remessa)
  { codigoReporte:'VUP Global Listed Property Fund',dataEnvio:'2026-03-16', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-16 16:11', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Global Discovery Fund',      dataEnvio:'2026-03-16', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-16 16:11', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Short Term Fund',            dataEnvio:'2026-03-16', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-16 16:11', email:'ima@bluecrowcapital.com', mes:'março' },
  { codigoReporte:'VUP Opportunities PPR',          dataEnvio:'2026-05-16', departamento:'BackOffice', submetido:true, dataFormulario:'2026-03-16 16:11', email:'ima@bluecrowcapital.com', mes:'março' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PERIOD_BADGE: Record<string, string> = {
  Mensal:'bg-blue-50 text-blue-700', Trimestral:'bg-purple-50 text-purple-700',
  Semestral:'bg-amber-50 text-amber-700', Anual:'bg-green-50 text-green-700',
}
const DEPT_BADGE: Record<string, string> = {
  Compliance:'bg-red-50 text-red-700', Financeiro:'bg-blue-50 text-blue-700', BackOffice:'bg-gray-100 text-gray-600',
}
const MES_ORDER = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function dataBadge(iso: string) {
  if (!iso) return 'bg-gray-100 text-gray-400'
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days < 0)   return 'bg-red-100 text-red-700'
  if (days <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
}

// ─── Add Reporte Modal ────────────────────────────────────────────────────────
const PERIODOS_OPT = ['Mensal','Trimestral','Semestral','Anual','Pontual','Sempre que aplicável','Prazo legalmente previsto']
const DEPTS_OPT    = ['','Compliance','Financeiro','BackOffice','DF','DBO','DA','DCCI','Por Apurar']

function ReporteFormModal({ initial, onSave, onClose }: {
  initial?: Reporte
  onSave: (r: Reporte) => void
  onClose: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [f, setF] = useState({
    entidade:     initial?.entidade      ?? '',
    codigoRel:    initial?.codigoRel     ?? '',
    nome:         initial?.nome          ?? '',
    departamento: initial?.departamento  ?? '',
    periodicidade: initial?.periodicidade ?? 'Mensal',
    prazosLegais: initial?.prazosLegais  ?? '',
    proximaData:  initial?.proximaData   ?? '',
    email:        initial?.email         ?? '',
    documento:    initial?.documento     ?? '',
    estado:       initial?.estado        ?? '',
    obrigatorio:  initial?.obrigatorio   ?? '',
    obs:          initial?.obs           ?? '',
  })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const isEdit = !!initial

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.entidade || !f.codigoRel || !f.nome) return
    onSave({
      codigo: `${f.entidade}.${f.codigoRel}`, entidade: f.entidade, codigoRel: f.codigoRel,
      nome: f.nome, departamento: f.departamento, periodicidade: f.periodicidade,
      prazosLegais: f.prazosLegais, proximaData: f.proximaData, email: f.email,
      documento: f.documento || undefined, estado: f.estado || undefined,
      obrigatorio: f.obrigatorio || undefined, obs: f.obs || undefined,
    })
    onClose()
  }

  const labelCls = "block text-[11px] font-medium text-gray-700 mb-1"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
          <span className="text-[13.5px] font-semibold text-gray-900">
            {isEdit ? `Editar Reporte — ${initial!.codigo}` : 'Adicionar Novo Reporte'}
          </span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={15} /></button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="overflow-auto flex-1 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Origem *</label><input className="form-input w-full" placeholder="ex: SCI, SCR, OIAVM…" value={f.entidade} onChange={e => set('entidade', e.target.value)} required /></div>
            <div><label className={labelCls}>Código *</label><input className="form-input w-full" placeholder="ex: DEI, AML, CFM…" value={f.codigoRel} onChange={e => set('codigoRel', e.target.value)} required /></div>
          </div>
          <div><label className={labelCls}>Nome do Reporte *</label><input className="form-input w-full" placeholder="Descrição completa do reporte…" value={f.nome} onChange={e => set('nome', e.target.value)} required /></div>
          <div><label className={labelCls}>Documento / Referência Legal</label><input className="form-input w-full" placeholder="ex: Regulamento 8/2020, Anexo XI, Secção I" value={f.documento} onChange={e => set('documento', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Periodicidade</label>
              <select className="form-input w-full" value={f.periodicidade} onChange={e => set('periodicidade', e.target.value)}>
                {PERIODOS_OPT.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select className="form-input w-full" value={f.departamento} onChange={e => set('departamento', e.target.value)}>
                {DEPTS_OPT.map(d => <option key={d} value={d}>{d || '—'}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Estado</label>
              <select className="form-input w-full" value={f.estado} onChange={e => set('estado', e.target.value)}>
                {['','Sim','Não'].map(v => <option key={v} value={v}>{v || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Obrigatório</label>
              <select className="form-input w-full" value={f.obrigatorio} onChange={e => set('obrigatorio', e.target.value)}>
                {['','Sim','Não'].map(v => <option key={v} value={v}>{v || '—'}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Data Limite / Prazos</label><input className="form-input w-full" placeholder="ex: 31 jan / 31 jul" value={f.prazosLegais} onChange={e => set('prazosLegais', e.target.value)} /></div>
            <div><label className={labelCls}>Próxima Data</label><input type="date" className="form-input w-full" value={f.proximaData} onChange={e => set('proximaData', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Email</label><input type="email" className="form-input w-full" placeholder="responsavel@empresa.com" value={f.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className={labelCls}>Observações</label><input className="form-input w-full" placeholder="Notas adicionais…" value={f.obs} onChange={e => set('obs', e.target.value)} /></div>
          </div>
        </form>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-[12px] px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button type="button" onClick={() => formRef.current?.requestSubmit()} className="btn btn-primary btn-sm">
            {isEdit ? 'Guardar Alterações' : 'Adicionar Reporte'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Todos os Reportes ───────────────────────────────────────────────────
function TabTodosReportes({ reportes, onAdd, onEdit, onDelete }: {
  reportes: Reporte[]
  onAdd: (r: Reporte) => void
  onEdit: (originalCodigo: string, r: Reporte) => void
  onDelete: (codigo: string) => void
}) {
  const [showAdd,     setShowAdd]     = useState(false)
  const [editTarget,  setEditTarget]  = useState<Reporte | null>(null)
  const [search,   setSearch]   = useState('')
  const [entidade, setEntidade] = useState('Todas')
  const [dept,     setDept]     = useState('Todos')
  const [periodo,  setPeriodo]  = useState('Todos')
  const [estado,   setEstado]   = useState('Todos')

  const entidades = ['Todas', ...Array.from(new Set(reportes.map(r => r.entidade)))]
  const depts     = ['Todos', ...Array.from(new Set(reportes.map(r => r.departamento).filter(Boolean)))]
  const periodos  = ['Todos', ...Array.from(new Set(reportes.map(r => r.periodicidade)))]

  const filtered = useMemo(() => reportes.filter(r => {
    if (entidade !== 'Todas' && r.entidade      !== entidade) return false
    if (dept     !== 'Todos' && r.departamento  !== dept)     return false
    if (periodo  !== 'Todos' && r.periodicidade !== periodo)  return false
    if (estado   !== 'Todos' && (r.estado ?? '') !== estado)  return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.codigo.toLowerCase().includes(q) && !r.nome.toLowerCase().includes(q) && !(r.documento ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [search, entidade, dept, periodo, estado, reportes])

  return (
    <div className="space-y-4">
      {showAdd && <ReporteFormModal onSave={r => { onAdd(r); setShowAdd(false) }} onClose={() => setShowAdd(false)} />}
      {editTarget && (
        <ReporteFormModal
          initial={editTarget}
          onSave={r => { onEdit(editTarget.codigo, r); setEditTarget(null) }}
          onClose={() => setEditTarget(null)}
        />
      )}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos os Reportes</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-400">{filtered.length} de {reportes.length}</span>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Plus size={12} /> Adicionar Reporte
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-7" placeholder="Pesquisar código, nome, documento…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input w-auto" value={entidade} onChange={e => setEntidade(e.target.value)}>{entidades.map(v => <option key={v}>{v}</option>)}</select>
          <select className="form-input w-auto" value={dept}     onChange={e => setDept(e.target.value)}>{depts.map(v => <option key={v}>{v}</option>)}</select>
          <select className="form-input w-auto" value={periodo}  onChange={e => setPeriodo(e.target.value)}>{periodos.map(v => <option key={v}>{v}</option>)}</select>
          <select className="form-input w-auto" value={estado}   onChange={e => setEstado(e.target.value)}>
            {['Todos','Sim','Não',''].map(v => <option key={v} value={v}>{v === '' ? '(sem estado)' : v === 'Todos' ? 'Estado: Todos' : v}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Origem</th><th>Cód.</th><th>Nome do Reporte</th><th>Documento</th>
                <th>Periodicidade</th><th>Dept.</th><th>Estado</th><th>Obrig.</th><th>Data Limite</th><th>Obs</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={11} className="text-center text-gray-400 py-8">Sem resultados</td></tr>
                : filtered.map(r => (
                <tr key={r.codigo}>
                  <td><span className="text-[11px] font-semibold text-gray-700">{r.entidade}</span></td>
                  <td><span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.codigoRel}</span></td>
                  <td className="max-w-[260px] text-[12px] leading-snug">{r.nome}</td>
                  <td className="max-w-[200px] text-[11px] text-gray-400 leading-snug">{r.documento || <span className="text-gray-200">—</span>}</td>
                  <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PERIOD_BADGE[r.periodicidade] ?? 'bg-gray-100 text-gray-600'}`}>{r.periodicidade}</span></td>
                  <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DEPT_BADGE[r.departamento] ?? 'bg-gray-100 text-gray-600'}`}>{r.departamento || '—'}</span></td>
                  <td>
                    {r.estado
                      ? <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.estado === 'Sim' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.estado}</span>
                      : <span className="text-gray-200 text-[11px]">—</span>}
                  </td>
                  <td>
                    {r.obrigatorio
                      ? <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.obrigatorio === 'Sim' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{r.obrigatorio}</span>
                      : <span className="text-gray-200 text-[11px]">—</span>}
                  </td>
                  <td className="text-[11px] text-gray-500 whitespace-nowrap">{r.prazosLegais || '—'}</td>
                  <td className="text-[11px] text-gray-400">{r.obs || <span className="text-gray-200">—</span>}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditTarget(r)} title="Editar" className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm(`Eliminar "${r.nome}"?`)) onDelete(r.codigo) }} title="Eliminar" className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Modal ────────────────────────────────────────────────────────────────
type ModalData =
  | { type: 'reporte'; title: string; items: Reporte[] }
  | { type: 'cmvm';    title: string; items: ComunicacaoCMVM[] }
  | null

function KpiModal({ data, onClose }: { data: ModalData; onClose: () => void }) {
  useEffect(() => {
    if (!data) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [data, onClose])

  if (!data) return null

  const count = data.items.length
  const label = data.type === 'reporte'
    ? `${count} reporte${count !== 1 ? 's' : ''}`
    : `${count} comunicaç${count !== 1 ? 'ões' : 'ão'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[82vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
          <span className="text-[13.5px] font-semibold text-gray-900">{data.title}</span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-auto flex-1">
          {data.type === 'reporte'
            ? <ModalReporteTable items={data.items} />
            : <ModalCmvmTable   items={data.items} />}
        </div>
        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-400 bg-gray-50/60 rounded-b-xl">
          {label}
        </div>
      </div>
    </div>
  )
}

function ModalReporteTable({ items }: { items: Reporte[] }) {
  return (
    <table className="data-table w-full">
      <thead><tr><th>Código</th><th>Nome</th><th>Departamento</th><th>Periodicidade</th><th>Prazos Legais</th><th>Próxima Data</th><th>Email</th></tr></thead>
      <tbody>
        {items.map(r => (
          <tr key={r.codigo}>
            <td className="font-mono text-[11px] text-gray-500 whitespace-nowrap">{r.codigo}</td>
            <td className="max-w-[280px] text-[12px] leading-snug">{r.nome}</td>
            <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DEPT_BADGE[r.departamento] ?? 'bg-gray-100 text-gray-600'}`}>{r.departamento}</span></td>
            <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PERIOD_BADGE[r.periodicidade] ?? 'bg-gray-100 text-gray-600'}`}>{r.periodicidade}</span></td>
            <td className="text-[11px] text-gray-500 whitespace-nowrap">{r.prazosLegais}</td>
            <td><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${dataBadge(r.proximaData)}`}>{fmtDate(r.proximaData)}</span></td>
            <td>{r.email ? <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap"><Mail size={11}/>{r.email.split('@')[0]}</a> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ModalCmvmTable({ items }: { items: ComunicacaoCMVM[] }) {
  return (
    <table className="data-table w-full">
      <thead><tr><th>Código de Reporte</th><th>Data de Envio</th><th>Departamento</th><th>Submetido?</th><th>Data Formulário</th><th>Email</th><th>Mês</th></tr></thead>
      <tbody>
        {items.map((c, i) => (
          <tr key={i}>
            <td className="font-mono text-[11px] text-gray-700 whitespace-nowrap">{c.codigoReporte}</td>
            <td className="text-[11px] whitespace-nowrap">{fmtDate(c.dataEnvio)}</td>
            <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DEPT_BADGE[c.departamento] ?? 'bg-gray-100 text-gray-600'}`}>{c.departamento}</span></td>
            <td>{c.submetido
              ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Sim</span>
              : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Não</span>}
            </td>
            <td className="text-[11px] text-gray-500 whitespace-nowrap">{c.dataFormulario}</td>
            <td>{c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap"><Mail size={11}/>{c.email.split('@')[0]}</a> : '—'}</td>
            <td><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{c.mes}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Sub-component: Calendário ────────────────────────────────────────────────
function TabCalendario({ reportes, onEdit, onDelete }: {
  reportes: Reporte[]
  onEdit: (originalCodigo: string, r: Reporte) => void
  onDelete: (codigo: string) => void
}) {
  const [editTarget, setEditTarget] = useState<Reporte | null>(null)
  const [search,   setSearch]   = useState('')
  const [entidade, setEntidade] = useState('Todas')
  const [dept,     setDept]     = useState('Todos')
  const [periodo,  setPeriodo]  = useState('Todos')

  const entidades = ['Todas', ...Array.from(new Set(reportes.map(r => r.entidade)))]
  const depts     = ['Todos', ...Array.from(new Set(reportes.map(r => r.departamento)))]
  const periodos  = ['Todos', ...Array.from(new Set(reportes.map(r => r.periodicidade)))]

  const filtered = useMemo(() => reportes.filter(r => {
    if (entidade !== 'Todas' && r.entidade      !== entidade) return false
    if (dept     !== 'Todos' && r.departamento  !== dept)     return false
    if (periodo  !== 'Todos' && r.periodicidade !== periodo)  return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.codigo.toLowerCase().includes(q) && !r.nome.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false
    }
    return true
  }), [search, entidade, dept, periodo, reportes])

  const urgentesItems = reportes.filter(r => { if (!r.proximaData) return false; const d = Math.ceil((new Date(r.proximaData).getTime() - Date.now()) / 86_400_000); return d >= 0 && d <= 30 })
  const vencidosItems = reportes.filter(r => r.proximaData && new Date(r.proximaData) < new Date())
  const [modal, setModal] = useState<ModalData>(null)

  return (
    <div className="space-y-4">
      <KpiModal data={modal} onClose={() => setModal(null)} />
      {editTarget && (
        <ReporteFormModal
          initial={editTarget}
          onSave={r => { onEdit(editTarget.codigo, r); setEditTarget(null) }}
          onClose={() => setEditTarget(null)}
        />
      )}
      <div className="grid grid-cols-4 gap-3">
        <div
          onClick={() => setModal({ type: 'reporte', title: 'Total de Reportes Regulatórios', items: reportes })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-blue-500 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Reportes</div>
          <div className="text-[24px] font-semibold text-gray-900">{reportes.length}</div>
          <div className="text-[11px] text-gray-400 mt-1">obrigações regulatórias</div>
        </div>
        <div
          onClick={() => setModal({ type: 'reporte', title: 'Próximos 30 dias — A vencer em breve', items: urgentesItems })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-amber-500 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Próximos 30 dias</div>
          <div className="text-[24px] font-semibold text-amber-600">{urgentesItems.length}</div>
          <div className="text-[11px] text-amber-500 mt-1">a vencer em breve</div>
        </div>
        <div
          onClick={() => setModal({ type: 'reporte', title: 'Reportes com Prazo Ultrapassado', items: vencidosItems })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-red-500 cursor-pointer hover:shadow-md hover:border-red-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Vencidos</div>
          <div className="text-[24px] font-semibold text-red-600">{vencidosItems.length}</div>
          <div className="text-[11px] text-red-400 mt-1">prazo ultrapassado</div>
        </div>
        <div
          onClick={() => setModal({ type: 'reporte', title: 'Todos os Reportes por Entidade', items: [...reportes].sort((a,b) => a.entidade.localeCompare(b.entidade)) })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-green-500 cursor-pointer hover:shadow-md hover:border-green-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Entidades</div>
          <div className="text-[24px] font-semibold text-gray-900">{entidades.length - 1}</div>
          <div className="text-[11px] text-gray-400 mt-1">{[...new Set(reportes.map(r=>r.entidade))].join(' · ')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Calendário de Reportes Regulatórios</span>
          <span className="text-[11px] text-gray-400">{filtered.length} de {reportes.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-7" placeholder="Pesquisar código, nome, email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input w-auto" value={entidade} onChange={e => setEntidade(e.target.value)}>{entidades.map(e => <option key={e}>{e}</option>)}</select>
          <select className="form-input w-auto" value={dept}     onChange={e => setDept(e.target.value)}>{depts.map(d => <option key={d}>{d}</option>)}</select>
          <select className="form-input w-auto" value={periodo}  onChange={e => setPeriodo(e.target.value)}>{periodos.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Código</th><th>Entidade</th><th>Cód.</th><th>Nome</th><th>Departamento</th><th>Periodicidade</th><th>Prazos Legais</th><th>Próxima Data</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={10} className="text-center text-gray-400 py-8">Sem resultados</td></tr>
                : filtered.map(r => (
                <tr key={r.codigo}>
                  <td className="font-mono text-[11px] text-gray-500 whitespace-nowrap">{r.codigo}</td>
                  <td><span className="text-[11px] font-semibold text-gray-700">{r.entidade}</span></td>
                  <td><span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.codigoRel}</span></td>
                  <td className="max-w-[300px] text-[12px] leading-snug">{r.nome}</td>
                  <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DEPT_BADGE[r.departamento] ?? 'bg-gray-100 text-gray-600'}`}>{r.departamento}</span></td>
                  <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PERIOD_BADGE[r.periodicidade] ?? 'bg-gray-100 text-gray-600'}`}>{r.periodicidade}</span></td>
                  <td className="text-[11px] text-gray-500 whitespace-nowrap">{r.prazosLegais}</td>
                  <td><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${dataBadge(r.proximaData)}`}>{fmtDate(r.proximaData)}</span></td>
                  <td>{r.email ? <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap"><Mail size={11}/>{r.email.split('@')[0]}</a> : '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditTarget(r)} title="Editar" className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm(`Eliminar "${r.nome}"?`)) onDelete(r.codigo) }} title="Eliminar" className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: Registo CMVM ─────────────────────────────────────────────
function TabRegistoCMVM({ comunicacoes }: { comunicacoes: ComunicacaoCMVM[] }) {
  const [search, setSearch] = useState('')
  const [mes,    setMes]    = useState('Todos')
  const [dept,   setDept]   = useState('Todos')

  const meses = ['Todos', ...MES_ORDER.filter(m => comunicacoes.some(c => c.mes === m))]
  const depts = ['Todos', ...Array.from(new Set(comunicacoes.map(c => c.departamento)))]

  const filtered = useMemo(() => comunicacoes.filter(c => {
    if (mes  !== 'Todos' && c.mes          !== mes)  return false
    if (dept !== 'Todos' && c.departamento !== dept)  return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.codigoReporte.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false
    }
    return true
  }), [search, mes, dept, comunicacoes])

  const porMes = MES_ORDER.filter(m => comunicacoes.some(c => c.mes === m)).map(m => ({
    mes: m, total: comunicacoes.filter(c => c.mes === m).length
  }))
  const [modal, setModal] = useState<ModalData>(null)

  return (
    <div className="space-y-4">
      <KpiModal data={modal} onClose={() => setModal(null)} />
      <div className="grid grid-cols-3 gap-3">
        <div
          onClick={() => setModal({ type: 'cmvm', title: 'Total de Comunicações à CMVM', items: comunicacoes })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-blue-500 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Comunicações</div>
          <div className="text-[24px] font-semibold text-gray-900">{comunicacoes.length}</div>
          <div className="text-[11px] text-gray-400 mt-1">registos enviados à CMVM</div>
        </div>
        <div
          onClick={() => setModal({ type: 'cmvm', title: 'Comunicações Submetidas', items: comunicacoes.filter(c => c.submetido) })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-green-500 cursor-pointer hover:shadow-md hover:border-green-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Submetidos</div>
          <div className="text-[24px] font-semibold text-green-600">{comunicacoes.filter(c => c.submetido).length}</div>
          <div className="text-[11px] text-green-500 mt-1">confirmados como enviados</div>
        </div>
        <div
          onClick={() => setModal({ type: 'cmvm', title: 'Comunicações por Mês', items: [...comunicacoes].sort((a,b) => MES_ORDER.indexOf(a.mes) - MES_ORDER.indexOf(b.mes)) })}
          className="bg-white rounded-lg border border-gray-200 p-4 border-b-[3px] border-b-purple-500 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Meses Registados</div>
          <div className="text-[24px] font-semibold text-gray-900">{porMes.length}</div>
          <div className="text-[11px] text-gray-400 mt-1 capitalize">{porMes.map(m => m.mes).join(' · ')}</div>
        </div>
      </div>

      {/* Resumo por mês */}
      <div className="grid grid-cols-3 gap-3">
        {porMes.map(({ mes: m, total }) => (
          <div key={m} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setMes(mes === m ? 'Todos' : m)}>
            <div>
              <div className="text-[11px] font-semibold text-gray-700 capitalize">{m}</div>
              <div className="text-[10px] text-gray-400">{total} comunicações</div>
            </div>
            <span className="text-[20px] font-bold text-blue-600">{total}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Registo de Comunicação à CMVM</span>
          <span className="text-[11px] text-gray-400">{filtered.length} de {comunicacoes.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-7" placeholder="Pesquisar código ou email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input w-auto" value={mes}  onChange={e => setMes(e.target.value)}>{meses.map(m => <option key={m} className="capitalize">{m}</option>)}</select>
          <select className="form-input w-auto" value={dept} onChange={e => setDept(e.target.value)}>{depts.map(d => <option key={d}>{d}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Código de Reporte</th><th>Data de Envio</th><th>Departamento</th><th>Submetido?</th><th>Data Formulário</th><th>Email</th><th>Mês</th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} className="text-center text-gray-400 py-8">Sem resultados</td></tr>
                : filtered.map((c, i) => (
                <tr key={i}>
                  <td className="font-mono text-[11px] text-gray-700 whitespace-nowrap">{c.codigoReporte}</td>
                  <td className="text-[11px] whitespace-nowrap">{fmtDate(c.dataEnvio)}</td>
                  <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DEPT_BADGE[c.departamento] ?? 'bg-gray-100 text-gray-600'}`}>{c.departamento}</span></td>
                  <td>
                    {c.submetido
                      ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Sim</span>
                      : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Não</span>}
                  </td>
                  <td className="text-[11px] text-gray-500 whitespace-nowrap">{c.dataFormulario}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap"><Mail size={11}/>{c.email.split('@')[0]}</a> : '—'}</td>
                  <td><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{c.mes}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Controlo ────────────────────────────────────────────────────────────
function codeOf(cr: string): string { const m = cr.match(/^([A-Z]+)/); return m ? m[1] : cr }
function fundoOf(cr: string): string | null { const rest = cr.slice(codeOf(cr).length).trim(); return rest || null }

function applicableMonths(reps: Reporte[]): number[] {
  const abbrs = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const set = new Set<number>()
  for (const r of reps) {
    const p = r.prazosLegais.toLowerCase()
    switch (r.periodicidade) {
      case 'Mensal': for (let i=0;i<12;i++) set.add(i); break
      case 'Trimestral': [0,3,6,9].forEach(m=>set.add(m)); break
      case 'Semestral': {
        for (let i=0;i<abbrs.length;i++) { if (p.includes(abbrs[i])) { set.add(i); set.add(i<6?i+6:i-6); break } }
        break
      }
      case 'Anual': {
        for (let i=0;i<abbrs.length;i++) { if (p.includes(abbrs[i])) { set.add(i); break } }
        break
      }
    }
  }
  return Array.from(set)
}

type CellSt = 'sim' | 'falta' | 'na'

function ctrlStatus(com: ComunicacaoCMVM[], code: string, mIdx: number, appM: number[]): CellSt {
  const mk = MES_ORDER[mIdx]
  const entries = com.filter(c => codeOf(c.codigoReporte) === code && c.mes === mk)
  if (entries.length > 0) return entries.some(e => e.submetido) ? 'sim' : 'falta'
  return appM.includes(mIdx) ? 'falta' : 'na'
}

function fundStatus(com: ComunicacaoCMVM[], code: string, fundo: string, mIdx: number, appM: number[]): CellSt {
  const mk = MES_ORDER[mIdx]
  const entries = com.filter(c => codeOf(c.codigoReporte) === code && fundoOf(c.codigoReporte) === fundo && c.mes === mk)
  if (entries.length > 0) return entries.some(e => e.submetido) ? 'sim' : 'falta'
  return appM.includes(mIdx) ? 'falta' : 'na'
}

function Dot({ st }: { st: CellSt }) {
  if (st === 'sim')   return <span title="Submetido" className="inline-flex items-center justify-center w-[22px] h-[22px] rounded bg-green-100 text-green-700 text-[10px] font-bold select-none">✓</span>
  if (st === 'falta') return <span title="Em falta"  className="inline-flex items-center justify-center w-[22px] h-[22px] rounded bg-red-100   text-red-700   text-[10px] font-bold select-none">✗</span>
  return <span className="inline-flex items-center justify-center w-[22px] h-[22px] text-gray-200 text-[12px] select-none">–</span>
}

function TabControlo({ reportes, comunicacoes, onEdit, onDelete }: {
  reportes: Reporte[]
  comunicacoes: ComunicacaoCMVM[]
  onEdit: (originalCodigo: string, r: Reporte) => void
  onDelete: (codigo: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (c: string) => setOpen(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n })
  const [editTarget, setEditTarget] = useState<Reporte | null>(null)

  const rows = useMemo(() => {
    const seen = new Map<string, { nome: string; periodicidade: string; appM: number[] }>()
    for (const r of reportes) {
      if (!seen.has(r.codigoRel)) {
        const reps = reportes.filter(x => x.codigoRel === r.codigoRel)
        seen.set(r.codigoRel, { nome: r.nome, periodicidade: r.periodicidade, appM: applicableMonths(reps) })
      }
    }
    return Array.from(seen.entries()).map(([code, info]) => ({ code, ...info }))
  }, [reportes])

  const fundGroups = useMemo(() => {
    const g = new Map<string, Set<string>>()
    for (const c of comunicacoes) {
      const fundo = fundoOf(c.codigoReporte); if (!fundo) continue
      const code = codeOf(c.codigoReporte)
      if (!g.has(code)) g.set(code, new Set())
      g.get(code)!.add(fundo)
    }
    return Array.from(g.entries()).map(([code, fundos]) => ({ code, fundos: Array.from(fundos).sort() }))
  }, [comunicacoes])

  const totalSim   = rows.reduce((a,{code,appM}) => a + Array.from({length:12},(_,i) => ctrlStatus(comunicacoes,code,i,appM)==='sim'  ? 1 : 0).reduce((x,y)=>x+y, 0 as number), 0)
  const totalFalta = rows.reduce((a,{code,appM}) => a + Array.from({length:12},(_,i) => ctrlStatus(comunicacoes,code,i,appM)==='falta' ? 1 : 0).reduce((x,y)=>x+y, 0 as number), 0)

  const thCls = "text-center px-1 py-2 font-semibold text-[10px] text-gray-400 w-[30px] uppercase tracking-wide"
  const tdCls = "px-0.5 py-1.5 text-center"

  return (
    <div className="space-y-4">
      {editTarget && (
        <ReporteFormModal
          initial={editTarget}
          onSave={r => { onEdit(editTarget.codigo, r); setEditTarget(null) }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {/* Legend bar */}
      <div className="flex flex-wrap items-center gap-5 bg-white border border-gray-200 rounded-lg px-5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-gray-600"><Dot st="sim"/>Dentro do prazo</div>
        <div className="flex items-center gap-2 text-[11px] text-gray-600"><Dot st="falta"/>Em falta / Fora do prazo</div>
        <div className="flex items-center gap-2 text-[11px] text-gray-600"><Dot st="na"/>Não aplicável</div>
        <div className="ml-auto flex gap-5">
          <span className="text-[12px] font-semibold text-green-700">{totalSim} submetidos</span>
          <span className="text-[12px] font-semibold text-red-700">{totalFalta} em falta</span>
        </div>
      </div>

      {/* Top control table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Tabela de Controlo de Reportes</span>
          <span className="text-[11px] text-gray-400">{rows.length} reportes · 2026</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-600 min-w-[65px]">Código</th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-600 min-w-[300px]">Nome do Reporte</th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-gray-600 min-w-[90px]">Periodicidade</th>
                {MONTHS_SHORT.map(m => <th key={m} className={thCls}>{m}</th>)}
                <th className="w-[52px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ code, nome, periodicidade, appM }) => {
                const match = reportes.find(r => r.codigoRel === code)
                return (
                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2"><span className="font-mono text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-semibold">{code}</span></td>
                  <td className="px-4 py-2 text-[11px] text-gray-700 leading-snug">{nome}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PERIOD_BADGE[periodicidade] ?? 'bg-gray-100 text-gray-600'}`}>{periodicidade}</span></td>
                  {Array.from({ length: 12 }, (_, i) => (
                    <td key={i} className={tdCls}><Dot st={ctrlStatus(comunicacoes, code, i, appM)} /></td>
                  ))}
                  <td className="px-1 py-1.5 whitespace-nowrap">
                    {match && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setEditTarget(match)} title="Editar" className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600 transition-colors"><Pencil size={12} /></button>
                        <button onClick={() => { if (window.confirm(`Eliminar "${match.nome}"?`)) onDelete(match.codigo) }} title="Eliminar" className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )})}

            </tbody>
          </table>
        </div>
      </div>

      {/* Fund detail */}
      {fundGroups.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Detalhe de Fundos em Falta</span>
            <span className="text-[11px] text-gray-400">{fundGroups.reduce((a,g) => a + g.fundos.length, 0)} linhas · clique no código para expandir</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-600 min-w-[65px]">Cód.</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-600 min-w-[240px]">Fundo</th>
                  {MONTHS_SHORT.map(m => <th key={m} className={thCls}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {fundGroups.flatMap(({ code, fundos }) => {
                  const appM = applicableMonths(reportes.filter(r => r.codigoRel === code))
                  const groupRow = (
                    <tr key={`${code}-g`} className="bg-gray-50/80 border-b border-gray-200 cursor-pointer hover:bg-blue-50/40 transition-colors" onClick={() => toggle(code)}>
                      <td className="px-4 py-2" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{code}</span>
                          <span className="text-[11px] text-gray-500">{fundos.length} fundos</span>
                          <span className="text-[10px] text-gray-400 ml-1">{open.has(code) ? '▲' : '▼'}</span>
                        </div>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const ss = fundos.map(f => fundStatus(comunicacoes, code, f, i, appM))
                        const allNa  = ss.every(s => s === 'na')
                        const allSim = !allNa && ss.filter(s => s !== 'na').every(s => s === 'sim')
                        const st: CellSt = allNa ? 'na' : allSim ? 'sim' : 'falta'
                        return <td key={i} className={tdCls}><Dot st={st} /></td>
                      })}
                    </tr>
                  )
                  if (!open.has(code)) return [groupRow]
                  return [
                    groupRow,
                    ...fundos.map(fundo => (
                      <tr key={`${code}-${fundo}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-1.5 text-[10px] text-gray-300">↳</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-600">{fundo}</td>
                        {Array.from({ length: 12 }, (_, i) => (
                          <td key={i} className={tdCls}><Dot st={fundStatus(comunicacoes, code, fundo, i, appM)} /></td>
                        ))}
                      </tr>
                    )),
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Excel import helpers ─────────────────────────────────────────────────────
type RawRow = Record<string, unknown>

function normKey(s: string): string {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}
function buildHMap(row: RawRow): Record<string, string> {
  const m: Record<string, string> = {}
  for (const k of Object.keys(row)) m[normKey(k)] = k
  return m
}
function gv(row: RawRow, h: Record<string, string>, ...keys: string[]): unknown {
  for (const k of keys) { const o = h[normKey(k)]; if (o != null && row[o] != null && row[o] !== '') return row[o] }
  return ''
}
function gs(row: RawRow, h: Record<string, string>, ...keys: string[]): string {
  const v = gv(row, h, ...keys)
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v ?? '').trim()
}
function gdate(row: RawRow, h: Record<string, string>, ...keys: string[]): string {
  const v = gv(row, h, ...keys)
  if (!v || v === '') return ''
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` }
  return s.split('T')[0]
}
function gbool(row: RawRow, h: Record<string, string>, ...keys: string[]): boolean {
  const v = gs(row, h, ...keys).toLowerCase()
  return v === 'sim' || v === 'true' || v === '1' || v === 'yes'
}

function parseCalRow(row: RawRow, h: Record<string, string>): Reporte | null {
  const codigo = gs(row, h, 'Código', 'Codigo', 'cod')
  if (!codigo) return null
  return {
    codigo,
    entidade:     gs(row, h, 'Entidade'),
    codigoRel:    gs(row, h, 'Código Rel.', 'CodigoRel', 'Cód.', 'cod rel', 'codigorel'),
    nome:         gs(row, h, 'Nome', 'Nome do Reporte'),
    departamento: gs(row, h, 'Departamento', 'Dept'),
    periodicidade: gs(row, h, 'Periodicidade'),
    prazosLegais: gs(row, h, 'Prazos Legais', 'Prazos', 'Prazo'),
    proximaData:  gdate(row, h, 'Próxima Data', 'Proxima Data', 'proxima data', 'Data'),
    email:        gs(row, h, 'Email', 'e-mail', 'email'),
  }
}
function parseCmvmRow(row: RawRow, h: Record<string, string>): ComunicacaoCMVM | null {
  const codigoReporte = gs(row, h, 'Código de Reporte', 'Codigo de Reporte', 'Código', 'Codigo', 'codigoreporte')
  if (!codigoReporte) return null
  return {
    codigoReporte,
    dataEnvio:     gdate(row, h, 'Data de Envio', 'Data Envio', 'DataEnvio', 'Envio'),
    departamento:  gs(row, h, 'Departamento', 'Dept'),
    submetido:     gbool(row, h, 'Submetido?', 'Submetido', 'submitted'),
    dataFormulario: gs(row, h, 'Data Formulário', 'Data Formulario', 'DataFormulario', 'Data-formulário'),
    email:         gs(row, h, 'Email', 'e-mail', 'email'),
    mes:           gs(row, h, 'Mês', 'Mes', 'mes').toLowerCase(),
  }
}
function isCalSheet(keys: Set<string>): boolean {
  return keys.has('proximadata') || keys.has('prazoslegais') || keys.has('codigorel')
}
function isCmvmSheet(keys: Set<string>): boolean {
  return keys.has('mes') || keys.has('submetido') || keys.has('codigodereporte')
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function Reportes() {
  const [tab, setTab] = useState<'todos' | 'calendario' | 'cmvm' | 'controlo'>('todos')
  const [repData, setRepData] = useState<Reporte[]>([])
  const [comData, setComData] = useState<ComunicacaoCMVM[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; rep: number; com: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const seed = REPORTES.map(r => ({ ...r, id: r.codigo })) as (Reporte & { id: string })[]
    sbLoad('reportes', 'comp_reportes', seed).then(d => setRepData(d as Reporte[]))
    const seedCom = COMUNICACOES.map((c, i) => ({ ...c, id: `com-${String(i).padStart(3,'0')}` })) as (ComunicacaoCMVM & { id: string })[]
    sbLoad('reportes_comunicacoes', 'comp_reportes_comunicacoes', seedCom).then(d => setComData(d as ComunicacaoCMVM[]))
  }, [])

  function handleEdit(originalCodigo: string, updated: Reporte) {
    const next = repData.map(r => r.codigo === originalCodigo ? { ...updated, id: updated.id ?? updated.codigo } : r)
    setRepData(next); void sbSaveAll('reportes', 'comp_reportes', next as (Reporte & { id: string })[])
  }

  function handleDelete(codigo: string) {
    const next = repData.filter(r => r.codigo !== codigo)
    setRepData(next); void sbSaveAll('reportes', 'comp_reportes', next as (Reporte & { id: string })[])
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })

      let newRep: Reporte[]          = []
      let newCom: ComunicacaoCMVM[]  = []

      for (const name of wb.SheetNames) {
        const ws   = wb.Sheets[name]
        const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' })
        if (rows.length === 0) continue
        const hmap = buildHMap(rows[0])
        const keys = new Set(Object.keys(hmap))
        if (isCalSheet(keys)) {
          newRep = rows.map(r => parseCalRow(r, hmap)).filter((r): r is Reporte => r !== null)
        } else if (isCmvmSheet(keys)) {
          newCom = rows.map(r => parseCmvmRow(r, hmap)).filter((r): r is ComunicacaoCMVM => r !== null)
        }
      }

      if (newRep.length > 0) {
        const withId = newRep.map(r => ({ ...r, id: r.id ?? r.codigo })) as (Reporte & { id: string })[]
        setRepData(withId); void sbSaveAll('reportes', 'comp_reportes', withId)
      }
      if (newCom.length > 0) {
        const withId = newCom.map((c, i) => ({ ...c, id: c.id ?? `com-${String(i).padStart(3,'0')}` })) as (ComunicacaoCMVM & { id: string })[]
        setComData(withId); void sbSaveAll('reportes_comunicacoes', 'comp_reportes_comunicacoes', withId)
      }
      setResult({ ok: true, rep: newRep.length, com: newCom.length })
    } catch {
      setResult({ ok: false, rep: 0, com: 0 })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setResult(null), 5000)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="tab-list">
          <button className="tab-trigger" data-state={tab === 'todos' ? 'active' : 'inactive'} onClick={() => setTab('todos')}>
            Todos os Reportes
          </button>
          <button className="tab-trigger" data-state={tab === 'calendario' ? 'active' : 'inactive'} onClick={() => setTab('calendario')}>
            Calendário de Reportes
          </button>
          <button className="tab-trigger" data-state={tab === 'cmvm' ? 'active' : 'inactive'} onClick={() => setTab('cmvm')}>
            Registo de Comunicação à CMVM
          </button>
          <button className="tab-trigger" data-state={tab === 'controlo' ? 'active' : 'inactive'} onClick={() => setTab('controlo')}>
            Controlo de Reportes
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {result && (
            <div className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all ${result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.ok
                ? <><CheckCircle2 size={12} />{[result.rep > 0 && `${result.rep} reportes`, result.com > 0 && `${result.com} comunicações`].filter(Boolean).join(', ')} importados</>
                : <><AlertCircle size={12} />Erro ao ler o ficheiro</>}
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={12} />
            {importing ? 'A importar…' : 'Importar Excel'}
          </button>
        </div>
      </div>

      {tab === 'todos'      && <TabTodosReportes reportes={repData} onAdd={r => setRepData(prev => [...prev, r])} onEdit={handleEdit} onDelete={handleDelete} />}
      {tab === 'calendario' && <TabCalendario reportes={repData} onEdit={handleEdit} onDelete={handleDelete} />}
      {tab === 'cmvm'       && <TabRegistoCMVM comunicacoes={comData} />}
      {tab === 'controlo'   && <TabControlo reportes={repData} comunicacoes={comData} onEdit={handleEdit} onDelete={handleDelete} />}
    </div>
  )
}
