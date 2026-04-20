import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal } from "@/types/chart";

function render({ data, columns }: ChartRenderProps) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem dados para exibir
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="border bg-muted px-3 py-2 text-left font-semibold whitespace-nowrap sticky top-0"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={JSON.stringify(row)} className="hover:bg-muted/50 transition-colors">
              {columns.map((col) => (
                <td key={col} className="border px-3 py-1.5 tabular-nums">
                  {row[col] !== null && row[col] !== undefined
                    ? strVal(row[col])
                    : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TableChartModel: ChartModel = {
  type: "table",
  label: "Tabela",
  description: "Exibição tabular dos dados brutos",
  icon: "📋",
  minColumns: 1,
  render,
};
