import { CurrencyDisplay } from "@/components/currency-display"
import { isCandidateAmountUnfilled } from "@/lib/candidate-fields"
import type { CandidateAmountKey, CandidateDeclaration } from "@/lib/types"

/** Declared amount with markers for blank totals (＊ = summed from line items). */
export function CandidateAmount({
  candidate,
  field,
  className,
}: {
  candidate: Pick<CandidateDeclaration, "amounts" | "derived">
  field: CandidateAmountKey
  className?: string
}) {
  if (isCandidateAmountUnfilled(candidate, field)) {
    return <span className="text-muted-foreground">未填</span>
  }

  const derived = candidate.derived.includes(field)
  return (
    <span className="whitespace-nowrap">
      <CurrencyDisplay
        amount={candidate.amounts[field]}
        className={className}
      />
      {derived && (
        <abbr
          title="原件總額欄空白，由明細加總"
          className="ml-0.5 text-muted-foreground no-underline"
        >
          ＊
        </abbr>
      )}
    </span>
  )
}
