import fs from "fs"
import path from "path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type {
  CandidateDeclaration,
  CandidateDetailTable,
  CandidateElectionFile,
} from "../lib/types"

/**
 * Reads the itemized tables (土地、建物、存款…) and 備註 from the hand-checked
 * text-version PDFs and writes them into the candidate data file.
 *
 * Layout of the text versions: titles and notes start at x≈40, table cells at
 * x≥44; a table's first line is its header, cells are placed at or right of
 * their header's x, and a cell that wraps continues ~14pt lower while the
 * next row starts ~19pt lower. Headers repeat after a page break.
 */

const ROOT_DIR = process.cwd()
const DATA_PATH = path.join(ROOT_DIR, "data", "candidates", "2026-mayor.json")
const PDF_DIR = path.join(ROOT_DIR, "public", "candidate-pdfs", "2026-mayor")

const TABLE_MIN_X = 42
const WRAP_MAX_GAP = 16
const ITEM_JOIN_GAP = 3

/** Sections kept in the output, in declaration order. */
const MAIN_SECTIONS = [
  "土地",
  "建物",
  "船舶",
  "汽車",
  "航空器",
  "現金",
  "存款",
  "債券",
  "其他有價證券",
  "珠寶、古董、字畫等",
  "保險",
  "虛擬資產",
  "債權",
  "債務",
  "事業投資",
]

const MAJOR_SECTIONS: Record<string, string | null> = {
  三: "船舶",
  四: "汽車",
  五: "航空器",
  六: "現金",
  七: "存款",
  九: "珠寶、古董、字畫等",
  十: "債權",
  十一: "債務",
  十二: "事業投資",
}

const SUB_SECTIONS: Record<string, string> = {
  土地: "土地",
  建物: "建物",
  股票: "股票",
  債券: "債券",
  基金受益憑證: "基金受益憑證",
  其他有價證券: "其他有價證券",
  珠寶: "珠寶、古董、字畫等",
  保險: "保險",
  虛擬資產: "虛擬資產",
}

/** Already shown as holdings on the candidate page. */
const OMITTED_SECTIONS = new Set(["股票", "基金受益憑證", "基本資料"])

const ROW_NUMBER_COLUMNS = new Set(["項次", "序", "序號", "編號"])

const BLANK_NOTE =
  /^[（(]?(原件)?(本欄|此欄)?(空白|填「無」|無文字|無)(?![㐀-鿿])/

interface TextItem {
  str: string
  x: number
  end: number
}

interface Line {
  page: number
  y: number
  items: TextItem[]
}

interface Column {
  x: number
  text: string
}

interface Section {
  title: string
  expected: number | null
  total: number | null
  columns: Column[] | null
  signature: string
  rows: string[][]
  mode: "header" | "repeat" | "row"
  last: Line | null
}

interface ParsedSource {
  sections: Section[]
  notes: string | null
}

type PdfTextContentItem = {
  str: string
  transform: number[]
  width: number
}

function isPdfTextContentItem(item: unknown): item is PdfTextContentItem {
  if (typeof item !== "object" || item === null) return false
  const candidate = item as { str?: unknown; transform?: unknown }
  return typeof candidate.str === "string" && Array.isArray(candidate.transform)
}

async function readLines(filePath: string): Promise<Line[]> {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const lines: Line[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, TextItem[]>()
    for (const item of content.items) {
      if (!isPdfTextContentItem(item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ str: item.str, x, end: x + item.width })
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x)
      const text = items.map((item) => item.str).join("").replace(/\s/g, "")
      if (/^第\d+頁，共\d+頁$/.test(text)) continue
      lines.push({ page: p, y, items })
    }
  }
  return lines
}

function joinItems(items: TextItem[]): string {
  let text = ""
  let end = -Infinity
  for (const item of items) {
    text += item.x - end > ITEM_JOIN_GAP && text ? ` ${item.str}` : item.str
    end = item.end
  }
  return text.trim()
}

/** Wrapped text loses the line break; keep a space only between Latin words. */
function joinWrapped(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  return /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? `${a} ${b}` : a + b
}

function parseCount(text: string): number | null {
  const match = text.match(/總(?:申報)?筆數[：:\s]*(\d+)\s*筆/)
  return match ? Number(match[1]) : null
}

function parseTotal(text: string): number | null {
  const match = text.match(/總(?:金額|價額)[：:]\s*新臺幣\s*([\d,]+(?:\.\d+)?)\s*元/)
  return match ? Number(match[1].replace(/,/g, "")) : null
}

function columnIndex(columns: Column[], x: number): number {
  let index = 0
  columns.forEach((column, i) => {
    if (x + ITEM_JOIN_GAP >= column.x) index = i
  })
  return index
}

function splitByColumn(columns: Column[], line: Line): string[] {
  const groups: TextItem[][] = columns.map(() => [])
  for (const item of line.items) groups[columnIndex(columns, item.x)].push(item)
  return groups.map(joinItems)
}

function addTableLine(section: Section, line: Line) {
  const last = section.last
  const wrapped =
    last !== null && last.page === line.page && last.y - line.y <= WRAP_MAX_GAP
  section.last = line

  if (!section.columns) {
    const columns: Column[] = []
    for (const item of line.items) {
      const previous = columns.at(-1)
      if (previous && item.x - previous.x < ITEM_JOIN_GAP) previous.text += item.str
      else columns.push({ x: item.x, text: item.str })
    }
    section.columns = columns
    section.signature = joinItems(line.items)
    section.mode = "header"
    return
  }

  if (wrapped) {
    if (section.mode === "repeat") return
    const cells = splitByColumn(section.columns, line)
    if (section.mode === "header") {
      section.columns.forEach((column, i) => {
        column.text = joinWrapped(column.text, cells[i])
      })
    } else {
      const row = section.rows.at(-1)!
      cells.forEach((cell, i) => {
        row[i] = joinWrapped(row[i], cell)
      })
    }
    return
  }

  if (joinItems(line.items) === section.signature) {
    section.mode = "repeat"
    return
  }

  section.rows.push(splitByColumn(section.columns, line))
  section.mode = "row"
}

function stripPagePrefix(text: string): string {
  return text.replace(/^(原件|原PDF)第[\d、，–\-~]+頁\s*/, "")
}

function appendixTitle(label: string | null, owner: string | null): string {
  return `信託財產${label ? `－${label}` : ""}${owner ? `（${owner}）` : ""}`
}

async function parseSource(filePath: string): Promise<ParsedSource> {
  const lines = await readLines(filePath)
  const sections = new Map<string, Section>()
  let major: string | null = null
  let current: Section | null = null
  let stage: "form" | "notes" | "end" | "appendix" = "form"
  let appendixLabel: string | null = null
  let appendixOwner: string | null = null
  const noteLines: Line[] = []

  function enter(title: string): Section {
    let section = sections.get(title)
    if (!section) {
      section = {
        title,
        expected: null,
        total: null,
        columns: null,
        signature: "",
        rows: [],
        mode: "header",
        last: null,
      }
      sections.set(title, section)
    }
    section.last = null
    return section
  }

  function readTitleFigures(section: Section, text: string) {
    section.expected = parseCount(text) ?? section.expected
    section.total = parseTotal(text) ?? section.total
  }

  for (const line of lines) {
    const isTable = line.items[0].x >= TABLE_MIN_X
    if (isTable) {
      if (stage === "appendix" && !current) {
        current = enter(appendixTitle(appendixLabel, appendixOwner))
      }
      if (current) addTableLine(current, line)
      continue
    }

    const text = stripPagePrefix(joinItems(line.items))
    const majorMatch = text.match(/^（(十[一二三]?|[一二三四五六七八九])）/)

    if (stage !== "appendix" && majorMatch) {
      major = majorMatch[1]
      if (major === "十三") {
        stage = "notes"
        current = null
        continue
      }
      stage = "form"
      const title = major === "一" ? "基本資料" : MAJOR_SECTIONS[major]
      current = title ? enter(title) : null
      if (current) readTitleFigures(current, text)
      continue
    }

    if (stage === "form") {
      const sub = text.match(
        /^\d\.\s*(土地|建物|股票|債券|基金受益憑證|其他有價證券|珠寶|保險|虛擬資產)/
      )
      if (sub && (major === "二" || major === "八" || major === "九")) {
        current = enter(SUB_SECTIONS[sub[1]])
        readTitleFigures(current, text)
      } else if (current) {
        if (current.expected === null) current.expected = parseCount(text)
        if (current.total === null) current.total = parseTotal(text)
        current.last = null
      }
      continue
    }

    if (stage === "notes") {
      if (/^(結語|申報聲明|此致|以上資料)/.test(text)) {
        stage = "end"
        current = null
        continue
      }
      const sub = text.match(/^備註\s*\d\.\s*(土地|建物)/)
      if (sub) {
        current = enter(`${sub[1]}（${text.includes("信託") ? "信託" : "備註"}）`)
        current.expected = parseCount(text)
        continue
      }
      current = null
      noteLines.push(line)
      continue
    }

    const startsAppendix =
      /^附件[一二三四五]?(（|：|$)/.test(text) ||
      (/財產目錄/.test(text) && /委託人/.test(text))
    if (stage === "end" && !startsAppendix) continue
    if (startsAppendix) {
      stage = "appendix"
      appendixLabel = text.match(/—\s*(固定資產|銀行存款|股票)$/)?.[1] ?? null
      appendixOwner = text.match(/—\s*([㐀-鿿]{2,4})$/)?.[1] ?? null
      if (appendixOwner === appendixLabel) appendixOwner = null
    }
    const owner = text.match(/委託人[：:\s]+(?:\([^)]*\)\s*)?([㐀-鿿]{2,4})/)
    if (owner) appendixOwner = owner[1]
    const label =
      text.match(/^【([^】－—]+)/)?.[1] ??
      text.match(/^不動產：(土地|建物)/)?.[1] ??
      text.match(/投資種類：([^；;]+)/)?.[1]
    if (label) appendixLabel = label
    current = null
  }

  return {
    sections: [...sections.values()].filter(
      (section) => !OMITTED_SECTIONS.has(section.title)
    ),
    notes: readNotes(noteLines),
  }
}

/** Notes that sit directly above a table are its caption, not the declarant's text. */
function readNotes(lines: Line[]): string | null {
  const paragraphs: string[] = []
  let last: Line | null = null
  for (const line of lines) {
    const text = joinItems(line.items)
    const wrapped =
      last !== null && last.page === line.page && last.y - line.y <= WRAP_MAX_GAP
    if (wrapped && paragraphs.length) {
      paragraphs[paragraphs.length - 1] = joinWrapped(paragraphs.at(-1)!, text)
    } else {
      paragraphs.push(text)
    }
    last = line
  }
  const notes = paragraphs.filter((paragraph) => !BLANK_NOTE.test(paragraph))
  return notes.length ? notes.join("\n") : null
}

function toTable(section: Section): CandidateDetailTable {
  const columns = section.columns ?? []
  const keep = columns.map((column) => !ROW_NUMBER_COLUMNS.has(column.text.trim()))
  return {
    title: section.title,
    columns: columns.filter((_, i) => keep[i]).map((column) => column.text.trim()),
    rows: section.rows
      .filter((row) => !row.some((cell) => cell.includes("劃線刪除")))
      .map((row) => row.filter((_, i) => keep[i]).map((cell) => cell.trim())),
  }
}

function orderOf(title: string): number {
  const index = MAIN_SECTIONS.indexOf(title)
  return index === -1 ? MAIN_SECTIONS.length : index
}

/** Later sources are correction pages: their sections replace the original's. */
function mergeSources(parsed: ParsedSource[]): {
  sections: Section[]
  notes: string | null
} {
  const merged = new Map<string, Section>()
  let notes: string | null = null
  for (const source of parsed) {
    for (const section of source.sections) merged.set(section.title, section)
    notes = source.notes ?? notes
  }
  const sections = [...merged.values()]
    .map((section, index) => ({ section, index }))
    .sort((a, b) => orderOf(a.section.title) - orderOf(b.section.title) || a.index - b.index)
    .map(({ section }) => section)
  return { sections, notes }
}

function parseAmount(cell: string): number | null {
  const match = cell.replace(/[$,\s]/g, "").match(/^-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

function amountColumn(columns: string[]): number {
  const exact = columns.findIndex((column) => /新臺幣總額|折合新臺幣/.test(column))
  if (exact !== -1) return exact
  return columns.findLastIndex((column) => /餘額|金額|價額/.test(column))
}

const COUNT_KEYS = {
  土地: "land",
  建物: "buildings",
  汽車: "vehicles",
  保險: "insurance",
} as const

function validate(
  candidate: CandidateDeclaration,
  sections: Section[],
  tables: CandidateDetailTable[],
  problems: string[]
) {
  const label = `${candidate.slug} (${candidate.sources.map((s) => s.fileId).join("+")})`
  sections.forEach((section, i) => {
    const table = tables[i]
    if (section.expected !== null && section.expected !== table.rows.length) {
      problems.push(`${label} ${section.title}: ${table.rows.length} rows, printed ${section.expected}`)
    }
    if (table.rows.length && section.columns === null) {
      problems.push(`${label} ${section.title}: rows without header`)
    }
    if (section.total !== null && table.rows.length) {
      const column = amountColumn(table.columns)
      if (column === -1) {
        problems.push(`${label} ${section.title}: no amount column in ${table.columns.join("|")}`)
        return
      }
      const values = table.rows.map((row) => parseAmount(row[column]))
      const sum = values.reduce<number>((total, value) => total + (value ?? 0), 0)
      if (Math.abs(sum - section.total) > 1) {
        const unparsed = values.filter((value) => value === null).length
        problems.push(
          `${label} ${section.title}: rows sum ${sum.toFixed(2)}, printed ${section.total}` +
            (unparsed ? ` (${unparsed} unparsed cells)` : "")
        )
      }
    }
  })
  for (const [title, key] of Object.entries(COUNT_KEYS)) {
    const rows = tables.find((table) => table.title === title)?.rows.length ?? 0
    const expected = candidate.counts[key]
    if (expected !== null && rows !== expected) {
      problems.push(`${label} ${title}: ${rows} rows, counts.${key} ${expected}`)
    }
  }
}

async function main() {
  const file = JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) as CandidateElectionFile
  const problems: string[] = []

  const candidates = []
  for (const candidate of file.candidates) {
    const parsed = []
    for (const source of candidate.sources) {
      parsed.push(await parseSource(path.join(PDF_DIR, source.textPdf)))
    }
    const { sections, notes } = mergeSources(parsed)
    const nonEmpty = sections.filter((section) => section.rows.length > 0)
    const tables = nonEmpty.map(toTable)
    validate(candidate, sections, sections.map(toTable), problems)
    const details = tables.filter((table) => table.rows.length > 0)

    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(candidate)) {
      if (key === "details" || key === "notes") continue
      next[key] = value
      if (key === "funds") {
        next.details = details
        next.notes = notes
      }
    }
    candidates.push(next)
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify({ ...file, candidates }, null, 2) + "\n")
  console.log(`Wrote details for ${candidates.length} candidates to ${path.relative(ROOT_DIR, DATA_PATH)}`)
  if (problems.length) {
    console.log(`\n${problems.length} validation problems:`)
    for (const problem of problems) console.log(`- ${problem}`)
  }
}

main()
