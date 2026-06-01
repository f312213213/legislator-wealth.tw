import fs from "fs"
import path from "path"
import { pinyin } from "pinyin-pro"
import { getCouncilorCitySlug } from "../lib/councilor-routes"
import type { MayorMeta, MayorMetaFile } from "../lib/types"
import { ensureOptimizedAvatar, saveOptimizedAvatar } from "./avatar-image"

const SOURCE_URL = "https://www.moi.gov.tw/LocalOfficial.aspx"
const OUTPUT_PATH = path.join(process.cwd(), "data", "mayors-meta.json")
const AVATAR_DIR = path.join(process.cwd(), "public", "avatars", "mayors")
const PAGE_SIZE = 200

interface MayorSource {
  title: string
  n: string
  typ: string
}

const SOURCES: MayorSource[] = [
  { title: "直轄市長", n: "578", typ: "KND0004" },
  { title: "縣市長", n: "579", typ: "KND0005" },
]

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
}

function normalizeText(value: string): string {
  return decodeHtml(value)
    .replace(/[\u3000\s]+/g, "")
    .trim()
}

function normalizeParty(value: string): string {
  const party = normalizeText(value)
  if (!party || party === "無") return "無黨籍"
  return party
}

function absoluteUrl(url: string): string {
  return new URL(decodeHtml(url), SOURCE_URL).toString()
}

function toSlug(name: string): string {
  return pinyin(name, { toneType: "none", separator: "-" })
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildMayorSlug(city: string, name: string): string {
  return `${getCouncilorCitySlug(city)}-${toSlug(name)}`
}

function sourceIdFromUrl(url: string): string {
  const parsed = new URL(url)
  const typ = parsed.searchParams.get("TYP") ?? ""
  const parentId = parsed.searchParams.get("_PARENT_ID") ?? url
  return `${typ}:${parentId}`
}

function pageUrl(source: MayorSource, page: number): string {
  const url = new URL(SOURCE_URL)
  url.searchParams.set("n", source.n)
  url.searchParams.set("sms", "11400")
  url.searchParams.set("TYP", source.typ)
  url.searchParams.set("PageSize", String(PAGE_SIZE))
  url.searchParams.set("page", String(page))
  return url.toString()
}

async function fetchPage(source: MayorSource, page: number): Promise<string> {
  const response = await fetch(pageUrl(source, page), {
    headers: {
      "user-agent": "legislator-wealth.tw data fetcher",
      "accept-language": "zh-TW,zh;q=0.9",
    },
  })
  if (!response.ok) {
    throw new Error(
      `MOI mayor fetch failed for ${source.title} page ${page}: ${response.status}`
    )
  }
  return response.text()
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  if (await ensureOptimizedAvatar(dest)) {
    return true
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "legislator-wealth.tw data fetcher",
      "accept-language": "zh-TW,zh;q=0.9",
    },
  })
  if (!response.ok) {
    console.warn(`  Failed to download ${url}: ${response.status}`)
    return false
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return saveOptimizedAvatar(buffer, dest, url)
}

function parseMaxPage(html: string): number {
  const pages = [
    ...html.matchAll(/href="[^"]*page=(\d+)[^"]*PageSize=200[^"]*"/g),
  ]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
  return pages.length > 0 ? Math.max(...pages) : 1
}

function parseMayors(html: string): MayorMeta[] {
  const itemRe =
    /<div class="block">[\s\S]*?<img\s+src="([^"]+)"\s+alt="([^"]*)"[^>]*\/>[\s\S]*?<div class="caption">\s*<span>([^<]+)<\/span>[\s\S]*?<div class="locate">\s*<span>([^<]+)<\/span>[\s\S]*?<div class="position">\s*<span>([^<]+)<\/span>\s*<span>([^<]+)<\/span>[\s\S]*?<div class="group">\s*<span>([^<]+)<\/span>[\s\S]*?<a href="([^"]+)"[^>]*>詳細資訊<\/a>/g
  const mayors: MayorMeta[] = []

  for (const match of html.matchAll(itemRe)) {
    const city = normalizeText(match[4])
    const name = normalizeText(match[3] || match[2])
    const organization = normalizeText(match[5])
    const title = normalizeText(match[6])
    const party = normalizeParty(match[7])
    const detailUrl = absoluteUrl(match[8])

    if (!name || !city || !organization || !title) continue

    mayors.push({
      name,
      slug: buildMayorSlug(city, name),
      city,
      organization,
      title,
      party,
      avatar: absoluteUrl(match[1]),
      detailUrl,
      sourceId: sourceIdFromUrl(detailUrl),
    })
  }

  return mayors
}

async function fetchSource(source: MayorSource): Promise<MayorMeta[]> {
  const firstPage = await fetchPage(source, 1)
  const maxPage = parseMaxPage(firstPage)
  const mayors = parseMayors(firstPage)

  for (let page = 2; page <= maxPage; page++) {
    mayors.push(...parseMayors(await fetchPage(source, page)))
  }

  return mayors
}

function dedupeMayors(mayors: MayorMeta[]): MayorMeta[] {
  const seen = new Map<string, MayorMeta>()
  for (const mayor of mayors) {
    seen.set(mayor.sourceId, mayor)
  }
  return Array.from(seen.values())
}

async function main() {
  const args = process.argv.slice(2)
  const citiesArg = args.find((arg) => arg.startsWith("--cities="))
  const requestedCities = citiesArg
    ? new Set(
        citiesArg
          .replace("--cities=", "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null

  const all = (await Promise.all(SOURCES.map(fetchSource))).flat()
  const filtered = dedupeMayors(all)
    .filter((mayor) => !requestedCities || requestedCities.has(mayor.city))
    .sort(
      (a, b) =>
        a.city.localeCompare(b.city, "zh-TW") ||
        a.name.localeCompare(b.name, "zh-TW")
    )
  const cities = Array.from(new Set(filtered.map((mayor) => mayor.city))).sort(
    (a, b) => a.localeCompare(b, "zh-TW")
  )

  const bySlug: Record<string, MayorMeta> = {}
  const slugCounts = new Map<string, number>()
  fs.mkdirSync(AVATAR_DIR, { recursive: true })
  for (const mayor of filtered) {
    const count = slugCounts.get(mayor.slug) ?? 0
    const slug = count === 0 ? mayor.slug : `${mayor.slug}-${count + 1}`
    const avatarPath = `/avatars/mayors/${slug}.jpg`
    const avatarDownloaded = await downloadImage(
      mayor.avatar,
      path.join(AVATAR_DIR, `${slug}.jpg`)
    )
    slugCounts.set(mayor.slug, count + 1)
    bySlug[slug] = {
      ...mayor,
      slug,
      avatar: avatarDownloaded ? avatarPath : mayor.avatar,
    }
  }

  const sourceUrls = SOURCES.map((source) => pageUrl(source, 1))
  const data: MayorMetaFile = {
    source: {
      title: "內政部地方公職人員資訊專區：直轄市長、縣市長",
      url: pageUrl(SOURCES[1], 1),
      urls: sourceUrls,
      fetchedAt: new Date().toISOString(),
      cities,
    },
    mayors: bySlug,
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8")

  console.log(
    `Fetched ${filtered.length} mayor(s) for ${cities.join(", ")} from MOI`
  )
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
