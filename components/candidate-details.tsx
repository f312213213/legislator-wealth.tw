import type { CandidateDetailTable } from "@/lib/types"
import { cn } from "@/lib/utils"

const NUMBER = /^-?[\d,]+(\.\d+)?$/

/** Right-align columns whose filled cells are all plain numbers (amounts, areas, units). */
function isNumericColumn(rows: string[][], index: number): boolean {
  const cells = rows.map((row) => row[index]).filter(Boolean)
  return cells.length > 0 && cells.every((cell) => NUMBER.test(cell))
}

/** Itemized declaration sections, cells exactly as printed in the text version. */
export function CandidateDetails({
  tables,
}: {
  tables: CandidateDetailTable[]
}) {
  return (
    <div className="space-y-8">
      {tables.map((table, tableIndex) => {
        const numeric = table.columns.map((_, index) =>
          isNumericColumn(table.rows, index)
        )
        return (
          <div key={tableIndex} className="space-y-2">
            <h3 className="text-sm font-bold">
              {table.title}
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                {table.rows.length} 筆
              </span>
            </h3>
            <div className="overflow-x-auto border-y">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {table.columns.map((column, index) => (
                      <th
                        key={index}
                        scope="col"
                        className={cn(
                          "px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground",
                          numeric[index] ? "text-right" : "text-left"
                        )}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, index) => (
                        <td
                          key={index}
                          className={cn(
                            "px-3 py-2 align-top",
                            numeric[index]
                              ? "text-right whitespace-nowrap tabular-nums"
                              : "min-w-24"
                          )}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
