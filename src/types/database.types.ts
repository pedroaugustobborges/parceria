export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      acessos: {
        Row: {
          cod_codin: string | null
          cod_planta: string | null
          codin: string | null
          cpf: string
          cracha: string | null
          created_at: string | null
          data_acesso: string
          desc_perm: string | null
          descr_acesso: string | null
          grupo_de_acess: string | null
          id: string
          matricula: string
          modelo: string | null
          nome: string
          pis: string | null
          planta: string | null
          sentido: string
          tipo: string
          tipo_acesso: string | null
        }
        Insert: {
          cod_codin?: string | null
          cod_planta?: string | null
          codin?: string | null
          cpf: string
          cracha?: string | null
          created_at?: string | null
          data_acesso: string
          desc_perm?: string | null
          descr_acesso?: string | null
          grupo_de_acess?: string | null
          id?: string
          matricula: string
          modelo?: string | null
          nome: string
          pis?: string | null
          planta?: string | null
          sentido: string
          tipo: string
          tipo_acesso?: string | null
        }
        Update: {
          cod_codin?: string | null
          cod_planta?: string | null
          codin?: string | null
          cpf?: string
          cracha?: string | null
          created_at?: string | null
          data_acesso?: string
          desc_perm?: string | null
          descr_acesso?: string | null
          grupo_de_acess?: string | null
          id?: string
          matricula?: string
          modelo?: string | null
          nome?: string
          pis?: string | null
          planta?: string | null
          sentido?: string
          tipo?: string
          tipo_acesso?: string | null
        }
        Relationships: []
      }
      contrato_itens: {
        Row: {
          contrato_id: string
          created_at: string | null
          id: string
          item_id: string
          observacoes: string | null
          quantidade: number
          unidade_medida: string | null
          valor_unitario: number
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          id?: string
          item_id: string
          observacoes?: string | null
          quantidade?: number
          unidade_medida?: string | null
          valor_unitario: number
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          id?: string
          item_id?: string
          observacoes?: string | null
          quantidade?: number
          unidade_medida?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_itens_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          empresa: string
          id: string
          nome: string
          numero_contrato: string | null
          unidade_hospitalar_id: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          empresa: string
          id?: string
          nome: string
          numero_contrato?: string | null
          unidade_hospitalar_id?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          empresa?: string
          id?: string
          nome?: string
          numero_contrato?: string | null
          unidade_hospitalar_id?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas_chat: {
        Row: {
          created_at: string | null
          id: string
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_chat_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_chunks: {
        Row: {
          contagem_tokens: number | null
          conteudo: string
          contrato_id: string
          created_at: string | null
          documento_id: string
          embedding: string | null
          id: string
          indice_chunk: number
          metadata: Json | null
          numero_pagina: number | null
          titulo_secao: string | null
          unidade_hospitalar_id: string | null
        }
        Insert: {
          contagem_tokens?: number | null
          conteudo: string
          contrato_id: string
          created_at?: string | null
          documento_id: string
          embedding?: string | null
          id?: string
          indice_chunk: number
          metadata?: Json | null
          numero_pagina?: number | null
          titulo_secao?: string | null
          unidade_hospitalar_id?: string | null
        }
        Update: {
          contagem_tokens?: number | null
          conteudo?: string
          contrato_id?: string
          created_at?: string | null
          documento_id?: string
          embedding?: string | null
          id?: string
          indice_chunk?: number
          metadata?: Json | null
          numero_pagina?: number | null
          titulo_secao?: string | null
          unidade_hospitalar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_chunks_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_chunks_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_gestao_chunks: {
        Row: {
          contagem_tokens: number | null
          conteudo: string
          created_at: string | null
          documento_id: string
          embedding: string | null
          id: string
          indice_chunk: number
          metadata: Json | null
          numero_pagina: number | null
          titulo_secao: string | null
          unidade_hospitalar_id: string
        }
        Insert: {
          contagem_tokens?: number | null
          conteudo: string
          created_at?: string | null
          documento_id: string
          embedding?: string | null
          id?: string
          indice_chunk: number
          metadata?: Json | null
          numero_pagina?: number | null
          titulo_secao?: string | null
          unidade_hospitalar_id: string
        }
        Update: {
          contagem_tokens?: number | null
          conteudo?: string
          created_at?: string | null
          documento_id?: string
          embedding?: string | null
          id?: string
          indice_chunk?: number
          metadata?: Json | null
          numero_pagina?: number | null
          titulo_secao?: string | null
          unidade_hospitalar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_gestao_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_gestao_chunks_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_contrato: {
        Row: {
          caminho_storage: string
          contrato_id: string
          created_at: string | null
          enviado_por: string | null
          id: string
          mensagem_erro: string | null
          mime_type: string | null
          nome_arquivo: string
          status: string | null
          tamanho_bytes: number | null
          updated_at: string | null
        }
        Insert: {
          caminho_storage: string
          contrato_id: string
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          mime_type?: string | null
          nome_arquivo: string
          status?: string | null
          tamanho_bytes?: number | null
          updated_at?: string | null
        }
        Update: {
          caminho_storage?: string
          contrato_id?: string
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          status?: string | null
          tamanho_bytes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_contrato_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_gestao: {
        Row: {
          ativo: boolean | null
          caminho_storage: string
          created_at: string | null
          enviado_por: string | null
          id: string
          mensagem_erro: string | null
          mime_type: string | null
          nome_arquivo: string
          status: string | null
          tamanho_bytes: number | null
          unidade_hospitalar_id: string
          updated_at: string | null
          versao: number | null
        }
        Insert: {
          ativo?: boolean | null
          caminho_storage: string
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          mime_type?: string | null
          nome_arquivo: string
          status?: string | null
          tamanho_bytes?: number | null
          unidade_hospitalar_id: string
          updated_at?: string | null
          versao?: number | null
        }
        Update: {
          ativo?: boolean | null
          caminho_storage?: string
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          status?: string | null
          tamanho_bytes?: number | null
          unidade_hospitalar_id?: string
          updated_at?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_gestao_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_gestao_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_medicas: {
        Row: {
          ativo: boolean | null
          contrato_id: string
          created_at: string | null
          created_by: string | null
          data_inicio: string
          horario_entrada: string
          base_calculo: string | null
          campo_producao: string | null
          horario_pagamento_fim: string | null
          horario_pagamento_inicio: string | null
          horario_saida: string
          id: string
          item_contrato_id: string
          justificativa: string | null
          medicos: Json
          observacoes: string | null
          quantidade_producao: number | null
          status: string
          status_alterado_em: string | null
          status_alterado_por: string | null
          status_pagamento: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_calculo?: string | null
          campo_producao?: string | null
          contrato_id: string
          created_at?: string | null
          created_by?: string | null
          data_inicio: string
          horario_entrada: string
          horario_pagamento_fim?: string | null
          horario_pagamento_inicio?: string | null
          horario_saida: string
          id?: string
          item_contrato_id: string
          justificativa?: string | null
          medicos: Json
          observacoes?: string | null
          quantidade_producao?: number | null
          status?: string
          status_alterado_em?: string | null
          status_alterado_por?: string | null
          status_pagamento?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_calculo?: string | null
          campo_producao?: string | null
          contrato_id?: string
          created_at?: string | null
          created_by?: string | null
          data_inicio?: string
          horario_entrada?: string
          horario_pagamento_fim?: string | null
          horario_pagamento_inicio?: string | null
          horario_saida?: string
          id?: string
          item_contrato_id?: string
          justificativa?: string | null
          medicos?: Json
          observacoes?: string | null
          quantidade_producao?: number | null
          status?: string
          status_alterado_em?: string | null
          status_alterado_por?: string | null
          status_pagamento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_medicas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_medicas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_medicas_status_alterado_por_fkey"
            columns: ["status_alterado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escalas_item_contrato"
            columns: ["item_contrato_id"]
            isOneToOne: false
            referencedRelation: "itens_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_ia: {
        Row: {
          created_at: string | null
          data_analise: string | null
          diagnostico: string
          id: string
          role_tipo: string | null
          unidade_hospitalar_id: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_analise?: string | null
          diagnostico: string
          id?: string
          role_tipo?: string | null
          unidade_hospitalar_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_analise?: string | null
          diagnostico?: string
          id?: string
          role_tipo?: string | null
          unidade_hospitalar_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_ia_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_ia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_contrato: {
        Row: {
          ativo: boolean | null
          codigo_corporativo: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          unidade_medida: string[]
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo_corporativo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          unidade_medida: string[]
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo_corporativo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          unidade_medida?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      mensagens_chat: {
        Row: {
          citacoes: Json | null
          conteudo: string
          conversa_id: string
          created_at: string | null
          id: string
          role: string
          rota: string | null
          sql_executado: string | null
        }
        Insert: {
          citacoes?: Json | null
          conteudo: string
          conversa_id: string
          created_at?: string | null
          id?: string
          role: string
          rota?: string | null
          sql_executado?: string | null
        }
        Update: {
          citacoes?: Json | null
          conteudo?: string
          conversa_id?: string
          created_at?: string | null
          id?: string
          role?: string
          rota?: string | null
          sql_executado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_chat_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas_chat"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros: {
        Row: {
          ativo: boolean | null
          cnpj: string
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj: string
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      produtividade: {
        Row: {
          ambulatorio: number | null
          auxiliar: number | null
          cirurgia_realizada: number | null
          codigo_mv: string
          created_at: string
          data: string | null
          encaminhamento: number | null
          especialidade: string | null
          evolucao: number | null
          evolucao_diurna_cti: number | null
          evolucao_noturna_cti: number | null
          folha_objetivo_diario: number | null
          id: string
          nome: string
          origem: string | null
          parecer_realizado: number | null
          parecer_solicitado: number | null
          prescricao: number | null
          procedimento: number | null
          qtd_documentos_pep: number | null
          unidade_hospitalar_id: string | null
          updated_at: string
          urgencia: number | null
          vinculo: string | null
        }
        Insert: {
          ambulatorio?: number | null
          auxiliar?: number | null
          cirurgia_realizada?: number | null
          codigo_mv: string
          created_at?: string
          data?: string | null
          encaminhamento?: number | null
          especialidade?: string | null
          evolucao?: number | null
          evolucao_diurna_cti?: number | null
          evolucao_noturna_cti?: number | null
          folha_objetivo_diario?: number | null
          id?: string
          nome: string
          origem?: string | null
          parecer_realizado?: number | null
          parecer_solicitado?: number | null
          prescricao?: number | null
          procedimento?: number | null
          qtd_documentos_pep?: number | null
          unidade_hospitalar_id?: string | null
          updated_at?: string
          urgencia?: number | null
          vinculo?: string | null
        }
        Update: {
          ambulatorio?: number | null
          auxiliar?: number | null
          cirurgia_realizada?: number | null
          codigo_mv?: string
          created_at?: string
          data?: string | null
          encaminhamento?: number | null
          especialidade?: string | null
          evolucao?: number | null
          evolucao_diurna_cti?: number | null
          evolucao_noturna_cti?: number | null
          folha_objetivo_diario?: number | null
          id?: string
          nome?: string
          origem?: string | null
          parecer_realizado?: number | null
          parecer_solicitado?: number | null
          prescricao?: number | null
          procedimento?: number | null
          qtd_documentos_pep?: number | null
          unidade_hospitalar_id?: string | null
          updated_at?: string
          urgencia?: number | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtividade_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_hospitalares: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          endereco: string | null
          id: string
          nome: string
          possui_gestao_acesso: boolean | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome: string
          possui_gestao_acesso?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          possui_gestao_acesso?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      usuario_contrato: {
        Row: {
          contrato_id: string | null
          cpf: string
          created_at: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          contrato_id?: string | null
          cpf: string
          created_at?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          contrato_id?: string | null
          cpf?: string
          created_at?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_contrato_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          codigomv: string | null
          contrato_id: string | null
          cpf: string
          created_at: string | null
          email: string | null
          especialidade: string[] | null
          id: string
          nome: string
          tipo: string
          unidade_hospitalar_id: string | null
          updated_at: string | null
        }
        Insert: {
          codigomv?: string | null
          contrato_id?: string | null
          cpf: string
          created_at?: string | null
          email?: string | null
          especialidade?: string[] | null
          id: string
          nome: string
          tipo: string
          unidade_hospitalar_id?: string | null
          updated_at?: string | null
        }
        Update: {
          codigomv?: string | null
          contrato_id?: string | null
          cpf?: string
          created_at?: string | null
          email?: string | null
          especialidade?: string[] | null
          id?: string
          nome?: string
          tipo?: string
          unidade_hospitalar_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vm_acessos_mensal: {
        Row: {
          entradas: number | null
          mes: string | null
          pessoas_unicas: number | null
          planta: string | null
          saidas: number | null
          tipo: string | null
          total_registros: number | null
        }
        Relationships: []
      }
      vm_escalas_mensal: {
        Row: {
          aprovadas: number | null
          contrato_id: string | null
          empresa: string | null
          especialidade: string | null
          mes: string | null
          pre_agendadas: number | null
          programadas: number | null
          reprovadas: number | null
          total_escalas: number | null
          total_medicos: number | null
          unidade_hospitalar_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_medicas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_produtividade_mensal: {
        Row: {
          especialidade: string | null
          mes: string | null
          profissionais_ativos: number | null
          total_ambulatorios: number | null
          total_cirurgias: number | null
          total_evolucoes: number | null
          total_pareceres_realizados: number | null
          total_pareceres_solicitados: number | null
          total_prescricoes: number | null
          total_procedimentos: number | null
          total_urgencias: number | null
          unidade_hospitalar_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtividade_unidade_hospitalar_id_fkey"
            columns: ["unidade_hospitalar_id"]
            isOneToOne: false
            referencedRelation: "unidades_hospitalares"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      atualizar_views_analytics: { Args: never; Returns: undefined }
      buscar_chunks_similares: {
        Args: {
          embedding_consulta: string
          filtro_contrato_ids?: string[]
          limite_resultados?: number
          limite_similaridade?: number
        }
        Returns: {
          conteudo: string
          contrato_id: string
          id: string
          nome_arquivo: string
          numero_pagina: number
          similaridade: number
          titulo_secao: string
        }[]
      }
      buscar_chunks_similares_v2: {
        Args: {
          embedding_consulta: string
          filtro_contrato_ids?: string[]
          filtro_unidade_id?: string
          incluir_gestao?: boolean
          limite_resultados?: number
          limite_similaridade?: number
        }
        Returns: {
          conteudo: string
          contrato_id: string
          id: string
          nome_arquivo: string
          numero_pagina: number
          similaridade: number
          tipo_documento: string
          titulo_secao: string
          unidade_hospitalar_id: string
        }[]
      }
      can_insert_user: { Args: never; Returns: boolean }
      delete_user_completely: { Args: { user_id: string }; Returns: boolean }
      executar_consulta_analytics: {
        Args: { id_usuario: string; texto_consulta: string }
        Returns: Json
      }
      is_admin_agir: { Args: never; Returns: boolean }
      is_user_admin: { Args: never; Returns: boolean }
      recalcular_valor_total_contrato: {
        Args: { p_contrato_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ============================================
// Custom Types
// ============================================

/**
 * Status types for medical schedules (escalas).
 * Payment is now tracked via status_pagamento column ('Sim'/'Não').
 * When status_pagamento = 'Sim', the schedule is locked for editing.
 */
export type StatusEscala =
  | 'Programado'
  | 'Pré-Aprovado'
  | 'Aprovação Parcial'
  | 'Atenção'
  | 'Aprovado'
  | 'Aprovado com Glosa'
  | 'Reprovado'
  | 'Excluída';

/**
 * Payment status for medical schedules.
 * Only administrador-corporativo and administrador-planta can change this.
 */
export type StatusPagamento = 'Sim' | 'Não';

/**
 * Single doctor record in a schedule.
 */
export interface MedicoEscala {
  nome: string;
  cpf: string;
}

// ============================================
// Convenience Type Aliases (Table Row types)
// ============================================

export type Contrato = Database['public']['Tables']['contratos']['Row']
export type ItemContrato = Database['public']['Tables']['itens_contrato']['Row']
export type ContratoItem = Database['public']['Tables']['contrato_itens']['Row']
export type Parceiro = Database['public']['Tables']['parceiros']['Row']
export type UnidadeHospitalar = Database['public']['Tables']['unidades_hospitalares']['Row']
export type DocumentoContrato = Database['public']['Tables']['documentos_contrato']['Row']

export type UnidadeMedida =
  | 'atendimento ambulatorial'
  | 'atendimento domiciliar'
  | 'auxílio'
  | 'carga horária mensal'
  | 'carga horária semanal'
  | 'cirurgia'
  | 'consulta'
  | 'diária'
  | 'do mensal estimado'
  | 'horas'
  | 'intervenção'
  | 'parecer médico'
  | 'período'
  | 'plantão'
  | 'procedimento'
  | 'sobreaviso'
  | 'visita'

/**
 * Medical schedule record (escalas_medicas table Row).
 */
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
  status_pagamento: StatusPagamento;
  horario_pagamento_inicio: string | null;
  horario_pagamento_fim: string | null;
  base_calculo: string | null;
  campo_producao: string | null;
  quantidade_producao: number | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}
