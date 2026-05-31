import fs from 'fs'
import path from 'path'
import { pinyin } from 'pinyin-pro'
import { getCouncilorCitySlugFromOrganization } from '../lib/councilor-routes'
import type { CouncilorIndex, CouncilorMetaFile, DeclarationIndexEntry, LegislatorDocument, LegislatorIndex } from '../lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const LEGISLATORS_DIR = path.join(DATA_DIR, 'legislators')
const COUNCILORS_DIR = path.join(DATA_DIR, 'councilors')
const META_PATH = path.join(DATA_DIR, 'legislators-meta.json')
const COUNCILORS_META_PATH = path.join(DATA_DIR, 'councilors-meta.json')

function toSlug(name: string): string {
  // Convert Chinese name to pinyin, lowercase, hyphenated
  const py = pinyin(name, { toneType: 'none', separator: '-' }).toLowerCase()
  // Clean up: only keep alphanumeric and hyphens
  return py.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}

function loadCurrentLegislatorNames(): Set<string> | null {
  try {
    const raw = fs.readFileSync(META_PATH, 'utf-8')
    return new Set(Object.keys(JSON.parse(raw)))
  } catch {
    console.warn(`Warning: ${path.relative(process.cwd(), META_PATH)} not found; index will include all parsed legislators`)
    return null
  }
}

function loadCurrentCouncilorMeta(): Map<string, string> | null {
  try {
    const raw = fs.readFileSync(COUNCILORS_META_PATH, 'utf-8')
    const data: CouncilorMetaFile = JSON.parse(raw)
    const map = new Map<string, string>()
    for (const meta of Object.values(data.councilors)) {
      map.set(`${meta.organization}:${meta.name}`, meta.slug)
    }
    return map
  } catch {
    console.warn(`Warning: ${path.relative(process.cwd(), COUNCILORS_META_PATH)} not found; councilor index will include all parsed councilors`)
    return null
  }
}

function buildEntries({
  documentsDir,
  keyForDoc,
  slugForDoc,
  shouldInclude,
}: {
  documentsDir: string
  keyForDoc: (doc: LegislatorDocument) => string
  slugForDoc: (doc: LegislatorDocument) => string
  shouldInclude: (doc: LegislatorDocument) => boolean
}): {
  entries: DeclarationIndexEntry[]
  fileCount: number
  skippedFileCount: number
  skippedNames: Set<string>
} {
  if (!fs.existsSync(documentsDir)) {
    return { entries: [], fileCount: 0, skippedFileCount: 0, skippedNames: new Set() }
  }

  const files = fs.readdirSync(documentsDir).filter(f => f.endsWith('.json'))
  const peopleMap = new Map<string, DeclarationIndexEntry>()
  const skippedNames = new Set<string>()
  let skippedFileCount = 0

  for (const file of files) {
    const raw = fs.readFileSync(path.join(documentsDir, file), 'utf-8')
    const doc: LegislatorDocument = JSON.parse(raw)

    if (!shouldInclude(doc)) {
      skippedNames.add(doc.name)
      skippedFileCount++
      continue
    }

    const key = keyForDoc(doc)
    const existing = peopleMap.get(key)
    if (existing) {
      if (doc.type === 'change') {
        existing.changes.push(file)
      } else {
        existing.declarations.push(file)
      }
      if (doc.declarationDate > existing.latestDeclarationDate) {
        existing.latestDeclarationDate = doc.declarationDate
        existing.organization = doc.organization
        existing.title = doc.title
      }
    } else {
      peopleMap.set(key, {
        name: doc.name,
        slug: slugForDoc(doc),
        latestDeclarationDate: doc.declarationDate,
        organization: doc.organization,
        title: doc.title,
        declarations: doc.type === 'change' ? [] : [file],
        changes: doc.type === 'change' ? [file] : [],
      })
    }
  }

  // Sort declarations newest-first so declarations[0] is the latest.
  // When dates are the same, prefer the file with more securities data.
  function declSortKey(file: string): string {
    const doc: LegislatorDocument = JSON.parse(fs.readFileSync(path.join(documentsDir, file), 'utf-8'))
    const date = doc.declarationDate || '0000-00-00'
    const total = doc.type === 'declaration' ? doc.securities.totalNTD : 0
    // Pad total to 15 digits so string comparison works (higher total = later in sort = first after reverse)
    return `${date}-${String(total).padStart(15, '0')}`
  }
  for (const leg of peopleMap.values()) {
    leg.declarations.sort((a, b) => declSortKey(b).localeCompare(declSortKey(a)))
    leg.changes.sort((a, b) => b.localeCompare(a))
  }

  // Deduplicate slugs by appending a number
  const slugCounts = new Map<string, number>()
  for (const leg of peopleMap.values()) {
    const count = slugCounts.get(leg.slug) || 0
    if (count > 0) leg.slug = `${leg.slug}-${count + 1}`
    slugCounts.set(leg.slug, count + 1)
  }

  return {
    entries: Array.from(peopleMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-TW')
    ),
    fileCount: files.length,
    skippedFileCount,
    skippedNames,
  }
}

function main() {
  if (!fs.existsSync(LEGISLATORS_DIR)) {
    console.error('No legislators directory found')
    process.exit(1)
  }

  const currentLegislatorNames = loadCurrentLegislatorNames()
  const legislatorResult = buildEntries({
    documentsDir: LEGISLATORS_DIR,
    keyForDoc: doc => doc.name,
    slugForDoc: doc => toSlug(doc.name),
    shouldInclude: doc => !currentLegislatorNames || currentLegislatorNames.has(doc.name),
  })

  const index: LegislatorIndex = {
    legislators: legislatorResult.entries,
    lastUpdated: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  )

  console.log(`Index built: ${index.legislators.length} legislators from ${legislatorResult.fileCount} files (${index.legislators.reduce((s, l) => s + l.declarations.length, 0)} declarations, ${index.legislators.reduce((s, l) => s + l.changes.length, 0)} changes)`)
  if (legislatorResult.skippedFileCount > 0) {
    console.log(`Skipped ${legislatorResult.skippedFileCount} file(s) for ${legislatorResult.skippedNames.size} non-current legislator(s): ${Array.from(legislatorResult.skippedNames).sort((a, b) => a.localeCompare(b, 'zh-TW')).join(', ')}`)
  }

  const currentCouncilorMeta = loadCurrentCouncilorMeta()
  const councilorResult = buildEntries({
    documentsDir: COUNCILORS_DIR,
    keyForDoc: doc => `${doc.organization}:${doc.name}`,
    slugForDoc: doc => currentCouncilorMeta?.get(`${doc.organization}:${doc.name}`) ?? `${getCouncilorCitySlugFromOrganization(doc.organization)}-${toSlug(doc.name)}`,
    shouldInclude: doc => !currentCouncilorMeta || currentCouncilorMeta.has(`${doc.organization}:${doc.name}`),
  })

  const councilorIndex: CouncilorIndex = {
    councilors: councilorResult.entries,
    lastUpdated: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'councilors-index.json'),
    JSON.stringify(councilorIndex, null, 2),
    'utf-8'
  )

  console.log(`Councilor index built: ${councilorIndex.councilors.length} councilors from ${councilorResult.fileCount} files (${councilorIndex.councilors.reduce((s, l) => s + l.declarations.length, 0)} declarations, ${councilorIndex.councilors.reduce((s, l) => s + l.changes.length, 0)} changes)`)
  if (councilorResult.skippedFileCount > 0) {
    console.log(`Skipped ${councilorResult.skippedFileCount} file(s) for ${councilorResult.skippedNames.size} non-current councilor(s): ${Array.from(councilorResult.skippedNames).sort((a, b) => a.localeCompare(b, 'zh-TW')).join(', ')}`)
  }
}

main()
