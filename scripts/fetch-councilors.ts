import fs from 'fs'
import path from 'path'
import { pinyin } from 'pinyin-pro'
import { getCouncilorCitySlug } from '../lib/councilor-routes'
import type { CouncilorMeta, CouncilorMetaFile } from '../lib/types'

const SOURCE_URL = 'https://www.moi.gov.tw/LocalOfficial.aspx'
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'councilors-meta.json')
const PAGE_SIZE = 200

function normalizeText(value: string): string {
  return decodeHtml(value)
    .replace(/[\u3000\s]+/g, '')
    .trim()
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
}

function absoluteUrl(url: string): string {
  return new URL(decodeHtml(url), SOURCE_URL).toString()
}

function toSlug(name: string): string {
  return pinyin(name, { toneType: 'none', separator: '-' })
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildCouncilorSlug(city: string, name: string): string {
  return `${getCouncilorCitySlug(city)}-${toSlug(name)}`
}

function sourceIdFromUrl(url: string): string {
  const parsed = new URL(url)
  return parsed.searchParams.get('_PARENT_ID') ?? url
}

function pageUrl(page: number): string {
  const url = new URL(SOURCE_URL)
  url.searchParams.set('n', '573')
  url.searchParams.set('sms', '11400')
  url.searchParams.set('TYP', 'KND0001')
  url.searchParams.set('PageSize', String(PAGE_SIZE))
  url.searchParams.set('page', String(page))
  return url.toString()
}

async function fetchPage(page: number): Promise<string> {
  const response = await fetch(pageUrl(page), {
    headers: {
      'user-agent': 'legislator-wealth.tw data fetcher',
      'accept-language': 'zh-TW,zh;q=0.9',
    },
  })
  if (!response.ok) {
    throw new Error(`MOI councilor fetch failed for page ${page}: ${response.status}`)
  }
  return response.text()
}

function parseMaxPage(html: string): number {
  const pages = [...html.matchAll(/href="[^"]*page=(\d+)[^"]*PageSize=200[^"]*"/g)]
    .map(match => Number(match[1]))
    .filter(Number.isFinite)
  return pages.length > 0 ? Math.max(...pages) : 1
}

function parseCouncilors(html: string): CouncilorMeta[] {
  const itemRe = /<div class="block">[\s\S]*?<img\s+src="([^"]+)"\s+alt="([^"]*)"[^>]*\/>[\s\S]*?<div class="caption">\s*<span>([^<]+)<\/span>[\s\S]*?<div class="locate">\s*<span>([^<]+)<\/span>[\s\S]*?<div class="position">\s*<span>([^<]+)<\/span>\s*<span>([^<]+)<\/span>[\s\S]*?<div class="group">\s*<span>([^<]+)<\/span>[\s\S]*?<a href="([^"]+)"[^>]*>詳細資訊<\/a>/g
  const councilors: CouncilorMeta[] = []

  for (const match of html.matchAll(itemRe)) {
    const city = normalizeText(match[4])
    const name = normalizeText(match[3] || match[2])
    const organization = normalizeText(match[5])
    const title = normalizeText(match[6])
    const party = normalizeText(match[7])
    const detailUrl = absoluteUrl(match[8])

    if (!name || !city || !organization || !title) continue

    councilors.push({
      name,
      slug: buildCouncilorSlug(city, name),
      city,
      organization,
      title,
      party,
      avatar: absoluteUrl(match[1]),
      detailUrl,
      sourceId: sourceIdFromUrl(detailUrl),
    })
  }

  return councilors
}

function dedupeCouncilors(councilors: CouncilorMeta[]): CouncilorMeta[] {
  const seen = new Map<string, CouncilorMeta>()
  for (const councilor of councilors) {
    seen.set(councilor.sourceId, councilor)
  }
  return Array.from(seen.values())
}

async function main() {
  const args = process.argv.slice(2)
  const citiesArg = args.find(arg => arg.startsWith('--cities='))
  const cities = citiesArg
    ? citiesArg.replace('--cities=', '').split(',').map(s => s.trim()).filter(Boolean)
    : ['臺北市']

  const firstPage = await fetchPage(1)
  const maxPage = parseMaxPage(firstPage)
  const all = parseCouncilors(firstPage)

  for (let page = 2; page <= maxPage; page++) {
    all.push(...parseCouncilors(await fetchPage(page)))
  }

  const filtered = dedupeCouncilors(all)
    .filter(councilor => cities.includes(councilor.city))
    .sort((a, b) => {
      const titleRank = (title: string) => {
        if (title === '議長') return 0
        if (title === '副議長') return 1
        if (title.includes('代理')) return 2
        return 3
      }
      const byCity = a.city.localeCompare(b.city, 'zh-TW')
      if (byCity !== 0) return byCity
      const byTitle = titleRank(a.title) - titleRank(b.title)
      if (byTitle !== 0) return byTitle
      return a.name.localeCompare(b.name, 'zh-TW')
    })

  const bySlug: Record<string, CouncilorMeta> = {}
  const slugCounts = new Map<string, number>()
  for (const councilor of filtered) {
    const count = slugCounts.get(councilor.slug) ?? 0
    const slug = count === 0 ? councilor.slug : `${councilor.slug}-${count + 1}`
    slugCounts.set(councilor.slug, count + 1)
    bySlug[slug] = { ...councilor, slug }
  }

  const data: CouncilorMetaFile = {
    source: {
      title: '內政部地方公職人員資訊專區：直轄市議員',
      url: pageUrl(1),
      fetchedAt: new Date().toISOString(),
      cities,
    },
    councilors: bySlug,
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')

  console.log(`Fetched ${filtered.length} councilor(s) for ${cities.join(', ')} from MOI`)
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
