import fs from 'fs'
import path from 'path'
import { extractChineseName, normalizeComparable, personMatchKey } from '../lib/person-name'
import type { CouncilorMetaFile, LegislatorDocument, MayorMetaFile } from '../lib/types'

type IndexKey = 'legislators' | 'councilors' | 'mayors'

interface DeclarationIndexEntry {
  declarations?: string[]
  changes?: string[]
}

interface GroupConfig {
  label: string
  indexPath: string
  indexKey: IndexKey
  rawDir: string
  documentsDir: string
  /** Keys of everyone on the current officeholder list; null when the list is missing. */
  loadCurrentKeys: () => Set<string> | null
  keyForDoc: (doc: LegislatorDocument) => string
}

interface GroupResult {
  stale: string[]
  kept: number
  unparsed: string[]
  currentUnreferenced: string[]
}

const ROOT_DIR = process.cwd()
const DATA_DIR = path.join(ROOT_DIR, 'data')
const RAW_PDF_DIR = path.join(ROOT_DIR, 'raw-pdfs')
const SOURCE_PDF_PATTERN = /(A\d{4}-\d{5})(?:-\d+)?\.json$/
const DEFAULT_MAX_DELETE = 50

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function legislatorKey(name: string): string {
  return extractChineseName(name) ?? normalizeComparable(name)
}

const GROUPS: GroupConfig[] = [
  {
    label: 'legislators',
    indexPath: path.join(DATA_DIR, 'index.json'),
    indexKey: 'legislators',
    rawDir: RAW_PDF_DIR,
    documentsDir: path.join(DATA_DIR, 'legislators'),
    loadCurrentKeys: () => {
      const meta = readJsonIfExists<Record<string, unknown>>(
        path.join(DATA_DIR, 'legislators-meta.json')
      )
      return meta ? new Set(Object.keys(meta).map(legislatorKey)) : null
    },
    keyForDoc: doc => legislatorKey(doc.name),
  },
  {
    label: 'councilors',
    indexPath: path.join(DATA_DIR, 'councilors-index.json'),
    indexKey: 'councilors',
    rawDir: path.join(RAW_PDF_DIR, 'councilors'),
    documentsDir: path.join(DATA_DIR, 'councilors'),
    loadCurrentKeys: () => {
      const meta = readJsonIfExists<CouncilorMetaFile>(path.join(DATA_DIR, 'councilors-meta.json'))
      return meta
        ? new Set(Object.values(meta.councilors).map(m => personMatchKey(m.organization, m.name)))
        : null
    },
    keyForDoc: doc => personMatchKey(doc.organization, doc.name),
  },
  {
    label: 'mayors',
    indexPath: path.join(DATA_DIR, 'mayors-index.json'),
    indexKey: 'mayors',
    rawDir: path.join(RAW_PDF_DIR, 'mayors'),
    documentsDir: path.join(DATA_DIR, 'mayors'),
    loadCurrentKeys: () => {
      const meta = readJsonIfExists<MayorMetaFile>(path.join(DATA_DIR, 'mayors-meta.json'))
      return meta
        ? new Set(Object.values(meta.mayors).map(m => personMatchKey(m.organization, m.name)))
        : null
    },
    keyForDoc: doc => personMatchKey(doc.organization, doc.name),
  },
]

function usage(): string {
  return [
    'Usage: tsx scripts/cleanup-stale-pdfs.ts [options]',
    '',
    'Options:',
    '  --dry-run         Print stale PDF files without deleting them.',
    `  --max-delete=N    Refuse to delete more than N files per group (default ${DEFAULT_MAX_DELETE}).`,
    '  --help            Show this help.',
    '',
    'Deletes raw PRISO PDFs whose declarant is no longer on the current officeholder list.',
    'PDFs that could not be parsed, or that belong to a current officeholder but are not',
    'referenced by the index, are kept and reported so a matching bug cannot wipe data.',
  ].join('\n')
}

function sourcePdfFilename(documentFilename: string): string | null {
  const match = documentFilename.match(SOURCE_PDF_PATTERN)
  return match ? `${match[1]}.pdf` : null
}

function readIndexEntries(config: GroupConfig): DeclarationIndexEntry[] {
  const data = readJsonIfExists<Record<IndexKey, DeclarationIndexEntry[]>>(config.indexPath)
  if (!data) {
    throw new Error(
      `Missing ${path.relative(ROOT_DIR, config.indexPath)}. Run pnpm run parse first.`
    )
  }
  return data[config.indexKey] ?? []
}

function collectReferencedPdfs(config: GroupConfig): Set<string> {
  const referenced = new Set<string>()

  for (const entry of readIndexEntries(config)) {
    const documentFilenames = [
      ...(entry.declarations ?? []),
      ...(entry.changes ?? []),
    ]

    for (const documentFilename of documentFilenames) {
      const pdfFilename = sourcePdfFilename(documentFilename)
      if (pdfFilename) referenced.add(pdfFilename)
    }
  }

  return referenced
}

/** Person keys of every parsed document, grouped by the PDF it came from. */
function collectDeclarantsBySourcePdf(config: GroupConfig): Map<string, string[]> {
  const declarants = new Map<string, string[]>()
  if (!fs.existsSync(config.documentsDir)) return declarants

  for (const file of fs.readdirSync(config.documentsDir)) {
    const pdfFilename = sourcePdfFilename(file)
    if (!pdfFilename) continue
    const doc: LegislatorDocument = JSON.parse(
      fs.readFileSync(path.join(config.documentsDir, file), 'utf-8')
    )
    declarants.set(pdfFilename, [...(declarants.get(pdfFilename) ?? []), config.keyForDoc(doc)])
  }

  return declarants
}

function listRawPdfs(rawDir: string): string[] {
  if (!fs.existsSync(rawDir)) return []
  return fs
    .readdirSync(rawDir)
    .filter((filename) => filename.endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b))
}

function cleanupGroup(
  config: GroupConfig,
  options: { dryRun: boolean; maxDelete: number }
): GroupResult {
  const referenced = collectReferencedPdfs(config)
  const rawPdfs = listRawPdfs(config.rawDir)

  if (referenced.size === 0 && rawPdfs.length > 0) {
    throw new Error(
      `${config.label}: index references no PDFs but ${rawPdfs.length} exist; refusing to delete them all (upstream fetch likely failed)`
    )
  }

  const currentKeys = config.loadCurrentKeys()
  const declarants = collectDeclarantsBySourcePdf(config)
  const stale: string[] = []
  const unparsed: string[] = []
  const currentUnreferenced: string[] = []

  for (const filename of rawPdfs) {
    if (referenced.has(filename)) continue

    const keys = declarants.get(filename)
    if (!keys || keys.length === 0) {
      // Never delete a PDF we could not read; a parser regression is not staleness.
      unparsed.push(filename)
      continue
    }

    if (!currentKeys || keys.some((key) => currentKeys.has(key))) {
      // The declarant is a current officeholder, so the index should have
      // referenced this file. Keep it and report the mismatch instead.
      currentUnreferenced.push(filename)
      continue
    }

    stale.push(filename)
  }

  if (stale.length > options.maxDelete) {
    throw new Error(
      `${config.label}: ${stale.length} stale PDF(s) exceeds --max-delete=${options.maxDelete}; refusing to delete (check the officeholder list before raising the limit)`
    )
  }

  if (!options.dryRun) {
    for (const filename of stale) {
      fs.unlinkSync(path.join(config.rawDir, filename))
    }
  }

  return { stale, kept: referenced.size, unparsed, currentUnreferenced }
}

function listSome(label: string, rawDir: string, files: string[]) {
  if (files.length === 0) return
  console.log(`  ${label}:`)
  for (const filename of files.slice(0, 20)) {
    console.log(`  - ${path.relative(ROOT_DIR, path.join(rawDir, filename))}`)
  }
  if (files.length > 20) console.log(`  ... ${files.length - 20} more`)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const dryRun = args.includes('--dry-run')
  const maxDeleteArg = args.find((arg) => arg.startsWith('--max-delete='))
  const maxDelete = maxDeleteArg
    ? Number.parseInt(maxDeleteArg.replace('--max-delete=', ''), 10)
    : DEFAULT_MAX_DELETE
  if (!Number.isFinite(maxDelete) || maxDelete < 0) {
    throw new Error(`Invalid --max-delete value: ${maxDeleteArg}`)
  }

  let totalStale = 0

  if (dryRun) console.log('Dry run: no PDFs will be deleted')

  for (const config of GROUPS) {
    const result = cleanupGroup(config, { dryRun, maxDelete })
    totalStale += result.stale.length
    const action = dryRun ? 'would delete' : 'deleted'
    console.log(
      `${config.label}: kept ${result.kept} referenced PDF(s), ${action} ${result.stale.length} stale PDF(s), kept ${result.unparsed.length} unparsed and ${result.currentUnreferenced.length} unreferenced-but-current PDF(s)`
    )

    listSome(action, config.rawDir, result.stale)
    listSome('unparsed, kept', config.rawDir, result.unparsed)
    listSome('current officeholder but not in index, kept', config.rawDir, result.currentUnreferenced)
  }

  console.log(
    `Done. ${dryRun ? 'Found' : 'Deleted'} ${totalStale} stale PDF(s).`
  )
}

main()
