import fs from 'fs'
import path from 'path'

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
}

const ROOT_DIR = process.cwd()
const DATA_DIR = path.join(ROOT_DIR, 'data')
const RAW_PDF_DIR = path.join(ROOT_DIR, 'raw-pdfs')
const SOURCE_PDF_PATTERN = /(A\d{4}-\d{5})(?:-\d+)?\.json$/

const GROUPS: GroupConfig[] = [
  {
    label: 'legislators',
    indexPath: path.join(DATA_DIR, 'index.json'),
    indexKey: 'legislators',
    rawDir: RAW_PDF_DIR,
  },
  {
    label: 'councilors',
    indexPath: path.join(DATA_DIR, 'councilors-index.json'),
    indexKey: 'councilors',
    rawDir: path.join(RAW_PDF_DIR, 'councilors'),
  },
  {
    label: 'mayors',
    indexPath: path.join(DATA_DIR, 'mayors-index.json'),
    indexKey: 'mayors',
    rawDir: path.join(RAW_PDF_DIR, 'mayors'),
  },
]

function usage(): string {
  return [
    'Usage: tsx scripts/cleanup-stale-pdfs.ts [options]',
    '',
    'Options:',
    '  --dry-run   Print stale PDF files without deleting them.',
    '  --help      Show this help.',
    '',
    'Deletes raw PRISO PDFs that are not referenced by the generated current indexes.',
  ].join('\n')
}

function sourcePdfFilename(documentFilename: string): string | null {
  const match = documentFilename.match(SOURCE_PDF_PATTERN)
  return match ? `${match[1]}.pdf` : null
}

function readIndexEntries(config: GroupConfig): DeclarationIndexEntry[] {
  if (!fs.existsSync(config.indexPath)) {
    throw new Error(
      `Missing ${path.relative(ROOT_DIR, config.indexPath)}. Run pnpm run parse first.`
    )
  }

  const raw = fs.readFileSync(config.indexPath, 'utf-8')
  const data = JSON.parse(raw) as Record<IndexKey, DeclarationIndexEntry[]>
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

function listRawPdfs(rawDir: string): string[] {
  if (!fs.existsSync(rawDir)) return []
  return fs
    .readdirSync(rawDir)
    .filter((filename) => filename.endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b))
}

function cleanupGroup(
  config: GroupConfig,
  dryRun: boolean
): { stale: string[]; kept: number } {
  const referenced = collectReferencedPdfs(config)
  const stale = listRawPdfs(config.rawDir).filter(
    (filename) => !referenced.has(filename)
  )

  if (!dryRun) {
    for (const filename of stale) {
      fs.unlinkSync(path.join(config.rawDir, filename))
    }
  }

  return { stale, kept: referenced.size }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const dryRun = args.includes('--dry-run')
  let totalStale = 0

  if (dryRun) console.log('Dry run: no PDFs will be deleted')

  for (const config of GROUPS) {
    const { stale, kept } = cleanupGroup(config, dryRun)
    totalStale += stale.length
    const action = dryRun ? 'would delete' : 'deleted'
    console.log(
      `${config.label}: kept ${kept} referenced PDF(s), ${action} ${stale.length} stale PDF(s)`
    )

    for (const filename of stale.slice(0, 20)) {
      console.log(
        `  - ${path.relative(ROOT_DIR, path.join(config.rawDir, filename))}`
      )
    }
    if (stale.length > 20) console.log(`  ... ${stale.length - 20} more`)
  }

  console.log(
    `Done. ${dryRun ? 'Found' : 'Deleted'} ${totalStale} stale PDF(s).`
  )
}

main()
