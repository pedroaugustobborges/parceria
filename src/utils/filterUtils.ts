import { Acesso, Produtividade } from "../types/database.types";
import { isDateInRange, extractDateString } from "./dateUtils";

/**
 * Filtros para acessos
 */
export interface AccessFilters {
  tipo?: string[];
  matricula?: string[];
  nome?: string[];
  cpf?: string[];
  sentido?: string[];
  unidade?: string[];
  contractCpfs?: string[];
  dataInicio?: Date | null;
  dataFim?: Date | null;
}

/**
 * Aplica todos os filtros em um array de acessos
 */
export const filterAccesses = (
  accesses: Acesso[],
  filters: AccessFilters
): Acesso[] => {
  return accesses.filter((access) => {
    // Filtros de múltiplas seleções
    if (filters.tipo && filters.tipo.length > 0 && !filters.tipo.includes(access.tipo)) {
      return false;
    }

    if (
      filters.matricula &&
      filters.matricula.length > 0 &&
      !filters.matricula.includes(access.matricula)
    ) {
      return false;
    }

    if (filters.nome && filters.nome.length > 0 && !filters.nome.includes(access.nome)) {
      return false;
    }

    if (filters.cpf && filters.cpf.length > 0 && !filters.cpf.includes(access.cpf)) {
      return false;
    }

    if (
      filters.sentido &&
      filters.sentido.length > 0 &&
      !filters.sentido.includes(access.sentido)
    ) {
      return false;
    }

    if (
      filters.unidade &&
      filters.unidade.length > 0 &&
      !filters.unidade.includes(access.planta)
    ) {
      return false;
    }

    // Filtro de contrato (CPFs)
    if (
      filters.contractCpfs &&
      filters.contractCpfs.length > 0 &&
      !filters.contractCpfs.includes(access.cpf)
    ) {
      return false;
    }

    // Filtros de data
    if (!isDateInRange(access.data_acesso, filters.dataInicio || null, filters.dataFim || null)) {
      return false;
    }

    return true;
  });
};

/**
 * Extrai valores únicos de um campo dos acessos
 */
export const getUniqueValues = <T>(
  items: any[],
  field: string
): T[] => {
  return [...new Set(items.map((item) => item[field]))].sort() as T[];
};

/**
 * Calcula a soma de todas as atividades de produtividade
 */
export const calculateProductivitySum = (prod: Produtividade): number => {
  return (
    prod.procedimento +
    prod.parecer_solicitado +
    prod.parecer_realizado +
    prod.cirurgia_realizada +
    prod.prescricao +
    prod.evolucao +
    prod.urgencia +
    prod.ambulatorio +
    prod.auxiliar +
    prod.encaminhamento +
    prod.folha_objetivo_diario +
    prod.evolucao_diurna_cti +
    prod.evolucao_noturna_cti
  );
};
