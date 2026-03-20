import fs from 'fs'
import path from 'path'
import { pinyin } from 'pinyin-pro'
import type { LegislatorDocument, LegislatorIndex } from '../lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const LEGISLATORS_DIR = path.join(DATA_DIR, 'legislators')

function toSlug(name: string): string {
  // Convert Chinese name to pinyin, lowercase, hyphenated
  const py = pinyin(name, { toneType: 'none', separator: '-' }).toLowerCase()
  // Clean up: only keep alphanumeric and hyphens
  return py.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
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

  for (const file of files) {
    const raw = fs.readFileSync(path.join(LEGISLATORS_DIR, file), 'utf-8')
    const doc: LegislatorDocument = JSON.parse(raw)

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
}

main()
