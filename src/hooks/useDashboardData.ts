import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  Contrato,
  Produtividade,
  Usuario,
  UnidadeHospitalar,
  EscalaMedica,
} from "../types/database.types";

/**
 * Hook para gerenciar carregamento de dados auxiliares do Dashboard
 */
export const useDashboardData = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoItems, setContratoItems] = useState<any[]>([]);
  const [produtividade, setProdutividade] = useState<Produtividade[]>([]);
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadContratos = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("contratos")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    if (fetchError) throw fetchError;
    setContratos(data || []);
  }, []);

  const loadContratoItems = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("contrato_itens")
      .select("*");

    if (fetchError) throw fetchError;
    setContratoItems(data || []);
  }, []);

  const loadProdutividade = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("produtividade")
      .select("*")
      .order("data", { ascending: false });

    if (fetchError) throw fetchError;
    setProdutividade(data || []);
  }, []);

  const loadEscalas = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("escalas_medicas")
      .select("*")
      .eq("ativo", true)
      .order("data_inicio", { ascending: false });

    if (fetchError) throw fetchError;
    setEscalas(data || []);
  }, []);

  const loadUsuarios = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("usuarios")
      .select("cpf, codigomv");

    if (fetchError) throw fetchError;
    setUsuarios(data || []);
  }, []);

  const loadUnidades = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("unidades_hospitalares")
      .select("*")
      .eq("ativo", true)
      .order("codigo");

    if (fetchError) throw fetchError;
    setUnidades(data || []);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([
        loadContratos(),
        loadContratoItems(),
        loadProdutividade(),
        loadEscalas(),
        loadUsuarios(),
        loadUnidades(),
      ]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados");
      console.error("Erro ao carregar dados auxiliares:", err);
    } finally {
      setLoading(false);
    }
  }, [
    loadContratos,
    loadContratoItems,
    loadProdutividade,
    loadEscalas,
    loadUsuarios,
    loadUnidades,
  ]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const refreshData = useCallback(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    contratos,
    contratoItems,
    produtividade,
    escalas,
    usuarios,
    unidades,
    loading,
    error,
    refreshData,
  };
};
