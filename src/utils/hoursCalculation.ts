import { parseISO, differenceInMinutes, format } from "date-fns";
import { Acesso } from "../types/database.types";

export interface DailyHours {
  date: string;
  hours: number;
  firstEntry: string;
  lastExit: string;
  entriesCount: number;
  exitsCount: number;
}

/**
 * Calcula as horas trabalhadas em um dia específico
 * Considera primeira entrada e última saída
 */
export const calculateDailyHours = (
  accesses: Acesso[],
  dateStr: string,
  nextDayAccesses?: Acesso[]
): DailyHours => {
  const entries = accesses.filter((a) => a.sentido === "E");
  const exits = accesses.filter((a) => a.sentido === "S");

  let hours = 0;
  let firstEntry = "-";
  let lastExit = "-";

  if (entries.length > 0) {
    const firstEntryDate = parseISO(entries[0].data_acesso);
    firstEntry = format(firstEntryDate, "HH:mm");

    // Se há saída no mesmo dia
    if (exits.length > 0) {
      const lastExitDate = parseISO(exits[exits.length - 1].data_acesso);
      lastExit = format(lastExitDate, "HH:mm");

      if (lastExitDate > firstEntryDate) {
        const minutes = differenceInMinutes(lastExitDate, firstEntryDate);
        hours = minutes / 60;
      }
    }
    // Buscar saída no próximo dia
    else if (nextDayAccesses) {
      const nextDayExits = nextDayAccesses.filter((a) => a.sentido === "S");
      if (nextDayExits.length > 0) {
        const firstNextDayExit = parseISO(nextDayExits[0].data_acesso);
        lastExit =
          format(firstNextDayExit, "dd/MM") +
          " " +
          format(firstNextDayExit, "HH:mm");
        const minutes = differenceInMinutes(firstNextDayExit, firstEntryDate);
        hours = minutes / 60;
      }
    }
  }

  return {
    date: dateStr,
    hours: parseFloat(hours.toFixed(2)),
    firstEntry,
    lastExit,
    entriesCount: entries.length,
    exitsCount: exits.length,
  };
};

/**
 * Agrupa acessos por dia
 */
export const groupAccessesByDay = (
  accesses: Acesso[]
): Record<string, Acesso[]> => {
  return accesses.reduce((acc, access) => {
    const dateStr = format(parseISO(access.data_acesso), "yyyy-MM-dd");
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(access);
    return acc;
  }, {} as Record<string, Acesso[]>);
};

/**
 * Calcula horas escaladas de um plantão
 */
export const calculateScheduledHours = (
  entryTime: string,
  exitTime: string
): number => {
  try {
    const [entryHour, entryMin] = entryTime.split(":").map(Number);
    const [exitHour, exitMin] = exitTime.split(":").map(Number);

    let totalMinutes = exitHour * 60 + exitMin - (entryHour * 60 + entryMin);

    // Se negativo, o plantão atravessa meia-noite
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }

    return totalMinutes / 60;
  } catch (err) {
    console.error("Erro ao calcular horas escaladas:", err);
    return 0;
  }
};

/**
 * Constantes de tolerância
 */
export const PUNCTUALITY_TOLERANCE_MINUTES = 10;
