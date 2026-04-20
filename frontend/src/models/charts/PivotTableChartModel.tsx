import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal } from "@/types/chart";

function render({ data, xField, yField, columns }: ChartRenderProps) {
  // Pivot: rows = unique xField, cols = unique yField (or other cat col),
  // values = remaining numeric column
  const rowValues = [...new Set(data.map((d) => strVal(d[xField])))];
  const colValues = [...new Set(data.map((d) => strVal(d[yField])))];
  const valueField = columns.find((c) => c !== xField && c !== yField);

  const lookup: Record<string, Record<string, unknown>> = {};
  data.forEach((d) => {
    const row = strVal(d[xField]);
    const col = strVal(d[yField]);
    if (!lookup[row]) lookup[row] = {};
    lookup[row][col] = valueField ? d[valueField] : 1;
  });

  const colTotals: Record<string, number> = {};
  colValues.forEach((col) => {
    colTotals[col] = rowValues.reduce(
      (s, row) => s + (Number(lookup[row]?.[col]) || 0),
      0
    );
  });

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="border bg-muted px-3 py-2 text-left font-semibold sticky top-0 z-10">
              {xField} / {yField}
            </th>
            {colValues.map((col) => (
              <th
                key={col}
                className="border bg-muted px-3 py-2 text-center font-semibold whitespace-nowrap sticky top-0 z-10"
              >
                {col}
              </th>
            ))}
            <th className="border bg-primary/10 px-3 py-2 text-center font-semibold sticky top-0 z-10">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rowValues.map((row) => {
            const rowTotal = colValues.reduce(
              (s, col) => s + (Number(lookup[row]?.[col]) || 0),
              0
            );
            return (
              <tr key={row} className="hover:bg-muted/50 transition-colors">
                <td className="border px-3 py-2 font-medium">{row}</td>
                {colValues.map((col) => (
                  <td key={col} className="border px-3 py-2 text-center tabular-nums">
                    {lookup[row]?.[col] === undefined
                      ? "—"
                      : Number(lookup[row][col]).toLocaleString("pt-BR")
                    }
                  </td>
                ))}
                <td className="border px-3 py-2 text-center font-semibold bg-primary/5 tabular-nums">
                  {rowTotal.toLocaleString("pt-BR")}
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold bg-muted">
            <td className="border px-3 py-2">Total</td>
            {colValues.map((col) => (
              <td key={col} className="border px-3 py-2 text-center tabular-nums">
                {colTotals[col].toLocaleString("pt-BR")}
              </td>
            ))}
            <td className="border px-3 py-2 text-center tabular-nums bg-primary/10">
              {Object.values(colTotals)
                .reduce((s, v) => s + v, 0)
                .toLocaleString("pt-BR")}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const PivotTableChartModel: ChartModel = {
  type: "pivottable",
  label: "Tabela Dinâmica",
  description: "Cruzamento e agregação por dimensões",
  icon: "🔄",
  minColumns: 2,
  render,
};
