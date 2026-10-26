/**
 * Helpers for matching the same person across data sources.
 *
 * The MOI officeholder list, the PRISO search results and the names parsed
 * out of declaration PDFs spell the same person differently: indigenous
 * names may or may not carry the romanised part, the middle dot comes in
 * several code points, and some characters have common variant forms
 * (啓/啟, 温/溫, ...). Everything that joins people by name should go
 * through `personMatchKey` so those differences never split one person
 * into two records.
 */

// Each group lists interchangeable characters; the first one is canonical.
const VARIANT_GROUPS: string[][] = [
  ['台', '臺'],
  ['啟', '啓'],
  ['溫', '温'],
  ['鳳', '鳯'],
  ['亙', '亘'],
  ['寶', '寳'],
  ['峰', '峯'],
  ['衛', '衞'],
  ['為', '爲'],
  ['群', '羣'],
  ['真', '眞'],
  ['裡', '裏'],
]

const CANONICAL_BY_CHAR = new Map<string, string>()
for (const group of VARIANT_GROUPS) {
  for (const char of group) CANONICAL_BY_CHAR.set(char, group[0])
}

// Middle dots, bullets, parentheses and dashes used inside names. NFKC
// already folds the full-width forms (．, （）) into ASCII before this runs.
const SEPARATOR_RE = /[·‧・•.()\-_/]/g
const LEADING_CJK_RE = /^[㐀-鿿○]+/

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[　\s]+/g, '')
    .trim()
}

export function foldVariantChars(value: string): string {
  return Array.from(value)
    .map(char => CANONICAL_BY_CHAR.get(char) ?? char)
    .join('')
}

/** Lossy form used only for comparisons: no whitespace, dots or variant chars. */
export function normalizeComparable(value: string): string {
  return foldVariantChars(normalizeText(value)).replace(SEPARATOR_RE, '')
}

/** Chinese part of a name with separators removed: 哈尼．噶照HaniKacaw → 哈尼噶照. */
export function extractChineseName(value: string): string | undefined {
  return normalizeComparable(value).match(LEADING_CJK_RE)?.[0]
}

/** Leading Chinese run before any separator: 哈尼．噶照HaniKacaw → 哈尼. */
export function leadingChineseName(value: string): string | undefined {
  return normalizeText(value).match(LEADING_CJK_RE)?.[0]
}

/**
 * Key that identifies one person within an organization regardless of how
 * the name was spelled by the source. Used by the index builder, the stale
 * PDF cleanup and the change/holding joins.
 */
export function personMatchKey(organization: string, name: string): string {
  const chineseName = extractChineseName(name) ?? normalizeComparable(name)
  return `${normalizeComparable(organization)}:${chineseName}`
}

/**
 * Spellings to try when a source does exact-character search (PRISO does):
 * the name itself plus every combination of known variant characters.
 */
export function nameVariants(name: string, limit = 16): string[] {
  let results = ['']
  for (const char of Array.from(name)) {
    const group = VARIANT_GROUPS.find(candidates => candidates.includes(char))
    const options = group ?? [char]
    const next: string[] = []
    for (const prefix of results) {
      for (const option of options) {
        if (next.length < limit) next.push(prefix + option)
      }
    }
    results = next
  }
  return Array.from(new Set([name, ...results]))
}
