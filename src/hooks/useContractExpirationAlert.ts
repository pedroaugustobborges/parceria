import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Contrato } from "../types/database.types";

interface ContractExpirationAlert {
  count: number;
  contracts: Contrato[];
  loading: boolean;
}

/**
 * Hook customizado para monitorar contratos próximos ao vencimento.
 * Considera apenas contratos que o usuário tem permissão de acessar.
 *
 * @returns {ContractExpirationAlert} Objeto com contagem, lista de contratos e estado de carregamento
 */
export const useContractExpirationAlert = (): ContractExpirationAlert => {
  const [count, setCount] = useState(0);
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    userProfile,
    isAdminAgir,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
    unidadeHospitalarId,
  } = useAuth();

  useEffect(() => {
    const loadExpiringContracts = async () => {
      if (!userProfile || !isAdminAgir) {
        // Apenas admins Agir têm acesso a contratos
        setCount(0);
        setContracts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Calcular data limite (hoje + 90 dias)
        const today = new Date();
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + 90);

        // Construir query base
        let query = supabase
          .from("contratos")
          .select("*")
          .eq("ativo", true) // Apenas contratos ativos
          .not("data_fim", "is", null) // Apenas contratos com data de fim definida
          .lte("data_fim", limitDate.toISOString()) // Data de fim <= hoje + 90 dias
          .gte("data_fim", today.toISOString()); // Data de fim >= hoje (não expirados)

        // Filtrar por permissões
        if (isAdminAgirPlanta && unidadeHospitalarId) {
          // Admin Planta: apenas contratos da sua unidade
          query = query.eq("unidade_hospitalar_id", unidadeHospitalarId);
        }
        // Admin Corporativo: vê todos os contratos (sem filtro adicional)

        // Ordenar por data de fim (mais próximos primeiro)
        query = query.order("data_fim", { ascending: true });

        const { data, error } = await query;

        if (error) {
          console.error("Erro ao carregar contratos próximos ao vencimento:", error);
          setCount(0);
          setContracts([]);
        } else {
          setCount(data?.length || 0);
          setContracts(data || []);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar contratos:", err);
        setCount(0);
        setContracts([]);
      } finally {
        setLoading(false);
      }
    };

    loadExpiringContracts();

    // Atualizar a cada 5 minutos
    const interval = setInterval(loadExpiringContracts, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [
    userProfile,
    isAdminAgir,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
    unidadeHospitalarId,
  ]);

  return { count, contracts, loading };
};
