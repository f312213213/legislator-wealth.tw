import type {
  CandidateAmountKey,
  CandidateCountKey,
  CandidateDeclaration,
} from "./types"

type CandidateAmounts = Pick<CandidateDeclaration, "amounts" | "derived">

interface CandidateAmountField {
  key: CandidateAmountKey
  label: string
  /** Shown only when someone declared a non-zero amount. */
  optional?: boolean
}

export const CANDIDATE_AMOUNT_FIELDS: CandidateAmountField[] = [
  { key: "deposits", label: "存款" },
  { key: "cash", label: "現金" },
  { key: "valuables", label: "珠寶、古董、字畫等" },
  { key: "virtualAssets", label: "虛擬資產", optional: true },
  { key: "claims", label: "債權" },
  { key: "investments", label: "事業投資" },
  { key: "debts", label: "債務" },
]

/** Declared securities that the stock/fund market value does not cover. */
export const CANDIDATE_SECURITIES_FIELDS: CandidateAmountField[] = [
  { key: "bondsTotal", label: "債券", optional: true },
  { key: "otherSecuritiesTotal", label: "其他有價證券", optional: true },
]

export const CANDIDATE_COUNT_FIELDS: {
  key: CandidateCountKey
  label: string
  unit: string
}[] = [
  { key: "land", label: "土地", unit: "筆" },
  { key: "buildings", label: "建物", unit: "筆" },
  { key: "vehicles", label: "汽車", unit: "輛" },
  { key: "insurance", label: "保險", unit: "筆" },
]

/** True when the printed total was blank and no line items were listed. */
export function isCandidateAmountUnfilled(
  candidate: CandidateAmounts,
  key: CandidateAmountKey
): boolean {
  return candidate.derived.includes(key) && candidate.amounts[key] === 0
}

export function getVisibleAmountFields(
  fields: CandidateAmountField[],
  candidates: Pick<CandidateDeclaration, "amounts">[]
): CandidateAmountField[] {
  return fields.filter(
    (field) =>
      !field.optional ||
      candidates.some((candidate) => (candidate.amounts[field.key] ?? 0) > 0)
  )
}

/** True when any of `keys` shows a ＊ (summed from line items, not left unfilled). */
export function hasCandidateSummedAmount(
  candidate: CandidateAmounts,
  keys: CandidateAmountKey[]
): boolean {
  return candidate.derived.some(
    (key) => keys.includes(key) && !isCandidateAmountUnfilled(candidate, key)
  )
}
