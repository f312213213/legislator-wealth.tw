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

function parseInteger(str: string): number {
  return parseInt(str.replace(/[,，\s]/g, ''), 10) || 0
}

function parseDecimal(str: string): number {
  return parseFloat(str.replace(/[,，\s]/g, '')) || 0
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
  return line.replace(/(\d+,\d)\s+(\d{2,3})(?=\s|\.|$)/g, '$1$2')
}

// Fix decimal split: "22.56 8 64.05" → "22.568 64.05"
function fixSplitDecimal(line: string): string {
  return line.replace(/([\d,]+\.\d+)\s+(\d)\s+([\d,]+\.)/g, '$1$2 $3')
}

// Fix split NAV: "7,000 3 6.01 252,070" → "7,000 36.01 252,070"
// Also handles 2-digit prefix: "11 7.44 28.55" → "117.44 28.55"
function fixSplitNav(line: string): string {
  // Single digit prefix
  line = line.replace(/\s(\d)\s+(\d+\.\d+)\s/g, ' $1$2 ')
  // Two digit prefix (e.g., "11 7.44" where 117.44 was split)
  line = line.replace(/\s(\d{2})\s+(\d\.\d+)\s/g, ' $1$2 ')
  return line
}

// Fix "40 .15" → "40.15" (split at decimal point)
function fixSplitDot(line: string): string {
  return line.replace(/(\d)\s+\.(\d)/g, '$1.$2')
}

// Fix "248,290. 46" → "248,290.46"
function fixSpaceAfterDot(line: string): string {
  return line.replace(/(\d\.)\s+(\d+)/g, '$1$2')
}

// Fix "15.1 0 " → "15.10 " (trailing digit after incomplete decimal, only 1 decimal digit)
function fixSplitTrailingDecimal(line: string): string {
  return line.replace(/([\d,]+\.\d)\s+(\d)(?=\s)/g, '$1$2')
}

// Fix "1, 000" → "1,000" (space after comma in number)
function fixSpaceAfterComma(line: string): string {
  return line.replace(/(\d),\s+(\d{3})/g, '$1,$2')
}

// Fix "92 ,200" → "92,200" (space before comma in number)
function fixSpaceBeforeComma(line: string): string {
  return line.replace(/(\d)\s+,(\d{3})/g, '$1,$2')
}

function fixLineSplits(line: string): string {
  let l = fixSpaceAfterComma(line)
  l = fixSpaceBeforeComma(l)
  l = fixSplitCommaNumber(l)
  l = fixSplitDot(l)
  l = fixSpaceAfterDot(l)
  l = fixSplitDecimal(l)
  l = fixSplitNav(l)
  l = fixSplitTrailingDecimal(l)
  return l
}

function stripCorrectionMarkers(text: string): string {
  return text.replace(/\d*[ \t]*★[ \t]*/g, '')
}

function parseRocDate(yearRaw: string, monthRaw: string, dayRaw: string): string {
  let year = parseInt(yearRaw.replace(/\s/g, ''), 10)
  if (year < 1911) year += 1911
  const month = monthRaw.replace(/\s/g, '')
  const day = dayRaw.replace(/\s/g, '')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseDateFromLine(line: string): string | undefined {
  const dateMatch = line.match(/(\d[\d\s]{0,4})\s*年\s*(\d[\d\s]{0,2})\s*月\s*(\d[\d\s]{0,2})\s*日/)
  return dateMatch ? parseRocDate(dateMatch[1], dateMatch[2], dateMatch[3]) : undefined
}

function findDeclarationDate(text: string): string | undefined {
  const inlineMatch = text.match(/申\s*報\s*日(?!\s*期)\s*(\d[\d\s]{0,4})\s*年\s*(\d[\d\s]{0,2})\s*月\s*(\d[\d\s]{0,2})\s*日/)
  if (inlineMatch) return parseRocDate(inlineMatch[1], inlineMatch[2], inlineMatch[3])

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/申\s*報\s*日(?!\s*期)/.test(lines[i])) continue
    const sameLineMatch = lines[i].match(/申\s*報\s*日(?!\s*期)\s*(\d[\d\s]{0,4})\s*年\s*(\d[\d\s]{0,2})\s*月\s*(\d[\d\s]{0,2})\s*日/)
    const sameLine = sameLineMatch ? parseRocDate(sameLineMatch[1], sameLineMatch[2], sameLineMatch[3]) : undefined
    if (sameLine) return sameLine

    for (const offset of [-1, 1]) {
      const candidate = lines[i + offset]
      if (!candidate) continue
      const found = parseDateFromLine(candidate)
      if (found) return found
    }
  }

  return undefined
}

function findDeclarationType(text: string): string | undefined {
  const typeRe = /(定期申報|就職申報|卸任申報|代理申報|兼任申報|更正申報)/
  const inlineMatch = text.match(/申\s*報\s*類\s*別\s+([^\s\n]+)/)
  if (inlineMatch && typeRe.test(inlineMatch[1])) return inlineMatch[1].match(typeRe)![1]

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/申\s*報\s*類\s*別/.test(lines[i])) continue
    const sameLine = lines[i].match(typeRe)
    if (sameLine) return sameLine[1]

    for (const offset of [-1, 1]) {
      const candidate = lines[i + offset]
      if (!candidate) continue
      const found = candidate.match(typeRe)
      if (found) return found[1]
    }
  }

  return undefined
}

function isLikelyPersonName(name: string): boolean {
  return /^[\u4e00-\u9fff○]{2,4}$/.test(name)
    && !/服務機關|職稱|申報|姓名|配偶|子女|立法院|有限公司|有限|股份|公司|信託|分行|銀行|證券|基金|股票|能源/.test(name)
}

// Name corrections for characters lost in PDF text extraction
const NAME_CORRECTIONS: Record<string, string> = {
  '陳秀': '陳秀寳',
}

function correctName(name: string): string {
  return NAME_CORRECTIONS[name] || name
}

function findHeaderName(text: string): string | undefined {
  const inlineMatch = text.match(/申\s*報\s*人(?:\s*姓\s*名)?[：:\s]+([\u4e00-\u9fff○][\u4e00-\u9fff○\s]{0,6}?)(?=\s+[服職]|\s*\n|\s*$)/)
  if (inlineMatch) {
    const name = inlineMatch[1].replace(/\s/g, '')
    if (isLikelyPersonName(name)) return correctName(name)
  }

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/申\s*報\s*人(?:\s*姓\s*名)?/.test(lines[i])) continue

    const afterLabel = lines[i]
      .replace(/申\s*報\s*人(?:\s*姓\s*名)?[：:\s]*/, '')
      .replace(/服\s*務\s*機\s*關[\s\S]*$/, '')
      .trim()
      .replace(/\s/g, '')
    if (isLikelyPersonName(afterLabel)) return correctName(afterLabel)

    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      const previous = lines[j].trim().replace(/\s/g, '')
      if (isLikelyPersonName(previous)) return correctName(previous)
    }
  }

  return undefined
}

// ──────────────── Asset Declaration Parsing ────────────────

function parseHeader(text: string): Partial<LegislatorDeclaration> {
  const result: Partial<LegislatorDeclaration> = {}
  // Name may be split across PDF cells: "顏 寬恒" for 顏寬恒
  // "申報 人" can also be split in older PDFs
  const name = findHeaderName(text)
  if (name) result.name = name
  const orgLine = text.match(/1\.\s*(立法院|[^\s]+院)/)
  if (orgLine) result.organization = orgLine[1]
  const titleLine = text.match(/1\.\s*立法院\s+1\.\s*(立法委員|[^\s]+)/)
  if (titleLine) result.title = titleLine[1]
  if (!result.title) {
    if (text.match(/立法委員/)) result.title = '立法委員'
  }
  // Year/month/day may be split across PDF cells: "1 02 年 1 2 月 3 0 日"
  const declarationDate = findDeclarationDate(text)
  if (declarationDate) result.declarationDate = declarationDate
  const declarationType = findDeclarationType(text)
  if (declarationType) result.declarationType = declarationType
  const spouseMatch = text.match(/配偶\s+(\S+)/)
  if (spouseMatch && spouseMatch[1] !== '及' && spouseMatch[1] !== '無') {
    result.spouse = { relation: '配偶', name: spouseMatch[1] }
  }
  return result
}

// ──────────────── Stock Parsing ────────────────

const CURRENCY_PATTERN = '美元|日圓|歐元|英鎊|新加坡幣|新臺幣|新台幣|港幣|澳幣|南非幣|紐西蘭幣|人民幣'
const STOCK_TAIL_RE = new RegExp(`([\\d,]+)\\s+([\\d,.]+)\\s+(?:(${CURRENCY_PATTERN})\\s+)?([\\d,]+(?:\\.\\d+)?)\\s*$`)

function isStockHeader(line: string): boolean {
  const trimmed = line.trim()
  return /^1\.\s*股票/.test(trimmed)
    || /^名\s*稱/.test(trimmed)
    || /^總\s*額$/.test(trimmed)
    || /^新臺幣總額/.test(trimmed)
    || /^票\s*面/.test(trimmed)
    || /^外\s*幣/.test(trimmed)
    || /監察院公報/.test(trimmed)
}

function hasStockTail(line: string): boolean {
  return STOCK_TAIL_RE.test(fixLineSplits(line).trim())
}

function cleanStockName(name: string): string {
  let cleaned = name.replace(/\s+/g, ' ').trim()
  let previous = ''
  while (previous !== cleaned) {
    previous = cleaned
    cleaned = cleaned.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
  }
  return cleaned
    .replace(/\s*([「」：，、（）()])\s*/g, '$1')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function splitStockNameOwner(parts: string[]): { name: string; owner: string } | null {
  const cleanedParts = parts.map(p => p.trim()).filter(Boolean)
  for (let i = cleanedParts.length - 1; i >= 0; i--) {
    const line = cleanedParts[i]
    const ownerOnly = line.replace(/\s/g, '')
    if (isLikelyPersonName(ownerOnly)) {
      const nameParts = [...cleanedParts.slice(0, i), ...cleanedParts.slice(i + 1)]
      const name = cleanStockName(nameParts.join(''))
      return name ? { name, owner: ownerOnly } : null
    }

    const ownerMatch = line.match(/^(.+?)\s+([\u4e00-\u9fff○][\u4e00-\u9fff○\s]{1,6})$/)
    if (!ownerMatch) continue
    const owner = ownerMatch[2].replace(/\s/g, '')
    if (!isLikelyPersonName(owner)) continue

    const nameParts = [
      ...cleanedParts.slice(0, i),
      ownerMatch[1],
      ...cleanedParts.slice(i + 1),
    ]
    const name = cleanStockName(nameParts.join(''))
    return name ? { name, owner } : null
  }
  return null
}

function shouldAppendStockSuffix(currentName: string | undefined, nextLine: string, hasOwner: boolean): boolean {
  const stripped = nextLine.trim().replace(/\s/g, '')
  if (!stripped) return false
  if (!hasOwner) return true
  if (isLikelyPersonName(stripped)) return false

  const name = currentName || ''
  const openQuotes = (name.match(/「/g) || []).length
  const closeQuotes = (name.match(/」/g) || []).length
  const openParens = (name.match(/[（(]/g) || []).length
  const closeParens = (name.match(/[）)]/g) || []).length
  if (openQuotes > closeQuotes || openParens > closeParens) return true

  return /^(有限公司|公司|司|託[」)]?|信託[」)]?|因[:：]?|非國內|上[櫃市]股票|[）)])/.test(stripped)
}

function parseStocks(stockText: string): LegislatorDeclaration['securities']['stocks'] {
  const empty = { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['stocks']['items'] }
  if (!stockText || isBlank(stockText)) return empty

  const stockTotalMatch = stockText.match(/股票[（(]總價額[：:]\s*新臺幣\s*([\d,]+)\s*元[）)]/)
  const stockTotalNTD = stockTotalMatch ? parseInteger(stockTotalMatch[1]) : 0
  const items: typeof empty.items = []

  const lines = stockText.split('\n')
  const pendingText: string[] = []

  for (let li = 0; li < lines.length; li++) {
    const line = fixLineSplits(lines[li]).trim()
    if (!line || isStockHeader(line)) continue

    const tailMatch = line.match(STOCK_TAIL_RE)
    if (!tailMatch) {
      pendingText.push(line)
      continue
    }

    const rowTextParts = [...pendingText]
    pendingText.length = 0

    const beforeTail = line.slice(0, tailMatch.index!).trim()
    if (beforeTail) rowTextParts.push(beforeTail)

    let parsedText = splitStockNameOwner(rowTextParts)
    let lookahead = li + 1
    while (lookahead < lines.length) {
      const next = fixLineSplits(lines[lookahead]).trim()
      if (!next || isStockHeader(next)) {
        lookahead++
        continue
      }
      if (hasStockTail(next)) break

      if (!parsedText || shouldAppendStockSuffix(parsedText.name, next, Boolean(parsedText.owner))) {
        rowTextParts.push(next)
        parsedText = splitStockNameOwner(rowTextParts)
        lookahead++
        continue
      }
      break
    }
    li = lookahead - 1

    parsedText = splitStockNameOwner(rowTextParts)
    if (!parsedText) continue

    items.push({
      name: parsedText.name,
      owner: parsedText.owner,
      shares: parseInteger(tailMatch[1]),
      parValue: parseDecimal(tailMatch[2]),
      currency: tailMatch[3],
      ntdTotal: parseDecimal(tailMatch[4]),
    })
  }

  return { totalNTD: stockTotalNTD || items.reduce((s, i) => s + i.ntdTotal, 0), items }
}

// ──────────────── Fund Parsing (complete rewrite) ────────────────

const TRUSTEE_FULL_RE = /中\s*信\s*銀\s*行|台\s*北\s*富\s*邦|國\s*泰\s*證\s*券|國\s*泰\s*綜\s*合\s*證\s*券|國\s*泰\s*世\s*華|元\s*大\s*證\s*券|富\s*邦\s*銀\s*行|富\s*邦\s*證\s*券|永\s*豐\s*證\s*券|永\s*豐\s*金\s*證|保\s*德\s*信\s*證\s*券\s*投\s*資|群\s*益\s*證\s*券\s*投\s*資|摩\s*根\s*證\s*券\s*投\s*資|臺\s*灣\s*銀\s*行|臺\s*銀\s*證\s*券|華\s*南\s*永\s*昌|凱\s*基\s*證\s*券|京\s*城\s*商\s*業|京\s*城\s*證\s*券|臺\s*灣\s*新\s*光|新\s*光\s*證\s*券|上\s*海\s*銀\s*行|玉\s*山\s*銀\s*行|合\s*庫\s*商\s*業\s*銀\s*行|星\s*展\s*台\s*灣/
const TRUSTEE_ONLY_RE = /^(中信銀行信託部?|玉山銀行信託部?|合庫商業銀行信託部?|信託部?|部|分公司|母分公司|限公司|有限公司|台北富邦銀行敦北分行|國泰證券忠孝分公司|國泰綜合證券敦南二分公司|元大證券基隆分公司|元大證券基隆|富邦銀行|星展台灣南京東路分行|新光證券)$/
const FUND_TAIL_RE = new RegExp(`([\\d,]+\\.?\\d*)\\s+([\\d,]+\\.?\\d*)\\s+(?:(${CURRENCY_PATTERN})\\s+)?([\\d,]+\\.?\\d*)\\s*$`)

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

  // Check for trailing trustee fragments
  const stripped = trimmed.replace(/\s/g, '')
  if (stripped.length > 1 && stripped.endsWith('信託部')) {
    const name = stripped.replace(/信託部$/, '')
    return name.length > 0 ? name : ''
  }
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
  if (/^(月配|配息|息來源|級別|避險級別|日圓|美元|澳幣|南非幣|新臺幣|新台幣|數據|穩月配|權)/.test(stripped)) return true
  if (/^50ETF/.test(stripped)) return true
  return false
}

function stripFundTrusteeText(text: string): string {
  return text
    .replace(/中\s*信\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/元\s*大\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/台\s*北\s*富\s*邦\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/國\s*泰\s*綜\s*合\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/國\s*泰\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/國\s*泰\s*世\s*華\s*銀\s*行/g, '')
    .replace(/富\s*邦\s*銀\s*行/g, '')
    .replace(/富\s*邦\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/京\s*城\s*商\s*業\s*銀\s*行/g, '')
    .replace(/京\s*城\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/永\s*豐[\s\u4e00-\u9fff]*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/保\s*德\s*信\s*證\s*券[\s\u4e00-\u9fff]*信\s*託[\s\u4e00-\u9fff]*/g, '')
    .replace(/群\s*益\s*證\s*券[\s\u4e00-\u9fff]*信\s*託[\s\u4e00-\u9fff]*/g, '')
    .replace(/摩\s*根\s*證\s*券[\s\u4e00-\u9fff]*信\s*託[\s\u4e00-\u9fff]*/g, '')
    .replace(/臺\s*灣\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/臺\s*銀\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/華\s*南\s*永\s*昌[\s\u4e00-\u9fff]*/g, '')
    .replace(/凱\s*基\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/臺\s*灣\s*新\s*光\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/新\s*光\s*證\s*券[\s\u4e00-\u9fff]*/g, '')
    .replace(/上\s*海\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/玉\s*山\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/合\s*庫\s*商\s*業\s*銀\s*行[\s\u4e00-\u9fff]*/g, '')
    .replace(/星\s*展\s*台\s*灣[\s\u4e00-\u9fff]*/g, '')
    .replace(/Fidelity/gi, '')
    .replace(/eTrade/gi, '')
    // General: strip remaining institutional suffixes and fragments
    .replace(/[\u4e00-\u9fff]*投\s*資\s*信\s*託\s*股\s*份\s*有\s*限\s*公\s*司/g, '')
    .replace(/信\s*託\s*股\s*份\s*有\s*限/g, '')
    .replace(/資\s*信\s*託\s*股\s*份/g, '')
    .trim()
}

function matchFundTail(line: string): {
  prefix: string; units: number; nav: number; currency?: string; ntdTotal: number
} | null {
  const fixed = fixLineSplits(line)
  const tm = fixed.match(FUND_TAIL_RE)
  if (!tm) return null

  const ntdTotal = parseDecimal(tm[4])
  if (ntdTotal < 50) return null

  return {
    prefix: fixed.slice(0, tm.index!).trim(),
    units: parseDecimal(tm[1]),
    nav: parseDecimal(tm[2]),
    currency: tm[3] as string | undefined,
    ntdTotal,
  }
}

function splitFundNameOwner(parts: string[]): { name: string; owner: string } | null {
  const cleanedParts = parts
    .map(p => stripFundTrusteeText(p).trim())
    .filter(Boolean)

  for (let i = cleanedParts.length - 1; i >= 0; i--) {
    const line = cleanedParts[i]
    const ownerOnly = line.replace(/\s/g, '')
    if (isLikelyPersonName(ownerOnly)) {
      const name = cleanedParts.slice(0, i).concat(cleanedParts.slice(i + 1)).join('').replace(/\s/g, '')
      return name ? { name, owner: ownerOnly } : null
    }

    const ownerMatch = line.match(/^(.+?)\s+([\u4e00-\u9fff○][\u4e00-\u9fff○\s]{1,6})$/)
    if (!ownerMatch) continue
    const owner = ownerMatch[2].replace(/\s/g, '')
    if (!isLikelyPersonName(owner)) continue
    const name = [
      ...cleanedParts.slice(0, i),
      ownerMatch[1],
      ...cleanedParts.slice(i + 1),
    ].join('').replace(/\s/g, '')
    return name ? { name, owner } : null
  }

  return null
}

// Try to match a fund data line: extract owner + numeric fields from end of line.
function tryMatchFundData(line: string): {
  prefix: string; owner: string; units: number; nav: number; currency?: string; ntdTotal: number
} | null {
  const tail = matchFundTail(line)
  if (!tail) return null

  // Extract text before the numeric tail and remove trustee text between owner and numbers.
  const beforeTail = stripFundTrusteeText(tail.prefix)

  // Find owner: last CJK word (2-4 chars, including ○ for redacted names)
  const ownerRe = /([\u4e00-\u9fff○]{2,4})\s*$/
  const om = beforeTail.match(ownerRe)
  if (!om) return null

  const owner = om[1]
  if (!isLikelyPersonName(owner)) return null
  const prefix = beforeTail.slice(0, om.index!).trim()

  return {
    prefix,
    owner,
    units: tail.units,
    nav: tail.nav,
    currency: tail.currency,
    ntdTotal: tail.ntdTotal,
  }
}

function tryMatchFundNumbers(line: string): {
  units: number; nav: number; currency?: string; ntdTotal: number
} | null {
  const tail = matchFundTail(line)
  if (!tail || tail.prefix.trim()) return null
  return {
    units: tail.units,
    nav: tail.nav,
    currency: tail.currency,
    ntdTotal: tail.ntdTotal,
  }
}

function parseFunds(fundText: string): LegislatorDeclaration['securities']['funds'] {
  const empty = { totalNTD: 0, items: [] as LegislatorDeclaration['securities']['funds']['items'] }
  if (!fundText || isBlank(fundText)) return empty

  const fundTotalMatch = fundText.match(/總價額[：:]\s*新臺幣\s*([\d,]+)\s*元/)
  const fundTotalNTD = fundTotalMatch ? parseInteger(fundTotalMatch[1]) : 0

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
	      const dn = tryMatchFundNumbers(l)
	      if (dm || dn) break

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
	    const dm = tryMatchFundData(lines[i])
	    const dn = dm ? null : tryMatchFundNumbers(lines[i])
	    if (!dm && !dn) { i++; continue }
	    i++
	    const data = dm || dn!
	    let owner = dm?.owner || ''

	    // Clean prefix from the data line
	    let namePrefix = dm ? stripFundTrusteeText(dm.prefix).replace(/\s/g, '') : ''
	    // Remove any remaining trustee fragments
	    namePrefix = namePrefix
	      .replace(/-$/, '')
	      .trim()

	    const allNameFrags = [...nameBuf]
	    if (namePrefix) allNameFrags.push(namePrefix)

	    // Numbers-only rows put the owner/name on the following line(s).
	    while (!owner && i < lines.length) {
	      const l = lines[i]
	      if (isFundHeader(l) || isFundSkip(l)) { i++; continue }
	      if (tryMatchFundData(l) || tryMatchFundNumbers(l)) break

	      if (isTrusteeLine(l)) { i++; continue }

	      const np = extractNameFromMixed(l)
	      const fragment = np !== null ? np : l.trim()
	      if (fragment.length > 0) {
	        const candidate = splitFundNameOwner([...allNameFrags, fragment])
	        if (candidate) {
	          allNameFrags.length = 0
	          allNameFrags.push(candidate.name)
	          owner = candidate.owner
	        } else {
	          allNameFrags.push(fragment)
	        }
	      }
	      i++
	      if (owner) break
	    }

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
	    if (!owner || !fullName) continue

	    entries.push({
	      name: fullName,
	      owner,
	      trustee: '',
	      units: data.units,
	      nav: data.nav,
	      currency: data.currency,
	      ntdTotal: data.ntdTotal,
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
  const totalNTD = totalMatch ? parseInteger(totalMatch[1]) : 0

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
  const name = findHeaderName(text)
  if (name) result.name = name
  const orgLine = text.match(/1\.\s*(立法院|[^\s]+院)/)
  if (orgLine) result.organization = orgLine[1]
  if (text.match(/立法委員/)) result.title = '立法委員'
  // Year/month/day may be split across PDF cells
  const declarationDate = findDeclarationDate(text)
  if (declarationDate) result.declarationDate = declarationDate
  const fromMatch = text.match(/前次申報日期\s*民?國?\s*(\d[\d\s]{0,4})\s*年\s*(\d[\d\s]{0,2})\s*月\s*(\d[\d\s]{0,2})\s*日/)
  if (fromMatch && declarationDate) {
    result.changePeriod = {
      from: parseRocDate(fromMatch[1], fromMatch[2], fromMatch[3]),
      to: declarationDate,
    }
  }
  const spouseMatch = text.match(/配偶\s+(\S+)/)
  if (spouseMatch && spouseMatch[1] !== '及' && spouseMatch[1] !== '無') {
    result.spouse = { relation: '配偶', name: spouseMatch[1] }
  }
  return result
}

// ──── Change stock parsing: handles two formats ────
// Format A ("numbers-first"): used by 李坤城, 呂玉玲
//   [broker reason line]
//   shares price total          ← anchor: numbers-only line
//   stockName [broker] owner date [reason]
//   [(存)/(提) continuation]
// Format B ("inline"): used by 何欣純, 吳琪銘
//   year 年 month 月            ← date preamble
//   stockName broker owner shares price reason total  ← data line
//   day 日                      ← date suffix

const CHANGE_SKIP_RE = /名\s*稱|證\s*券\s*交|變\s*動\s*時|變\s*動\s*原|總\s*額|國內上市|監察院公報/

function splitStockAndBroker(prefix: string): { stockName: string; broker: string } {
  // Look for broker patterns
  const brokerIdx = prefix.search(/(?:證券|國\s*票|富\s*邦|元\s*大|元\s*富|凱\s*基|永\s*豐|群\s*益|華\s*南|中\s*國\s*信\s*託|中\s*信|臺\s*銀|台\s*銀|第\s*一|兆\s*豐|統\s*一|新\s*光|合\s*庫|國\s*泰|玉\s*山)/)
  if (brokerIdx > 0) {
    return {
      stockName: prefix.slice(0, brokerIdx).replace(/[\s-]+$/, '').replace(/\s/g, '').replace(/[＊*]$/, ''),
      broker: prefix.slice(brokerIdx).replace(/\s/g, '').replace(/^[＊*]+/, ''),
    }
  }
  // No broker pattern — check for / or - separator (e.g., "國票 - 南科")
  const sepIdx = prefix.search(/\s+[-/]\s+/)
  if (sepIdx > 0) {
    // First token before separator is stock+broker start
    const firstSpace = prefix.indexOf(' ')
    if (firstSpace > 0 && firstSpace < sepIdx) {
      return {
        stockName: prefix.slice(0, firstSpace).replace(/\s/g, '').replace(/[＊*]$/, ''),
        broker: prefix.slice(firstSpace).replace(/\s/g, '').replace(/^[＊*]+/, ''),
      }
    }
  }
  return { stockName: prefix.replace(/\s/g, '').replace(/[＊*]$/, ''), broker: '' }
}

// Format B: inline parser
function parseChangeStocksInline(rawLines: string[]): NonNullable<ChangeDeclaration['stocks']> {
  const items: NonNullable<ChangeDeclaration['stocks']> = []
  let currentYear = 0
  let currentMonth = 0

  const dayLineRe = /^\s*(\d[\d\s]{0,2})\s*日\s*$/

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    if (CHANGE_SKIP_RE.test(raw)) continue
    if (/^\s*$/.test(raw)) continue

    // Day suffix line
    if (dayLineRe.test(raw)) continue

    // Date preamble line: "113 年 01 月" (possibly with split digits)
    const dm = raw.match(/(\d[\d\s]*)\s*年\s*(\d{1,2})\s*月/)
    if (dm) {
      // Make sure it's a pure date line (not a data line containing year text)
      const hasDataTail = /(現?[買賣])\s+[\d,]+/.test(raw)
      if (!hasDataTail) {
        let y = parseInt(dm[1].replace(/\s/g, ''))
        if (y < 1911) y += 1911
        currentYear = y
        currentMonth = parseInt(dm[2])
        continue
      }
    }

    // Try inline data match
    const fixed = fixLineSplits(raw)

    // Match from end: reason total
    const tailMatch = fixed.match(/(現?[買賣])\s+([\d,]+\.?\d*)\s*$/)
    if (!tailMatch) continue

    const reason = tailMatch[1]
    const total = parseDecimal(tailMatch[2])

    // Before reason: ... shares price
    const beforeReason = fixed.slice(0, tailMatch.index!).trim()
    const numMatch = beforeReason.match(/([\d,]+)\s+([\d,.]+)\s*$/)
    if (!numMatch) continue

    const shares = parseInteger(numMatch[1])
    if (shares === 0) continue
    const changePrice = parseDecimal(numMatch[2])

    // Before numbers: ... owner
    const beforeNums = beforeReason.slice(0, numMatch.index!).trim()
    const ownerMatch = beforeNums.match(/([\u4e00-\u9fff○]{2,4})\s*$/)
    if (!ownerMatch) continue

    const owner = ownerMatch[1]
    const prefix = beforeNums.slice(0, ownerMatch.index!).trim()
    const { stockName, broker } = splitStockAndBroker(prefix)
    if (!stockName) continue

    // Build date: look ahead for day line
    let day = 0
    let nextIdx = i + 1
    while (nextIdx < rawLines.length && /^\s*$/.test(rawLines[nextIdx])) nextIdx++
    if (nextIdx < rawLines.length) {
      const dayMatch = rawLines[nextIdx].match(dayLineRe)
      if (dayMatch) day = parseInt(dayMatch[1].replace(/\s/g, ''), 10)
    }

    const dateStr = currentYear > 0 && currentMonth > 0
      ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`
      : ''

    items.push({
      name: stockName,
      broker: broker.replace(/\s/g, ''),
      owner,
      shares,
      changePrice,
      changeDate: dateStr,
      changeReason: reason,
      total,
    })
  }
  return items
}

// Format A: numbers-first parser (original approach)
function parseChangeStocksNumbersFirst(rawLines: string[]): NonNullable<ChangeDeclaration['stocks']> {
  const items: NonNullable<ChangeDeclaration['stocks']> = []
  const numbersRe = /^([\d,]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    if (CHANGE_SKIP_RE.test(raw)) continue
    if (/^\s*$/.test(raw)) continue

    const fixed = fixLineSplits(raw)
    const nm = fixed.match(numbersRe)
    if (!nm) continue

    const shares = parseInteger(nm[1])
    if (shares === 0) continue
    const changePrice = parseDecimal(nm[2])
    const total = parseDecimal(nm[3])

    // Info line: the next non-empty line after numbers
    let infoIdx = i + 1
    while (infoIdx < rawLines.length && /^\s*$/.test(rawLines[infoIdx])) infoIdx++
    if (infoIdx >= rawLines.length) continue
    const infoLine = rawLines[infoIdx]

    let stockName = ''
    let broker = ''
    let owner = ''
    let dateStr = ''
    let reason = ''

    const dateMatch = infoLine.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (!dateMatch) continue

    let year = parseInt(dateMatch[1])
    if (year < 1911) year += 1911
    dateStr = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`

    const ownerMatch = infoLine.match(/([\u4e00-\u9fff○]{2,4})\s+\d{2,4}\s*年/)
    if (ownerMatch) owner = ownerMatch[1]

    const ownerIdx = infoLine.indexOf(ownerMatch![0])
    const beforeOwner = infoLine.slice(0, ownerIdx).trim()
    const tokens = beforeOwner.split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      stockName = tokens[0].replace(/[＊*]$/, '')
      if (tokens.length > 1) {
        const brokerTokens = tokens.slice(1).filter(t => t !== '*' && t !== '＊')
        broker = brokerTokens.join('').replace(/\s/g, '')
      }
    }

    const dateEnd = infoLine.indexOf(dateMatch[0]) + dateMatch[0].length
    const afterDate = infoLine.slice(dateEnd).trim()
    if (afterDate) reason = afterDate.replace(/\s/g, '')

    // For complex entries (存券匯撥/減資轉入 etc.), broker+reason on line BEFORE numbers
    if (!reason) {
      let prevIdx = i - 1
      while (prevIdx >= 0 && /^\s*$/.test(rawLines[prevIdx])) prevIdx--
      if (prevIdx >= 0) {
        const prevLine = rawLines[prevIdx]
        const prevStripped = prevLine.replace(/\s/g, '')
        const reasonInPrev = prevStripped.match(/(存券匯撥|變更面額|劃撥配發|減資轉入|減資轉出|買進|賣出|配股|轉讓|贈與)/)
        if (reasonInPrev) {
          const reasonStart = prevLine.search(/存\s*券\s*匯\s*撥|變\s*更\s*面\s*額|劃\s*撥\s*配\s*發|減\s*資\s*轉\s*入|減\s*資\s*轉\s*出|買\s*進|賣\s*出|配\s*股|轉\s*讓|贈\s*與/)
          if (reasonStart > 0) {
            broker = prevLine.slice(0, reasonStart).trim().replace(/\s/g, '')
          }
          reason = reasonInPrev[1]

          let contIdx = infoIdx + 1
          while (contIdx < rawLines.length && /^\s*$/.test(rawLines[contIdx])) contIdx++
          if (contIdx < rawLines.length) {
            const contLine = rawLines[contIdx]
            const contStripped = contLine.replace(/\s/g, '')
            const suffixMatch = contStripped.match(/(轉入|轉出|配發)?\(([存提])\)/)
            if (suffixMatch) {
              if (suffixMatch[1]) reason += suffixMatch[1]
              reason += `(${suffixMatch[2]})`
            }
            const brokerCont = contStripped.replace(/(轉入|轉出|配發)?\([存提]\)/, '').trim()
            if (brokerCont && /^[\u4e00-\u9fff]+$/.test(brokerCont) && brokerCont.length <= 3) {
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
  return items
}

function parseChangeStocks(text: string): ChangeDeclaration['stocks'] {
  if (isBlank(text)) return undefined
  const rawLines = text.split('\n')

  // Try numbers-first format (李坤城/呂玉玲 style)
  const numbersFirstResult = parseChangeStocksNumbersFirst(rawLines)

  // Try inline format (何欣純/吳琪銘 style)
  const inlineResult = parseChangeStocksInline(rawLines)

  // Use whichever produced more results
  const items = numbersFirstResult.length >= inlineResult.length ? numbersFirstResult : inlineResult

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

async function parsePDF(filePath: string): Promise<LegislatorDocument[]> {
  let text = await extractText(filePath)

  // Strip ★ correction markers (e.g. "1★國泰人壽" / "1 ★ 國泰人壽" → "國泰人壽")
  text = stripCorrectionMarkers(text)

  // Split multi-declaration PDFs (multiple annual declarations in one PDF)
  const declHeaderRe = /公\s*職\s*人\s*員\s*(變\s*動\s*)?財\s*產\s*申\s*報\s*表/g
  const headerPositions: number[] = []
  let hm: RegExpExecArray | null
  while ((hm = declHeaderRe.exec(text)) !== null) {
    headerPositions.push(hm.index)
  }

  // If multiple declarations found, split and parse each independently
  if (headerPositions.length > 1) {
    const docs: LegislatorDocument[] = []
    for (let i = 0; i < headerPositions.length; i++) {
      const start = headerPositions[i]
      const end = i + 1 < headerPositions.length ? headerPositions[i + 1] : text.length
      const chunk = text.slice(start, end)
      if (isChangeDeclaration(chunk)) {
        docs.push(await parseChangeDeclarationDoc(chunk))
      } else {
        docs.push(await parseAssetDeclaration(chunk))
      }
    }
    return docs
  }

  if (isChangeDeclaration(text)) {
    console.log('  [type: change declaration]')
    return [await parseChangeDeclarationDoc(text)]
  } else {
    console.log('  [type: asset declaration]')
    return [await parseAssetDeclaration(text)]
  }
}

function validateParsedDocument(doc: LegislatorDocument, source: string): void {
  const errors: string[] = []
  if (!isLikelyPersonName(doc.name)) errors.push(`invalid name "${doc.name}"`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.declarationDate)) errors.push(`invalid declarationDate "${doc.declarationDate}"`)

  if (doc.type === 'declaration') {
    for (const item of doc.securities.stocks.items) {
      if (!item.name || /^\d+$/.test(item.name) || /★/.test(item.name)) errors.push(`invalid stock name "${item.name}"`)
      if (!isLikelyPersonName(item.owner)) errors.push(`invalid stock owner "${item.owner}"`)
    }
    for (const item of doc.securities.funds.items) {
      if (!item.name || /^\d+$/.test(item.name) || /★/.test(item.name)) errors.push(`invalid fund name "${item.name}"`)
      if (!item.owner) errors.push(`missing fund owner for "${item.name}"`)
    }
  } else {
    for (const item of doc.stocks || []) {
      if (!item.name || /^\d+$/.test(item.name) || /★/.test(item.name) || /★/.test(item.broker)) errors.push(`invalid change stock "${item.name}" / "${item.broker}"`)
      if (!isLikelyPersonName(item.owner)) errors.push(`invalid change owner "${item.owner}"`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.changeDate)) errors.push(`invalid changeDate "${item.changeDate}"`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`${source}: ${errors.slice(0, 8).join('; ')}${errors.length > 8 ? `; ... ${errors.length - 8} more` : ''}`)
  }
}

async function main() {
  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`)
    process.exit(1)
  }
  // Clean output directory and index before parsing
  if (fs.existsSync(outputDir)) {
    for (const f of fs.readdirSync(outputDir).filter(f => f.endsWith('.json'))) {
      fs.unlinkSync(path.join(outputDir, f))
    }
  }
  const indexPath = path.join(path.dirname(outputDir), 'index.json')
  if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath)

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
      const docs = await parsePDF(path.join(inputDir, file))
      const src = file.replace('.pdf', '')
      for (let di = 0; di < docs.length; di++) {
        const doc = docs[di]
        validateParsedDocument(doc, file)
        const datePart = doc.declarationDate || file.replace('.pdf', '')
        const suffix = docs.length > 1 ? `-${di + 1}` : ''
        let outFile: string
        if (doc.type === 'change') {
          outFile = `${doc.name}-change-${datePart}-${src}${suffix}.json`
        } else {
          outFile = `${doc.name}-${datePart}-${src}${suffix}.json`
        }
        fs.writeFileSync(path.join(outputDir, outFile), JSON.stringify(doc, null, 2), 'utf-8')
        console.log(`  → ${outFile}`)
      }
    } catch (err) {
      console.error(`  Error parsing ${file}:`, err)
    }
  }
  console.log('Done!')
}

main()
