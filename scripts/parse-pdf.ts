import fs from 'fs'
import path from 'path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { LegislatorDeclaration, ChangeDeclaration, LegislatorDocument } from '../lib/types'

async function extractText(filePath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const allLines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { str: string; x: number }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !(item as any).str.trim()) continue
      const y = Math.round((item as any).transform[5])
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ str: (item as any).str, x: Math.round((item as any).transform[4]) })
    }
    const sortedYs = [...rows.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const cells = rows.get(y)!.sort((a, b) => a.x - b.x)
      allLines.push(cells.map(c => c.str).join(' '))
    }
  }
  return allLines.join('\n')
}

const args = process.argv.slice(2)
let inputDir = './raw-pdfs'
let outputDir = './data/legislators'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) inputDir = args[i + 1]
  if (args[i] === '--output' && args[i + 1]) outputDir = args[i + 1]
}

function parseNumber(str: string): number {
  return parseInt(str.replace(/[,，\s]/g, ''), 10) || 0
}

function isBlank(text: string): boolean {
  return /本欄空白/.test(text)
}

function splitSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const sectionPattern = /[（(]\s*([一二三四五六七八九十]+)\s*[）)]/g
  const matches: { key: string; index: number; fullLength: number }[] = []
  let m: RegExpExecArray | null
  while ((m = sectionPattern.exec(text)) !== null) {
    matches.push({ key: m[1], index: m.index, fullLength: m[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].fullLength
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    sections[matches[i].key] = text.slice(start, end).trim()
  }
  return sections
}

function isChangeDeclaration(text: string): boolean {
  return /變\s*動\s*財\s*產\s*申\s*報\s*表/.test(text)
}

// ──────────────── Shared: number split fixes ────────────────

// Fix numbers split across PDF cells: "2,2 80" → "2,280"
function fixSplitCommaNumber(line: string): string {
  return line.replace(/(\d+,\d)\s+(\d{2,3})(?=\s|$)/g, '$1$2')
}

// Fix decimal split: "22.56 8 64.05" → "22.568 64.05"
function fixSplitDecimal(line: string): string {
  return line.replace(/([\d,]+\.\d+)\s+(\d)\s+([\d,]+\.)/g, '$1$2 $3')
}

// Fix split NAV: "7,000 3 6.01 252,070" → "7,000 36.01 252,070"
function fixSplitNav(line: string): string {
  return line.replace(/\s(\d)\s+(\d+\.\d+)\s/g, ' $1$2 ')
}

// Fix "40 .15" → "40.15" (split at decimal point)
function fixSplitDot(line: string): string {
  return line.replace(/(\d)\s+\.(\d)/g, '$1.$2')
}

// Fix "15.1 0 " → "15.10 " (trailing digit after incomplete decimal, only 1 decimal digit)
function fixSplitTrailingDecimal(line: string): string {
  return line.replace(/([\d,]+\.\d)\s+(\d)(?=\s)/g, '$1$2')
}

function fixLineSplits(line: string): string {
  let l = fixSplitCommaNumber(line)
  l = fixSplitDot(l)
  l = fixSplitDecimal(l)
  l = fixSplitNav(l)
  l = fixSplitTrailingDecimal(l)
  return l
}

// Name corrections for characters lost in PDF text extraction
const NAME_CORRECTIONS: Record<string, string> = {
  '陳秀': '陳秀寳',
}

function correctName(name: string): string {
  return NAME_CORRECTIONS[name] || name
}

// ──────────────── Asset Declaration Parsing ────────────────

function parseHeader(text: string): Partial<LegislatorDeclaration> {
  const result: Partial<LegislatorDeclaration> = {}
  // Name may be split across PDF cells: "顏 寬恒" for 顏寬恒
  const nameMatch = text.match(/申報人(?:姓名)?[：:\s]+([\u4e00-\u9fff][\u4e00-\u9fff\s]{0,6}?)(?=\s+服|\s*$)/)
  if (nameMatch) result.name = correctName(nameMatch[1].replace(/\s/g, ''))
  const orgLine = text.match(/1\.\s*(立法院|[^\s]+院)/)
  if (orgLine) result.organization = orgLine[1]
  const titleLine = text.match(/1\.\s*立法院\s+1\.\s*(立法委員|[^\s]+)/)
  if (titleLine) result.title = titleLine[1]
  if (!result.title) {
    if (text.match(/立法委員/)) result.title = '立法委員'
  }
  // Year may be split across PDF cells: "1 11 年" for ROC year 111
  const dateMatch = text.match(/申\s*報\s*日\s*(\d[\d\s]{0,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (dateMatch) {
    let year = parseInt(dateMatch[1].replace(/\s/g, ''))
    if (year < 1911) year += 1911
    result.declarationDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
  }
  const typeMatch = text.match(/申\s*報\s*類\s*別\s+(\S+)/)
  if (typeMatch) result.declarationType = typeMatch[1]
  const spouseMatch = text.match(/配偶\s+(\S+)/)
  if (spouseMatch && spouseMatch[1] !== '及' && spouseMatch[1] !== '無') {
    result.spouse = { relation: '配偶', name: spouseMatch[1] }
  }
  return result
}

// ──────────────── Stock Parsing ────────────────

function parseStocks(stockText: string): LegislatorDeclaration['securities']['stocks'] {
  const empty = { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['stocks']['items'] }
  if (!stockText || isBlank(stockText)) return empty

  const stockTotalMatch = stockText.match(/股票[（(]總價額[：:]\s*新臺幣\s*([\d,]+)\s*元[）)]/)
  const stockTotalNTD = stockTotalMatch ? parseNumber(stockTotalMatch[1]) : 0
  const items: typeof empty.items = []

  const lines = stockText.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]
    if (raw.match(/股票|名\s*稱|總\s*額|新臺幣總額|外\s*幣|票\s*面|監察院/)) continue
    if (raw.match(/^\s*$/)) continue

    const line = fixLineSplits(raw)

    // Pattern: Name Owner Shares ParValue NtdTotal
    const m = line.match(/^(.+?)\s+([\u4e00-\u9fff○]{2,4})\s+([\d,]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/)
    if (m) {
      items.push({
        name: m[1].trim(),
        owner: m[2],
        shares: parseNumber(m[3]),
        parValue: parseNumber(m[4]),
        ntdTotal: parseNumber(m[5]),
      })
      continue
    }
    // With currency: Name Owner Shares ParValue Currency NtdTotal
    const mc = line.match(/^(.+?)\s+([\u4e00-\u9fff○]{2,4})\s+([\d,]+)\s+([\d,.]+)\s+(\S+)\s+([\d,.]+)\s*$/)
    if (mc) {
      items.push({
        name: mc[1].trim(),
        owner: mc[2],
        shares: parseNumber(mc[3]),
        parValue: parseNumber(mc[4]),
        currency: mc[5],
        ntdTotal: parseNumber(mc[6]),
      })
    }
  }

  return { totalNTD: stockTotalNTD || items.reduce((s, i) => s + i.ntdTotal, 0), items }
}

// ──────────────── Fund Parsing (complete rewrite) ────────────────

const TRUSTEE_FULL_RE = /中\s*信\s*銀\s*行|台\s*北\s*富\s*邦|國\s*泰\s*證\s*券|元\s*大\s*證\s*券|富\s*邦\s*銀\s*行/
const TRUSTEE_ONLY_RE = /^(中信銀行信託部?|信託部?|部|分公司|台北富邦銀行敦北分行|國泰證券忠孝分公司|元大證券基隆分公司|元大證券基隆|富邦銀行)$/
const CURRENCY_RE = /美元|日圓|歐元|英鎊|新加坡幣|新臺幣|新台幣/

function isFundHeader(line: string): boolean {
  return /^3\.\s*基金|^基金受益|^票\s*面|^名\s*稱|^（單位|^總\s*額$|^新臺幣總額/.test(line.trim())
}

function isFundSkip(line: string): boolean {
  return /監察院公報/.test(line) || /^\s*$/.test(line)
}

function isTrusteeLine(line: string): boolean {
  const stripped = line.trim().replace(/\s/g, '')
  if (stripped.length === 0) return false
  return TRUSTEE_ONLY_RE.test(stripped)
}

// Try to extract name portion from a mixed name+trustee line.
// Returns the name part (may be empty string), or null if no trustee found.
function extractNameFromMixed(line: string): string | null {
  const trimmed = line.trim()
  // Check for trustee pattern in the middle/end of line
  const idx = trimmed.search(TRUSTEE_FULL_RE)
  if (idx > 0) {
    let name = trimmed.slice(0, idx).trim()
    name = name.replace(/[\s-]+$/, '') // strip trailing dash (column separator)
    return name.replace(/\s/g, '')
  }
  if (idx === 0) return '' // starts with trustee → no name

  // Check for trailing 部 or 分公司
  const stripped = trimmed.replace(/\s/g, '')
  if (stripped.length > 1 && (stripped.endsWith('部') || stripped.endsWith('分公司'))) {
    const name = stripped.replace(/部$/, '').replace(/分公司$/, '')
    return name.length > 0 ? name : ''
  }

  return null // no trustee found
}

// Check if a stripped line is a post-data name suffix (not a new entry start)
function isNameSuffix(stripped: string): boolean {
  // Closing parens, continuation chars
  if (/^[）)積配]/.test(stripped)) return true
  // 元） or 元) — closing a parenthetical (but NOT 元大... which starts a new fund name)
  if (/^元[）)]/.test(stripped)) return true
  // Opening paren patterns (currency/class annotations)
  if (/^[（(]/.test(stripped)) return true
  // Mid-name words that continue a fund name (not new fund starts)
  if (/^[增保科股小連源].*基金/.test(stripped)) return true
  if (/^50ETF/.test(stripped)) return true
  return false
}

// Try to match a fund data line: extract owner + numeric fields from end of line.
function tryMatchFundData(line: string): {
  prefix: string; owner: string; units: number; nav: number; currency?: string; ntdTotal: number
} | null {
  const fixed = fixLineSplits(line)

  // Match numeric tail: (units) (nav) [currency] (total)
  const tailRe = /([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(?:(美元|日圓|歐元|英鎊|新加坡幣|新臺幣|新台幣)\s+)?([\d,]+)\s*$/
  const tm = fixed.match(tailRe)
  if (!tm) return null

  const ntdTotal = parseNumber(tm[4])
  if (ntdTotal < 50) return null

  // Extract text before the numeric tail
  let beforeTail = fixed.slice(0, tm.index!).trim()

  // Remove trustee text between owner and numbers
  beforeTail = beforeTail
    .replace(/中\s*信\s*銀\s*行\s*信\s*託\s*部?/g, '')
    .replace(/元\s*大\s*證\s*券\s*基\s*隆/g, '')
    .replace(/台\s*北\s*富\s*邦\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/國\s*泰\s*證\s*券\s*忠?\s*孝?[\s\u4e00-\u9fff]*/g, '')
    .replace(/富\s*邦\s*銀\s*行/g, '')
    .trim()

  // Find owner: last CJK word (2-4 chars, including ○ for redacted names)
  const ownerRe = /([\u4e00-\u9fff○]{2,4})\s*$/
  const om = beforeTail.match(ownerRe)
  if (!om) return null

  const owner = om[1]
  const prefix = beforeTail.slice(0, om.index!).trim()

  return {
    prefix,
    owner,
    units: parseFloat(tm[1].replace(/,/g, '')),
    nav: parseFloat(tm[2].replace(/,/g, '')),
    currency: tm[3] as string | undefined,
    ntdTotal,
  }
}

function parseFunds(fundText: string): LegislatorDeclaration['securities']['funds'] {
  const empty = { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['funds']['items'] }
  if (!fundText || isBlank(fundText)) return empty

  const fundTotalMatch = fundText.match(/總價額[：:]\s*新臺幣\s*([\d,]+)\s*元/)
  const fundTotalNTD = fundTotalMatch ? parseNumber(fundTotalMatch[1]) : 0

  const lines = fundText.split('\n')
  const entries: { name: string; owner: string; trustee: string; units: number; nav: number; currency?: string; ntdTotal: number }[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip headers and noise
    if (isFundHeader(line) || isFundSkip(line)) { i++; continue }
    if (isTrusteeLine(line)) { i++; continue }

    // Phase 1: Collect pre-data name fragments until we find a data line
    const nameBuf: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (isFundHeader(l) || isFundSkip(l)) { i++; continue }

      // Try data line match
      const dm = tryMatchFundData(l)
      if (dm) break

      // Trustee-only line
      if (isTrusteeLine(l)) { i++; continue }

      // Mixed name+trustee
      const np = extractNameFromMixed(l)
      if (np !== null) {
        if (np.length > 0) nameBuf.push(np)
        i++; continue
      }

      // Pure name fragment
      const stripped = l.trim().replace(/\s/g, '')
      if (stripped.length > 0) nameBuf.push(stripped)
      i++
    }

    if (i >= lines.length) break

    // Phase 2: Process the data line
    const dm = tryMatchFundData(lines[i])!
    i++

    // Clean prefix from the data line
    let namePrefix = dm.prefix.replace(/\s/g, '')
    // Remove any remaining trustee fragments
    namePrefix = namePrefix
      .replace(/中信銀行信託部?/g, '')
      .replace(/元大證券基隆/g, '')
      .replace(/台北富邦銀行[\u4e00-\u9fff]*/g, '')
      .replace(/國泰證券忠孝[\u4e00-\u9fff]*/g, '')
      .replace(/-$/, '')
      .trim()

    const allNameFrags = [...nameBuf]
    if (namePrefix) allNameFrags.push(namePrefix)

    // Phase 3: Collect post-data suffix lines
    while (i < lines.length) {
      const l = lines[i]
      if (isFundHeader(l) || isFundSkip(l)) { i++; continue }
      if (isTrusteeLine(l)) { i++; continue }

      // If this line is itself a data line, stop collecting suffixes
      if (tryMatchFundData(l)) break

      // Check for mixed suffix+trustee
      const np = extractNameFromMixed(l)
      if (np !== null) {
        if (np.length > 0) {
          const npClean = np
          if (isNameSuffix(npClean) || npClean.length <= 2) {
            allNameFrags.push(npClean)
            i++; continue
          }
          // Check if name is incomplete — needs this fragment
          const nameSoFar = allNameFrags.join('')
          if (!nameSoFar.match(/基金|ETF|股息/) && npClean.match(/基金|ETF|股息/)) {
            allNameFrags.push(npClean)
            i++; continue
          }
          // Check unbalanced parens
          const opens = (nameSoFar.match(/[（(]/g) || []).length
          const closes = (nameSoFar.match(/[）)]/g) || []).length
          if (opens > closes) {
            allNameFrags.push(npClean)
            i++; continue
          }
          break // New entry starts
        }
        i++; continue
      }

      // Pure line — check if it's a suffix
      const stripped = l.trim().replace(/\s/g, '')
      if (stripped.length === 0) { i++; continue }

      if (isNameSuffix(stripped)) {
        allNameFrags.push(stripped)
        i++; continue
      }

      // Very short fragment (1-2 chars) immediately after data → likely continuation
      if (stripped.length <= 2) {
        allNameFrags.push(stripped)
        i++; continue
      }

      // Check if name is incomplete (missing fund type keyword)
      const nameSoFar = allNameFrags.join('')
      if (!nameSoFar.match(/基金|ETF|股息/) && stripped.match(/基金|ETF|股息/)) {
        allNameFrags.push(stripped)
        i++; continue
      }

      // Check unbalanced parentheses
      const opens = (nameSoFar.match(/[（(]/g) || []).length
      const closes = (nameSoFar.match(/[）)]/g) || []).length
      if (opens > closes && stripped.match(/[）)]/)) {
        allNameFrags.push(stripped)
        i++; continue
      }

      break // Not a suffix — next entry starts
    }

    // Build final name
    const fullName = allNameFrags.join('')

    entries.push({
      name: fullName,
      owner: dm.owner,
      trustee: '',
      units: dm.units,
      nav: dm.nav,
      currency: dm.currency,
      ntdTotal: dm.ntdTotal,
    })
  }

  return {
    totalNTD: fundTotalNTD || entries.reduce((s, e) => s + e.ntdTotal, 0),
    items: entries,
  }
}

// ──────────────── Securities (main) ────────────────

function parseSecurities(text: string): LegislatorDeclaration['securities'] {
  const empty = {
    totalNTD: 0,
    stocks: { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['stocks']['items'] },
    funds: { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['funds']['items'] },
  }
  if (!text.match(/1\.\s*股票/) && isBlank(text)) return empty

  const totalMatch = text.match(/有價證券[（(]總價額[：:]\s*新臺幣\s*([\d,]+)\s*元[）)]/)
  const totalNTD = totalMatch ? parseNumber(totalMatch[1]) : 0

  // Split into sub-sections
  const stockIdx = text.search(/1\.\s*股票/)
  const bondIdx = text.search(/2\.\s*債券/)
  const fundIdx = text.search(/3\.\s*基金/)
  const otherIdx = text.search(/4\.\s*其他/)

  const indices = [
    { key: 'stock', idx: stockIdx },
    { key: 'bond', idx: bondIdx },
    { key: 'fund', idx: fundIdx },
    { key: 'other', idx: otherIdx },
  ].filter(x => x.idx >= 0).sort((a, b) => a.idx - b.idx)

  function getSubSection(key: string): string {
    const i = indices.findIndex(x => x.key === key)
    if (i < 0) return ''
    const start = indices[i].idx
    const end = i + 1 < indices.length ? indices[i + 1].idx : text.length
    return text.slice(start, end)
  }

  const stocks = parseStocks(getSubSection('stock'))
  const funds = parseFunds(getSubSection('fund'))

  const computedTotal = stocks.totalNTD + funds.totalNTD

  return {
    totalNTD: totalNTD || computedTotal,
    stocks,
    funds,
  }
}

function parseNotes(text: string): string | undefined {
  if (isBlank(text)) return undefined
  // Strip closing signature block that appears at the end of every PDF
  let cleaned = text
    .replace(/此\s*致[\s\S]*$/, '')
    .replace(/以上資料[\s\S]*$/, '')
    .replace(/監\s*察\s*院[\s\S]*$/, '')
    .replace(/申報人[\s\S]*$/, '')
    .trim()
  // Strip leading markers like "備 註", "備註"
  cleaned = cleaned.replace(/^備\s*註\s*/, '').trim()
  return cleaned || undefined
}

async function parseAssetDeclaration(text: string): Promise<LegislatorDeclaration> {
  const sections = splitSections(text)
  const firstSectionIdx = text.search(/[（(]\s*[二三四五六七八九十]+\s*[）)]/)
  const headerText = firstSectionIdx > 0 ? text.slice(0, firstSectionIdx) : text.slice(0, 500)
  const header = parseHeader(headerText)

  return {
    type: 'declaration',
    name: header.name || 'Unknown',
    organization: header.organization || '立法院',
    title: header.title || '立法委員',
    declarationDate: header.declarationDate || '',
    declarationType: header.declarationType || '',
    spouse: header.spouse,
    minorChildren: [],
    securities: parseSecurities(sections['八'] || ''),
    notes: parseNotes(sections['十三'] || ''),
  }
}

// ──────────────── Change Declaration Parsing ────────────────

function parseChangeHeader(text: string): Partial<ChangeDeclaration> {
  const result: Partial<ChangeDeclaration> = {}
  const nameMatch = text.match(/申報人(?:姓名)?[：:\s]+([\u4e00-\u9fff][\u4e00-\u9fff\s]{0,6}?)(?=\s+服|\s*$)/)
  if (nameMatch) result.name = correctName(nameMatch[1].replace(/\s/g, ''))
  const orgLine = text.match(/1\.\s*(立法院|[^\s]+院)/)
  if (orgLine) result.organization = orgLine[1]
  if (text.match(/立法委員/)) result.title = '立法委員'
  // Year may be split across PDF cells: "1 05 年" for ROC year 105
  const dateMatch = text.match(/申\s*報\s*日\s*(\d[\d\s]{0,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (dateMatch) {
    let year = parseInt(dateMatch[1].replace(/\s/g, ''))
    if (year < 1911) year += 1911
    result.declarationDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
  }
  const fromMatch = text.match(/前次申報日期\s*民?國?\s*(\d[\d\s]{0,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  const toMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*止/)
  const toYearMatch = text.match(/本次.*?(\d[\d\s]{0,4})\s*年/)
  if (fromMatch && toMatch && toYearMatch) {
    let fromYear = parseInt(fromMatch[1].replace(/\s/g, '')); if (fromYear < 1911) fromYear += 1911
    let toYear = parseInt(toYearMatch[1].replace(/\s/g, '')); if (toYear < 1911) toYear += 1911
    result.changePeriod = {
      from: `${fromYear}-${fromMatch[2].padStart(2, '0')}-${fromMatch[3].padStart(2, '0')}`,
      to: `${toYear}-${toMatch[1].padStart(2, '0')}-${toMatch[2].padStart(2, '0')}`,
    }
  }
  const spouseMatch = text.match(/配偶\s+(\S+)/)
  if (spouseMatch && spouseMatch[1] !== '及' && spouseMatch[1] !== '無') {
    result.spouse = { relation: '配偶', name: spouseMatch[1] }
  }
  return result
}

function extractDateFromContext(lines: string[], idx: number): string {
  for (let j = Math.max(0, idx - 1); j <= Math.min(lines.length - 1, idx + 1); j++) {
    const combined = lines.slice(Math.max(0, j - 1), j + 2).join(' ')
    const m = combined.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (m) {
      let year = parseInt(m[1]); if (year < 1911) year += 1911
      return `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    }
  }
  return ''
}

// Change declaration stock parsing — completely rewritten for complex PDFs.
// Each entry has a "numbers line" (shares price total) as anchor.
// Simple entries: numbers line + info line (name broker owner date reason)
// Complex entries: broker+reason line, numbers line, info line (name owner date), continuation line
function parseChangeStocks(text: string): ChangeDeclaration['stocks'] {
  if (isBlank(text)) return undefined
  const rawLines = text.split('\n')
  const items: NonNullable<ChangeDeclaration['stocks']> = []

  // Numbers line regex: shares price total (all numeric, after split fixes)
  const numbersRe = /^([\d,]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    // Skip headers and page markers
    if (raw.match(/名\s*稱|證\s*券\s*交|變\s*動\s*時|變\s*動\s*原|總\s*額|國內上市|監察院公報/)) continue
    if (raw.match(/^\s*$/)) continue

    const fixed = fixLineSplits(raw)
    const nm = fixed.match(numbersRe)
    if (!nm) continue

    const shares = parseNumber(nm[1])
    if (shares === 0) continue
    const changePrice = parseFloat(nm[2].replace(/,/g, ''))
    const total = parseFloat(nm[3].replace(/,/g, ''))

    // Info line: the next non-empty line after numbers
    let infoIdx = i + 1
    while (infoIdx < rawLines.length && rawLines[infoIdx].match(/^\s*$/)) infoIdx++
    if (infoIdx >= rawLines.length) continue
    const infoLine = rawLines[infoIdx]

    // Parse info line: stockName [broker] owner date [reason]
    let stockName = ''
    let broker = ''
    let owner = ''
    let dateStr = ''
    let reason = ''

    // Find date in info line
    const dateMatch = infoLine.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (!dateMatch) continue

    let year = parseInt(dateMatch[1])
    if (year < 1911) year += 1911
    dateStr = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`

    // Owner: CJK word (2-4 chars including ○) right before the date
    const ownerMatch = infoLine.match(/([\u4e00-\u9fff○]{2,4})\s+\d{2,4}\s*年/)
    if (ownerMatch) owner = ownerMatch[1]

    // Everything before owner is stockName + [broker]
    const ownerIdx = infoLine.indexOf(ownerMatch![0])
    const beforeOwner = infoLine.slice(0, ownerIdx).trim()
    const tokens = beforeOwner.split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      stockName = tokens[0]
      if (tokens.length > 1) {
        broker = tokens.slice(1).join('').replace(/\s/g, '')
      }
    }

    // Reason: after the date on the info line
    const dateEnd = infoLine.indexOf(dateMatch[0]) + dateMatch[0].length
    const afterDate = infoLine.slice(dateEnd).trim()
    if (afterDate) reason = afterDate.replace(/\s/g, '')

    // For complex entries (存券匯撥/減資轉入 etc.), broker+reason is on the line BEFORE numbers
    if (!reason) {
      // Look at the line before the numbers line
      let prevIdx = i - 1
      while (prevIdx >= 0 && rawLines[prevIdx].match(/^\s*$/)) prevIdx--
      if (prevIdx >= 0) {
        const prevLine = rawLines[prevIdx]
        const prevStripped = prevLine.replace(/\s/g, '')
        // Check for known complex reason patterns
        const reasonInPrev = prevStripped.match(/(存券匯撥|減資轉入|減資轉出|買進|賣出|配股|轉讓|贈與)/)
        if (reasonInPrev) {
          // Extract broker from the part before the reason
          const reasonStart = prevLine.search(/存\s*券\s*匯\s*撥|減\s*資\s*轉\s*入|減\s*資\s*轉\s*出|買\s*進|賣\s*出|配\s*股|轉\s*讓|贈\s*與/)
          if (reasonStart > 0) {
            broker = prevLine.slice(0, reasonStart).trim().replace(/\s/g, '')
          }
          reason = reasonInPrev[1]

          // Check continuation line (after info line) for (存)/(提) suffix and broker continuation
          let contIdx = infoIdx + 1
          while (contIdx < rawLines.length && rawLines[contIdx].match(/^\s*$/)) contIdx++
          if (contIdx < rawLines.length) {
            const contLine = rawLines[contIdx]
            const contStripped = contLine.replace(/\s/g, '')
            // Extract (存) or (提) suffix
            const suffixMatch = contStripped.match(/\(([存提])\)/)
            if (suffixMatch) reason += `(${suffixMatch[1]})`
            // Extract broker continuation (e.g., "司" to complete "分公司")
            const brokerCont = contStripped.replace(/\([存提]\)/, '').trim()
            if (brokerCont && brokerCont.match(/^[\u4e00-\u9fff]+$/) && brokerCont.length <= 3) {
              broker += brokerCont
            }
          }
        }
      }
    }

    if (stockName) {
      items.push({
        name: stockName,
        broker,
        owner,
        shares,
        changePrice,
        changeDate: dateStr,
        changeReason: reason,
        total,
      })
    }
  }

  return items.length > 0 ? items : undefined
}

async function parseChangeDeclarationDoc(text: string): Promise<ChangeDeclaration> {
  const sections = splitSections(text)
  const firstSectionIdx = text.search(/[（(]\s*[二三四五六七八九十]+\s*[）)]/)
  const headerText = firstSectionIdx > 0 ? text.slice(0, firstSectionIdx) : text.slice(0, 500)
  const header = parseChangeHeader(headerText)
  return {
    type: 'change',
    name: header.name || 'Unknown',
    organization: header.organization || '立法院',
    title: header.title || '立法委員',
    declarationDate: header.declarationDate || '',
    changePeriod: header.changePeriod || { from: '', to: '' },
    spouse: header.spouse,
    minorChildren: [],
    stocks: parseChangeStocks(sections['三'] || ''),
    notes: parseNotes(sections['四'] || sections['十三'] || ''),
  }
}

// ──────────────── Main ────────────────

async function parsePDF(filePath: string): Promise<LegislatorDocument> {
  const text = await extractText(filePath)
  if (isChangeDeclaration(text)) {
    console.log('  [type: change declaration]')
    return parseChangeDeclarationDoc(text)
  } else {
    console.log('  [type: asset declaration]')
    return parseAssetDeclaration(text)
  }
}

async function main() {
  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`)
    process.exit(1)
  }
  fs.mkdirSync(outputDir, { recursive: true })
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.pdf'))
  if (files.length === 0) {
    console.log('No PDF files found in', inputDir)
    return
  }
  console.log(`Found ${files.length} PDF file(s)`)
  for (const file of files) {
    console.log(`Parsing: ${file}`)
    try {
      const doc = await parsePDF(path.join(inputDir, file))
      const datePart = doc.declarationDate || file.replace('.pdf', '')
      const src = file.replace('.pdf', '')
      let outFile: string
      if (doc.type === 'change') {
        outFile = `${doc.name}-change-${datePart}-${src}.json`
      } else {
        outFile = `${doc.name}-${datePart}-${src}.json`
      }
      fs.writeFileSync(path.join(outputDir, outFile), JSON.stringify(doc, null, 2), 'utf-8')
      console.log(`  → ${outFile}`)
    } catch (err) {
      console.error(`  Error parsing ${file}:`, err)
    }
  }
  console.log('Done!')
}

main()
