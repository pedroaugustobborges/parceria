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
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  nome: string;
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
  entradas: number;
  saidas: number;
  ultimoAcesso: string;
}
