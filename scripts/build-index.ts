import fs from 'fs'
import path from 'path'
import { pinyin } from 'pinyin-pro'
import type { LegislatorDocument, LegislatorIndex } from '../lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const LEGISLATORS_DIR = path.join(DATA_DIR, 'legislators')
const META_PATH = path.join(DATA_DIR, 'legislators-meta.json')

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

function main() {
  if (!fs.existsSync(LEGISLATORS_DIR)) {
    console.error('No legislators directory found')
    process.exit(1)
  }

  const files = fs.readdirSync(LEGISLATORS_DIR).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.log('No JSON files found')
    return
  }

  const legislatorMap = new Map<string, {
    name: string
    slug: string
    latestDeclarationDate: string
    organization: string
    title: string
    declarations: string[]
    changes: string[]
  }>()
  const currentLegislatorNames = loadCurrentLegislatorNames()
  const skippedNames = new Set<string>()
  let skippedFileCount = 0

  for (const file of files) {
    const raw = fs.readFileSync(path.join(LEGISLATORS_DIR, file), 'utf-8')
    const doc: LegislatorDocument = JSON.parse(raw)

    if (currentLegislatorNames && !currentLegislatorNames.has(doc.name)) {
      skippedNames.add(doc.name)
      skippedFileCount++
      continue
    }

    const existing = legislatorMap.get(doc.name)
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
      legislatorMap.set(doc.name, {
        name: doc.name,
        slug: toSlug(doc.name),
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
    const doc: LegislatorDocument = JSON.parse(fs.readFileSync(path.join(LEGISLATORS_DIR, file), 'utf-8'))
    const date = doc.declarationDate || '0000-00-00'
    const total = doc.type === 'declaration' ? doc.securities.totalNTD : 0
    // Pad total to 15 digits so string comparison works (higher total = later in sort = first after reverse)
    return `${date}-${String(total).padStart(15, '0')}`
  }
  for (const leg of legislatorMap.values()) {
    leg.declarations.sort((a, b) => declSortKey(b).localeCompare(declSortKey(a)))
    leg.changes.sort((a, b) => b.localeCompare(a))
  }

  // Deduplicate slugs by appending a number
  const slugCounts = new Map<string, number>()
  for (const leg of legislatorMap.values()) {
    const count = slugCounts.get(leg.slug) || 0
    if (count > 0) leg.slug = `${leg.slug}-${count + 1}`
    slugCounts.set(leg.slug, count + 1)
  }

  const index: LegislatorIndex = {
    legislators: Array.from(legislatorMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-TW')
    ),
    lastUpdated: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  )

  console.log(`Index built: ${index.legislators.length} legislators from ${files.length} files (${index.legislators.reduce((s, l) => s + l.declarations.length, 0)} declarations, ${index.legislators.reduce((s, l) => s + l.changes.length, 0)} changes)`)
  if (skippedFileCount > 0) {
    console.log(`Skipped ${skippedFileCount} file(s) for ${skippedNames.size} non-current legislator(s): ${Array.from(skippedNames).sort((a, b) => a.localeCompare(b, 'zh-TW')).join(', ')}`)
  }
}

main()
