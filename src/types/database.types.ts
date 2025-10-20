export type UserRole = 'administrador-agir' | 'administrador-terceiro' | 'terceiro';

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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['produtividade']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['produtividade']['Insert']>;
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
  created_at: string;
  updated_at: string;
}

export interface HorasCalculadas {
  cpf: string;
  nome: string;
  matricula: string;
  tipo: string;
  totalHoras: number;
  diasComRegistro: number;
  entradas: number;
  saidas: number;
  ultimoAcesso: string;
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
  created_at: string;
  updated_at: string;
}
