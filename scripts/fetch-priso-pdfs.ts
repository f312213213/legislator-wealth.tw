import fs from "fs"
import path from "path"
import { setTimeout as sleep } from "timers/promises"
import type { CouncilorMetaFile, MayorMetaFile } from "../lib/types"

const PRISO_API_BASE = "https://priso.cy.gov.tw/api"
const RAW_PDF_DIR = path.join(process.cwd(), "raw-pdfs")
const DEFAULT_PAGE_SIZE = 200
const DEFAULT_CONCURRENCY = 4

type Category = "legislators" | "councilors" | "mayors"

interface LegislatorMeta {
  party: string
  avatar: string
}

interface PrisoResponse<T> {
  Success: boolean
  Message: string
  Data: T
}

interface PrisoPage {
  PageNo: number
  PageSize: number
  TotalCount?: number
  OrderByNum?: number
  OrderBySort?: string
}

interface PrisoQueryData {
  Data: PrisoRow[]
  Page: PrisoPage
}

interface PrisoRow {
  Seq: string
  Id: string
  Name: string
  Period: string
  Type: string
  Dept: string
  Title: string
  PublishType: string
  PublishDate: string
  PublishPage: string
  OverFiveYear: string
}

interface Target {
  category: Category
  name: string
  queryNames: string[]
  organization?: string
  title?: string
  city?: string
  sourceKey: string
  outputDir: string
}

interface Args {
  categories: Set<Category>
  concurrency: number
  dryRun: boolean
  force: boolean
  includeOverFiveYear: boolean
  limit?: number
  names?: Set<string>
}

interface TargetResult {
  target: Target
  rows: PrisoRow[]
  files: string[]
  skipped: string[]
  missing?: string
  error?: string
}

const ALL_CATEGORIES: Category[] = ["legislators", "councilors", "mayors"]

function usage(): string {
  return [
    "Usage: tsx scripts/fetch-priso-pdfs.ts [options]",
    "",
    "Options:",
    "  --category=legislators,councilors,mayors  Limit categories. Defaults to all.",
    "  --names=韓國瑜,侯友宜                  Limit people by display name.",
    "  --limit=10                              Process only the first N targets.",
    "  --concurrency=4                         Concurrent PRISO requests.",
    "  --force                                 Re-download existing PDF files.",
    "  --dry-run                               Query only; do not download PDFs.",
    "  --include-over-five-year                Include PRISO rows marked over five years.",
    "  --help                                  Show this help.",
    "",
    "The script reads existing data/legislators-meta.json, data/councilors-meta.json, and data/mayors-meta.json.",
  ].join("\n")
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage())
    process.exit(0)
  }

  const categoriesArg =
    args.find((arg) => arg.startsWith("--category=")) ??
    args.find((arg) => arg.startsWith("--categories="))
  const categories = new Set<Category>(
    categoriesArg
      ? categoriesArg
          .replace(/^--categor(?:y|ies)=/, "")
          .split(",")
          .map((value) => value.trim())
          .filter((value): value is Category =>
            ALL_CATEGORIES.includes(value as Category)
          )
      : ALL_CATEGORIES
  )

  if (categories.size === 0) {
    throw new Error(`No valid category in ${categoriesArg}`)
  }

  const limitArg = args.find((arg) => arg.startsWith("--limit="))
  const concurrencyArg = args.find((arg) => arg.startsWith("--concurrency="))
  const namesArg =
    args.find((arg) => arg.startsWith("--names=")) ??
    args.find((arg) => arg.startsWith("--name="))

  return {
    categories,
    concurrency: parsePositiveInteger(
      concurrencyArg?.split("=")[1],
      DEFAULT_CONCURRENCY
    ),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
    includeOverFiveYear: args.includes("--include-over-five-year"),
    limit: limitArg
      ? parsePositiveInteger(limitArg.split("=")[1], 0)
      : undefined,
    names: namesArg
      ? new Set(
          namesArg
            .replace(/^--names?=/, "")
            .split(",")
            .map((value) => normalizeComparable(value))
            .filter(Boolean)
        )
      : undefined,
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readJson<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath)
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${relativePath}. Run the existing list fetch script first.`
    )
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u3000\s]+/g, "")
    .trim()
}

function normalizeComparable(value: string): string {
  return normalizeText(value)
    .replace(/[台臺]/g, "台")
    .replace(/[·‧・．.()（）\-_/]/g, "")
}

function extractChineseName(value: string): string | undefined {
  return normalizeText(value).match(/^[\u3400-\u9fff○]+/)?.[0]
}

function unique(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  )
}

function buildQueryNames(name: string): string[] {
  const chineseName = extractChineseName(name)
  return unique([chineseName, name])
}

function targetMatchesNameFilter(target: Target, names?: Set<string>): boolean {
  if (!names) return true
  return [target.name, ...target.queryNames].some((name) =>
    names.has(normalizeComparable(name))
  )
}

function buildLegislatorTargets(): Target[] {
  const meta = readJson<Record<string, LegislatorMeta>>(
    "data/legislators-meta.json"
  )
  const targets = new Map<string, Target>()

  for (const rawName of Object.keys(meta)) {
    const chineseName = extractChineseName(rawName) ?? rawName
    const key = normalizeComparable(chineseName)
    const existing = targets.get(key)
    if (existing) {
      existing.queryNames = unique([
        ...existing.queryNames,
        rawName,
        chineseName,
      ])
      continue
    }

    targets.set(key, {
      category: "legislators",
      name: chineseName,
      queryNames: buildQueryNames(rawName),
      organization: "立法院",
      sourceKey: key,
      outputDir: RAW_PDF_DIR,
    })
  }

  return Array.from(targets.values()).sort(compareTargets)
}

function buildCouncilorTargets(): Target[] {
  const data = readJson<CouncilorMetaFile>("data/councilors-meta.json")
  return Object.values(data.councilors)
    .map((councilor) => ({
      category: "councilors" as const,
      name: councilor.name,
      queryNames: buildQueryNames(councilor.name),
      organization: councilor.organization,
      title: councilor.title,
      city: councilor.city,
      sourceKey: councilor.slug,
      outputDir: path.join(RAW_PDF_DIR, "councilors"),
    }))
    .sort(compareTargets)
}

function buildMayorTargets(): Target[] {
  const data = readJson<MayorMetaFile>("data/mayors-meta.json")
  return Object.values(data.mayors)
    .map((mayor) => ({
      category: "mayors" as const,
      name: mayor.name,
      queryNames: buildQueryNames(mayor.name),
      organization: mayor.organization,
      title: mayor.title,
      city: mayor.city,
      sourceKey: mayor.slug,
      outputDir: path.join(RAW_PDF_DIR, "mayors"),
    }))
    .sort(compareTargets)
}

function compareTargets(a: Target, b: Target): number {
  return (
    a.category.localeCompare(b.category) ||
    (a.city ?? "").localeCompare(b.city ?? "", "zh-TW") ||
    a.name.localeCompare(b.name, "zh-TW") ||
    a.sourceKey.localeCompare(b.sourceKey)
  )
}

function buildTargets(args: Args): Target[] {
  const targets = [
    ...(args.categories.has("legislators") ? buildLegislatorTargets() : []),
    ...(args.categories.has("councilors") ? buildCouncilorTargets() : []),
    ...(args.categories.has("mayors") ? buildMayorTargets() : []),
  ].filter((target) => targetMatchesNameFilter(target, args.names))

  return typeof args.limit === "number" ? targets.slice(0, args.limit) : targets
}

async function prisoPost<T>(
  endpoint: string,
  body: unknown,
  responseType: "json" | "arrayBuffer" = "json"
): Promise<Response | T> {
  const response = await fetch(`${PRISO_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      accept: responseType === "json" ? "application/json" : "*/*",
      "accept-language": "zh-TW,zh;q=0.9",
      "content-type": "application/json",
      origin: "https://priso.cy.gov.tw",
      referer: "https://priso.cy.gov.tw/layout/baselist",
      "user-agent": "legislator-wealth.tw data fetcher",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(
      `${endpoint} failed: ${response.status} ${response.statusText}`
    )
  }

  return responseType === "arrayBuffer"
    ? response
    : ((await response.json()) as T)
}

async function withRetry<T>(label: string, task: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(500 * attempt)
    }
  }
  throw new Error(
    `${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}

async function queryPrisoByName(name: string): Promise<PrisoRow[]> {
  const rows: PrisoRow[] = []
  let pageNo = 1
  let totalCount: number | undefined

  do {
    const response = await withRetry(
      `QueryData ${name} page ${pageNo}`,
      async () => {
        return (await prisoPost<PrisoResponse<PrisoQueryData>>(
          "Query/QueryData",
          {
            Data: {
              Type: "name",
              Value: name,
            },
            Page: {
              PageNo: pageNo,
              PageSize: DEFAULT_PAGE_SIZE,
              OrderByNum: 0,
              OrderBySort: "",
            },
          }
        )) as PrisoResponse<PrisoQueryData>
      }
    )

    if (!response.Success)
      throw new Error(response.Message || `PRISO query failed for ${name}`)

    rows.push(...response.Data.Data)
    totalCount = response.Data.Page.TotalCount
    pageNo += 1
  } while (totalCount && rows.length < totalCount)

  return rows
}

function rowMatchesTarget(
  row: PrisoRow,
  target: Target,
  includeOverFiveYear: boolean
): boolean {
  if (!includeOverFiveYear && row.OverFiveYear !== "N") return false

  const rowName = normalizeComparable(row.Name)
  const targetNames = target.queryNames.map((name) => normalizeComparable(name))
  const rowChineseName = extractChineseName(row.Name)
  const matchesName =
    targetNames.includes(rowName) ||
    Boolean(
      rowChineseName &&
      targetNames.includes(normalizeComparable(rowChineseName))
    )

  if (!matchesName) return false
  if (!target.organization) return true

  const rowDept = normalizeComparable(row.Dept)
  const targetDept = normalizeComparable(target.organization)
  return (
    rowDept === targetDept ||
    rowDept.includes(targetDept) ||
    targetDept.includes(rowDept)
  )
}

function parseRocPublishDate(value: string): number {
  const match = value.match(/民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/)
  if (!match) return 0
  const year = Number.parseInt(match[1], 10) + 1911
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  return Date.UTC(year, month - 1, day)
}

function rowLatestKey(row: PrisoRow): number {
  const publishDate = parseRocPublishDate(row.PublishDate)
  if (publishDate > 0) return publishDate
  const period = Number.parseInt(row.Period, 10)
  return Number.isFinite(period) ? period : 0
}

function sortPrisoRows(rows: PrisoRow[]): PrisoRow[] {
  return rows.sort((a, b) => {
    const byPublishType = a.PublishType.localeCompare(b.PublishType, "zh-TW")
    if (byPublishType !== 0) return byPublishType
    return a.PublishPage.localeCompare(b.PublishPage, "zh-TW")
  })
}

function pickLatestRowsByDate(rows: PrisoRow[]): PrisoRow[] {
  const maxKey = Math.max(...rows.map(rowLatestKey))
  return sortPrisoRows(rows.filter((row) => rowLatestKey(row) === maxKey))
}

function pickLatestRowsByPublishType(rows: PrisoRow[]): PrisoRow[] {
  const rowsByPublishType = new Map<string, PrisoRow[]>()
  for (const row of rows) {
    const key = normalizeComparable(row.PublishType || "申報")
    rowsByPublishType.set(key, [...(rowsByPublishType.get(key) ?? []), row])
  }
  return sortPrisoRows(
    Array.from(rowsByPublishType.values()).flatMap((group) =>
      pickLatestRowsByDate(group)
    )
  )
}

function pickLatestRows(rows: PrisoRow[], category: Category): PrisoRow[] {
  if (category === "mayors") return pickLatestRowsByPublishType(rows)
  return pickLatestRowsByDate(rows)
}

function parseContentDispositionFilename(
  value: string | null
): string | undefined {
  if (!value) return undefined

  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch)
    return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ""))

  const match = value.match(/filename=([^;]+)/i)
  if (!match) return undefined
  return decodeURIComponent(match[1].trim().replace(/^"|"$/g, ""))
}

function fallbackPdfName(row: PrisoRow, target: Target): string {
  const date = parseRocPublishDate(row.PublishDate)
  const datePart =
    date > 0
      ? new Date(date).toISOString().slice(0, 10)
      : `period-${row.Period}`
  const type = normalizeComparable(row.PublishType || "申報")
  const name = normalizeComparable(target.name)
  return `${name}-${datePart}-${type}-${row.Seq}.pdf`
}

function pdfNameFromPrisoRow(row: PrisoRow): string | undefined {
  if (!/^\d+$/.test(row.Period) || !/^\d+$/.test(row.Seq)) return undefined
  return `A${row.Period.padStart(4, "0")}-${row.Seq.padStart(5, "0")}.pdf`
}

async function downloadRow(
  row: PrisoRow,
  target: Target,
  args: Args
): Promise<{ file?: string; skipped?: string }> {
  if (args.dryRun) {
    const outputPath = path.join(target.outputDir, fallbackPdfName(row, target))
    return { skipped: `[dry-run] ${path.relative(process.cwd(), outputPath)}` }
  }

  const expectedFileName = pdfNameFromPrisoRow(row)
  if (expectedFileName && !args.force) {
    const expectedPath = path.join(target.outputDir, expectedFileName)
    if (fs.existsSync(expectedPath) && fs.statSync(expectedPath).size > 0) {
      return { skipped: path.relative(process.cwd(), expectedPath) }
    }
  }

  const response = (await withRetry(
    `getFile ${target.name} ${row.PublishType}`,
    async () => {
      return (await prisoPost<Response>(
        "Query/getFile",
        {
          From: "base",
          FileId: row.Id,
        },
        "arrayBuffer"
      )) as Response
    }
  )) as Response

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.startsWith("text/")) {
    throw new Error(await response.text())
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 5 || buffer.subarray(0, 4).toString("utf-8") !== "%PDF") {
    const message = buffer.toString("utf-8").slice(0, 200).trim()
    throw new Error(
      message ||
        `Downloaded content is not a PDF (${contentType || "unknown type"})`
    )
  }

  const fileName =
    parseContentDispositionFilename(
      response.headers.get("content-disposition")
    ) ?? fallbackPdfName(row, target)
  const outputPath = path.join(target.outputDir, path.basename(fileName))

  if (
    !args.force &&
    fs.existsSync(outputPath) &&
    fs.statSync(outputPath).size > 0
  ) {
    return { skipped: path.relative(process.cwd(), outputPath) }
  }

  fs.mkdirSync(target.outputDir, { recursive: true })
  fs.writeFileSync(outputPath, buffer)
  return { file: path.relative(process.cwd(), outputPath) }
}

async function processTarget(
  target: Target,
  args: Args,
  queryCache: Map<string, Promise<PrisoRow[]>>
): Promise<TargetResult> {
  try {
    const queryResults = await Promise.all(
      target.queryNames.map(async (queryName) => {
        try {
          const cacheKey = normalizeComparable(queryName)
          const existing = queryCache.get(cacheKey)
          if (existing) return { queryName, rows: await existing }
          const query = queryPrisoByName(queryName)
          queryCache.set(cacheKey, query)
          return { queryName, rows: await query }
        } catch (error) {
          return {
            queryName,
            rows: [],
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )
    const allRows = queryResults.flatMap((result) => result.rows)
    const queryErrors = queryResults.filter((result) => result.error)

    if (allRows.length === 0 && queryErrors.length > 0) {
      throw new Error(
        queryErrors
          .map((result) => `${result.queryName}: ${result.error}`)
          .join("; ")
      )
    }

    const dedupedRows = Array.from(
      new Map(allRows.map((row) => [row.Id, row])).values()
    )
    const matchingRows = dedupedRows.filter((row) =>
      rowMatchesTarget(row, target, args.includeOverFiveYear)
    )

    if (matchingRows.length === 0) {
      return {
        target,
        rows: [],
        files: [],
        skipped: [],
        missing: `no current PRISO row for ${target.name}${target.organization ? ` (${target.organization})` : ""}`,
      }
    }

    const latestRows = pickLatestRows(matchingRows, target.category)
    const files: string[] = []
    const skipped: string[] = []

    for (const row of latestRows) {
      const result = await downloadRow(row, target, args)
      if (result.file) files.push(result.file)
      if (result.skipped) skipped.push(result.skipped)
    }

    return { target, rows: latestRows, files, skipped }
  } catch (error) {
    return {
      target,
      rows: [],
      files: [],
      skipped: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const current = index
        index += 1
        results[current] = await task(items[current]!)
      }
    }
  )
  await Promise.all(workers)
  return results
}

function describeTarget(target: Target): string {
  const parts = [
    target.category,
    target.city,
    target.organization,
    target.title,
    target.name,
  ].filter(Boolean)
  return parts.join(" / ")
}

async function main() {
  const args = parseArgs()
  const targets = buildTargets(args)
  const queryCache = new Map<string, Promise<PrisoRow[]>>()

  console.log(`PRISO latest PDF fetch`)
  console.log(`Targets: ${targets.length}`)
  console.log(`Categories: ${Array.from(args.categories).join(", ")}`)
  console.log(`Output: ${path.relative(process.cwd(), RAW_PDF_DIR)}`)
  if (args.dryRun) console.log("Dry run: no PDFs will be written")

  if (targets.length === 0) return

  const results = await runWithConcurrency(
    targets,
    args.concurrency,
    async (target) => {
      const result = await processTarget(target, args, queryCache)
      const latest = result.rows
        .map(
          (row) => `${row.PublishDate} ${row.PublishType} ${row.PublishPage}`
        )
        .join(", ")

      if (result.error) {
        console.warn(`ERR ${describeTarget(target)}: ${result.error}`)
      } else if (result.missing) {
        console.warn(`- ${describeTarget(target)}: ${result.missing}`)
      } else {
        const wrote =
          result.files.length > 0 ? `${result.files.length} downloaded` : ""
        const skipped =
          result.skipped.length > 0 ? `${result.skipped.length} skipped` : ""
        console.log(
          `OK ${describeTarget(target)}: ${[wrote, skipped].filter(Boolean).join(", ")} (${latest})`
        )
      }

      return result
    }
  )

  const downloadedCount = results.reduce(
    (sum, result) => sum + result.files.length,
    0
  )
  const skippedCount = results.reduce(
    (sum, result) => sum + result.skipped.length,
    0
  )
  const missing = results.filter((result) => result.missing)
  const failed = results.filter((result) => result.error)

  console.log("")
  console.log(
    `Done. ${downloadedCount} downloaded, ${skippedCount} skipped, ${missing.length} missing, ${failed.length} failed.`
  )

  if (missing.length > 0) {
    console.log(`Missing examples:`)
    for (const result of missing.slice(0, 20))
      console.log(`  - ${describeTarget(result.target)}`)
    if (missing.length > 20) console.log(`  ... ${missing.length - 20} more`)
  }

  if (failed.length > 0) {
    console.log(`Failed examples:`)
    for (const result of failed.slice(0, 20)) {
      const message = (result.error ?? "").replace(/\s+/g, " ").slice(0, 300)
      console.log(`  - ${describeTarget(result.target)}: ${message}`)
    }
    if (failed.length > 20) console.log(`  ... ${failed.length - 20} more`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
