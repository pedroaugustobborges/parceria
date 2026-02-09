export type UserRole =
  | 'administrador-agir-corporativo'
  | 'administrador-agir-planta'
  | 'administrador-terceiro'
  | 'terceiro';

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          email: string;
          nome: string;
          cpf: string;
          tipo: UserRole;
          contrato_id: string | null;
          codigomv: string | null;
          especialidade: string[] | null;
          unidade_hospitalar_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>;
      };
      contratos: {
        Row: {
          id: string;
          nome: string;
          numero_contrato: string | null;
          empresa: string;
          data_inicio: string;
          data_fim: string | null;
          ativo: boolean;
          unidade_hospitalar_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contratos']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['contratos']['Insert']>;
      };
      acessos: {
        Row: {
          id: string;
          tipo: string;
          matricula: string;
          nome: string;
          cpf: string;
          data_acesso: string;
          sentido: 'E' | 'S'; // E = Entrada, S = Saída
          planta: string | null;
          codin: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['acessos']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['acessos']['Insert']>;
      };
      usuario_contrato: {
        Row: {
          id: string;
          usuario_id: string;
          contrato_id: string;
          cpf: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['usuario_contrato']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['usuario_contrato']['Insert']>;
      };
      produtividade: {
        Row: {
          id: string;
          codigo_mv: string;
          nome: string;
          especialidade: string | null;
          vinculo: string | null;
          data: string | null;
          procedimento: number;
          parecer_solicitado: number;
          parecer_realizado: number;
          cirurgia_realizada: number;
          prescricao: number;
          evolucao: number;
          urgencia: number;
          ambulatorio: number;
          auxiliar: number;
          encaminhamento: number;
          folha_objetivo_diario: number;
          evolucao_diurna_cti: number;
          evolucao_noturna_cti: number;
          unidade_hospitalar_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['produtividade']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['produtividade']['Insert']>;
      };
      unidades_hospitalares: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          endereco: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['unidades_hospitalares']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['unidades_hospitalares']['Insert']>;
      };
      documentos_contrato: {
        Row: {
          id: string;
          contrato_id: string;
          nome_arquivo: string;
          caminho_storage: string;
          tamanho_bytes: number | null;
          mime_type: string;
          enviado_por: string | null;
          status: string;
          mensagem_erro: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          contrato_id: string;
          nome_arquivo: string;
          caminho_storage: string;
          tamanho_bytes?: number | null;
          mime_type?: string;
          enviado_por?: string | null;
          status?: string;
          mensagem_erro?: string | null;
        };
        Update: Partial<Database['public']['Tables']['documentos_contrato']['Insert']>;
      };
      documento_chunks: {
        Row: {
          id: string;
          documento_id: string;
          contrato_id: string;
          unidade_hospitalar_id: string | null;
          indice_chunk: number;
          conteudo: string;
          titulo_secao: string | null;
          numero_pagina: number | null;
          contagem_tokens: number | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documento_chunks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documento_chunks']['Insert']>;
      };
      conversas_chat: {
        Row: {
          id: string;
          usuario_id: string;
          titulo: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversas_chat']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['conversas_chat']['Insert']>;
      };
      mensagens_chat: {
        Row: {
          id: string;
          conversa_id: string;
          role: string;
          conteudo: string;
          rota: string | null;
          citacoes: any | null;
          sql_executado: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mensagens_chat']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['mensagens_chat']['Insert']>;
      };
      insights_ia: {
        Row: {
          id: string;
          diagnostico: string;
          data_analise: string;
          usuario_id: string | null;
          unidade_hospitalar_id: string | null;
          role_tipo: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['insights_ia']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['insights_ia']['Insert']>;
      };
    };
  };
}

export interface Acesso {
  id: string;
  tipo: string;
  matricula: string;
  nome: string;
  cpf: string;
  data_acesso: string;
  sentido: 'E' | 'S';
  planta: string | null;
  codin: string | null;
  created_at: string;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  cpf: string;
  tipo: UserRole;
  contrato_id: string | null;
  codigomv: string | null;
  especialidade: string[] | null;
  unidade_hospitalar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string | null;
  empresa: string;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  unidade_hospitalar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HorasCalculadas {
  cpf: string;
  nome: string;
  matricula: string;
  tipo: string;
  codigomv: string;
  totalHoras: number;
  cargaHorariaEscalada: number;
  diasComRegistro: number;
  entradas: number;
  saidas: number;
  ultimoAcesso: string;
  especialidade: string;
  produtividade_procedimento: number;
  produtividade_parecer_solicitado: number;
  produtividade_parecer_realizado: number;
  produtividade_cirurgia_realizada: number;
  produtividade_prescricao: number;
  produtividade_evolucao: number;
  produtividade_urgencia: number;
  produtividade_ambulatorio: number;
  produtividade_auxiliar: number;
  produtividade_encaminhamento: number;
  produtividade_folha_objetivo_diario: number;
  produtividade_evolucao_diurna_cti: number;
  produtividade_evolucao_noturna_cti: number;
}

export type UnidadeMedida =
  | 'horas'
  | 'plantão'
  | 'procedimento'
  | 'cirurgia'
  | 'consulta'
  | 'diária'
  | 'atendimento ambulatorial'
  | 'atendimento domiciliar'
  | 'intervenção'
  | 'parecer médico'
  | 'visita'
  | 'carga horária semanal'
  | 'carga horária mensal';

export interface ItemContrato {
  id: string;
  nome: string;
  descricao: string | null;
  unidade_medida: UnidadeMedida;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContratoItem {
  id: string;
  contrato_id: string;
  item_id: string;
  quantidade: number;
  valor_unitario: number | null;
  observacoes: string | null;
  created_at: string;
}

export interface Parceiro {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Produtividade {
  id: string;
  codigo_mv: string;
  nome: string;
  especialidade: string | null;
  vinculo: string | null;
  data: string | null;
  procedimento: number;
  parecer_solicitado: number;
  parecer_realizado: number;
  cirurgia_realizada: number;
  prescricao: number;
  evolucao: number;
  urgencia: number;
  ambulatorio: number;
  auxiliar: number;
  encaminhamento: number;
  folha_objetivo_diario: number;
  evolucao_diurna_cti: number;
  evolucao_noturna_cti: number;
  unidade_hospitalar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnidadeHospitalar {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsightIA {
  id: string;
  diagnostico: string;
  data_analise: string;
  usuario_id?: string;
  unidade_hospitalar_id?: string;
  role_tipo?: string;
  created_at: string;
}

export interface DocumentoContrato {
  id: string;
  contrato_id: string;
  nome_arquivo: string;
  caminho_storage: string;
  tamanho_bytes: number | null;
  mime_type: string;
  enviado_por: string | null;
  status: 'pendente' | 'processando' | 'pronto' | 'erro';
  mensagem_erro: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentoGestao {
  id: string;
  unidade_hospitalar_id: string;
  nome_arquivo: string;
  caminho_storage: string;
  tamanho_bytes: number | null;
  mime_type: string;
  enviado_por: string | null;
  status: 'pendente' | 'processando' | 'pronto' | 'erro';
  mensagem_erro: string | null;
  versao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Citacao {
  documento: string;
  secao: string;
  pagina?: number;
}

export type RotaChat = 'sql' | 'rag' | 'hibrido';

export interface RespostaChat {
  resposta: string;
  rota: RotaChat;
  citacoes?: Citacao[];
  sqlExecutado?: string;
}

export interface ConversaChat {
  id: string;
  usuario_id: string;
  titulo: string | null;
  created_at: string;
}

export interface MensagemChat {
  id: string;
  conversa_id: string;
  role: 'user' | 'assistant' | 'system';
  conteudo: string;
  rota?: RotaChat;
  citacoes?: Citacao[];
  sql_executado?: string;
  created_at: string;
}

export interface MedicoEscala {
  nome: string;
  cpf: string;
}

export type StatusEscala = 'Pré-Agendado' | 'Programado' | 'Pré-Aprovado' | 'Aprovação Parcial' | 'Atenção' | 'Aprovado' | 'Reprovado';

export interface EscalaMedica {
  id: string;
  contrato_id: string;
  item_contrato_id: string;
  data_inicio: string;
  horario_entrada: string;
  horario_saida: string;
  medicos: MedicoEscala[];
  observacoes: string | null;
  status: StatusEscala;
  justificativa: string | null;
  status_alterado_por: string | null;
  status_alterado_em: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
