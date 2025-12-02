import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Contrato } from "../types/database.types";

/**
 * Hook para buscar CPFs vinculados a um contrato
 * Elimina duplicação da lógica de busca de CPFs
 */
export const useContractCPFs = (filtroContrato: Contrato | null) => {
  const [cpfs, setCpfs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCPFs = async () => {
      if (!filtroContrato) {
        setCpfs([]);
        return;
      }

      try {
        setLoading(true);
        let allCpfs: string[] = [];

        // Buscar CPFs da tabela usuario_contrato (junction table)
        const { data: usuariosContrato } = await supabase
          .from("usuario_contrato")
          .select("cpf")
          .eq("contrato_id", filtroContrato.id);

        if (usuariosContrato && usuariosContrato.length > 0) {
          allCpfs = usuariosContrato.map((u: any) => u.cpf);
        }

        // Buscar CPFs da tabela usuarios diretamente (para usuários importados via CSV)
        const { data: usuariosDirectos } = await supabase
          .from("usuarios")
          .select("cpf")
          .eq("contrato_id", filtroContrato.id);

        if (usuariosDirectos && usuariosDirectos.length > 0) {
          const cpfsDirectos = usuariosDirectos.map((u: any) => u.cpf);
          // Combinar os dois arrays sem duplicatas
          allCpfs = [...new Set([...allCpfs, ...cpfsDirectos])];
        }

        setCpfs(allCpfs);
      } catch (err) {
        console.error("Erro ao buscar CPFs do contrato:", err);
        setCpfs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCPFs();
  }, [filtroContrato]);

  return { cpfs, loading };
};
