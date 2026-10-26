import fs from "fs"
import path from "path"
import type { HoldingRow } from "@/components/category-tabs"
import {
  getCouncilorCityName,
  getCouncilorCitySlug,
  getCouncilorCitySlugFromOrganization,
  getCouncilorPath,
} from "./councilor-routes"
import {
  getAllCouncilorMeta,
  getCouncilorIndex,
  getIndex,
  getLegislatorMeta,
  getMayorIndex,
  getMayorMeta,
  lookupStockPrice,
} from "./data"
import { getMayorPath } from "./mayor-routes"
import type {
  CandidateAmountKey,
  CandidateDeclaration,
  CandidateElectionFile,
  CandidateSource,
} from "./types"

export const CANDIDATE_ELECTION_ID = "2026-mayor"
export const CANDIDATE_BASE_PATH = `/candidates/${CANDIDATE_ELECTION_ID}`
const CANDIDATE_PDF_BASE_PATH = `/candidate-pdfs/${CANDIDATE_ELECTION_ID}`
const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "candidates",
  `${CANDIDATE_ELECTION_ID}.json`
)

// 直轄市 → 縣 → 市 → 福建省，與中選會公告順序一致
const CITY_ORDER = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "宜蘭縣",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義縣",
  "屏東縣",
  "臺東縣",
  "花蓮縣",
  "澎湖縣",
  "基隆市",
  "新竹市",
  "嘉義市",
  "金門縣",
  "連江縣",
]

const SPECIAL_MUNICIPALITIES = new Set(CITY_ORDER.slice(0, 6))

let _election: CandidateElectionFile | null = null

export function getCandidateElection(): CandidateElectionFile {
  if (_election) return _election
  const file = JSON.parse(
    fs.readFileSync(DATA_PATH, "utf-8")
  ) as CandidateElectionFile
  // The data file keeps declared decimals; pages show whole NT$.
  for (const candidate of file.candidates) {
    for (const [key, value] of Object.entries(candidate.amounts)) {
      if (value !== null) {
        candidate.amounts[key as CandidateAmountKey] = Math.round(value)
      }
    }
  }
  _election = file
  return _election
}

const MAJOR_PARTIES = new Set(["中國國民黨", "民主進步黨"])

function partyRank(candidate: CandidateDeclaration): number {
  return MAJOR_PARTIES.has(candidate.party ?? "") ? 0 : 1
}

function compareCandidates(
  a: CandidateDeclaration,
  b: CandidateDeclaration
): number {
  return (
    CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city) ||
    partyRank(a) - partyRank(b) ||
    (a.ballotNumber ?? Infinity) - (b.ballotNumber ?? Infinity) ||
    a.name.localeCompare(b.name, "zh-TW")
  )
}

export function getAllCandidates(): CandidateDeclaration[] {
  return [...getCandidateElection().candidates].sort(compareCandidates)
}

export interface CandidateCity {
  slug: string
  name: string
  office: string
  isSpecialMunicipality: boolean
  candidates: CandidateDeclaration[]
}

export function getCandidateCities(): CandidateCity[] {
  const byCity = new Map<string, CandidateDeclaration[]>()
  for (const candidate of getAllCandidates()) {
    const list = byCity.get(candidate.city) ?? []
    list.push(candidate)
    byCity.set(candidate.city, list)
  }

  return Array.from(byCity, ([name, candidates]) => ({
    slug: getCouncilorCitySlug(name),
    name,
    office: getCandidateOffice(name),
    isSpecialMunicipality: SPECIAL_MUNICIPALITIES.has(name),
    candidates,
  }))
}

export function getCandidateCity(citySlug: string): CandidateCity | null {
  return getCandidateCities().find((city) => city.slug === citySlug) ?? null
}

export function getCandidate(
  citySlug: string,
  slug: string
): CandidateDeclaration | null {
  return (
    getCandidateCity(citySlug)?.candidates.find(
      (candidate) => candidate.slug === slug
    ) ?? null
  )
}

/** 臺北市 → 臺北市長、宜蘭縣 → 宜蘭縣長 */
export function getCandidateOffice(city: string): string {
  return `${city}長`
}

export function getCandidateCityName(citySlug: string): string | null {
  return getCouncilorCityName(citySlug)
}

export function getCandidateCityPath(citySlug: string): string {
  return `${CANDIDATE_BASE_PATH}/${citySlug}`
}

export function getCandidatePath(candidate: CandidateDeclaration): string {
  return `${getCandidateCityPath(getCouncilorCitySlug(candidate.city))}/${candidate.slug}`
}

export function getCandidateTextPdfHref(source: CandidateSource): string {
  return `${CANDIDATE_PDF_BASE_PATH}/${source.textPdf}`
}

export function getCandidateHoldings(
  candidate: CandidateDeclaration
): HoldingRow[] {
  const rows: HoldingRow[] = []
  for (const stock of candidate.stocks) {
    const price = lookupStockPrice(stock.name, "stock")
    rows.push({
      name: stock.name,
      owner: stock.owner,
      shares: stock.shares,
      ntdTotal: stock.ntd,
      source: "stock",
      currency: stock.currency ?? undefined,
      marketPrice: price?.price,
      marketValue: price ? Math.round(stock.shares * price.price) : undefined,
    })
  }
  for (const fund of candidate.funds) {
    const price = lookupStockPrice(fund.name, "fund")
    rows.push({
      name: fund.name,
      owner: fund.owner,
      shares: fund.units,
      ntdTotal: fund.ntd,
      source: "fund",
      currency: fund.currency ?? undefined,
      marketPrice: price?.price,
      marketValue: price ? Math.round(fund.units * price.price) : undefined,
    })
  }
  return rows
}

export function getCandidateMarketTotal(
  candidate: CandidateDeclaration
): number {
  return Math.round(
    getCandidateHoldings(candidate).reduce(
      (total, row) => total + (row.marketValue ?? row.ntdTotal),
      0
    )
  )
}

export function getCandidateRealEstateCount(
  candidate: CandidateDeclaration
): number {
  return (candidate.counts.land ?? 0) + (candidate.counts.buildings ?? 0)
}

/** Prefer the photo from the person's existing mayor, legislator or councilor page. */
export function getCandidateAvatar(
  candidate: CandidateDeclaration
): string | null {
  return (
    getMayorMeta(candidate.name, `${candidate.city}政府`)?.avatar ||
    getLegislatorMeta(candidate.name)?.avatar ||
    getAllCouncilorMeta().find(
      (meta) => meta.name === candidate.name && meta.city === candidate.city
    )?.avatar ||
    candidate.photo?.src ||
    null
  )
}

export interface CandidateRelatedLink {
  label: string
  href: string
}

function safeEntries<T>(read: () => T[]): T[] {
  try {
    return read()
  } catch {
    return []
  }
}

/** Links to the same person's pages elsewhere on the site (sitting mayor, legislator, councilor). */
export function getCandidateRelatedLinks(
  candidate: CandidateDeclaration
): CandidateRelatedLink[] {
  const links: CandidateRelatedLink[] = []
  const citySlug = getCouncilorCitySlug(candidate.city)

  const mayor = safeEntries(() => getMayorIndex().mayors).find(
    (entry) =>
      entry.name === candidate.name &&
      entry.declarations.length > 0 &&
      getCouncilorCitySlug(entry.organization.replace(/政府$/g, "")) ===
        citySlug
  )
  if (mayor) {
    links.push({ label: `現任${mayor.title}持股`, href: getMayorPath(mayor) })
  }

  const legislator = safeEntries(() => getIndex().legislators).find(
    (entry) => entry.name === candidate.name && entry.declarations.length > 0
  )
  if (legislator) {
    links.push({ label: "立委持股", href: `/legislator/${legislator.slug}` })
  }

  const councilor = safeEntries(() => getCouncilorIndex().councilors).find(
    (entry) =>
      entry.name === candidate.name &&
      entry.declarations.length > 0 &&
      getCouncilorCitySlugFromOrganization(entry.organization) === citySlug
  )
  if (councilor) {
    links.push({ label: "議員持股", href: getCouncilorPath(councilor) })
  }

  return links
}
