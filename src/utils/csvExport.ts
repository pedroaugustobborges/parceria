import { format } from "date-fns";

/**
 * Cria e baixa um arquivo CSV
 */
export const downloadCSV = (
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void => {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Limpar o URL do blob
  URL.revokeObjectURL(url);
};
