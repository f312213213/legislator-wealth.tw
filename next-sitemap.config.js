import fs from "node:fs"
import path from "node:path"

const SITE_URL = "https://legislator-wealth.tw"
const DATA_DIR = path.join(process.cwd(), "data")

const PARTY_SLUGS = ["kmt", "dpp", "tpp", "ind"]

const COUNCILOR_CITY_SLUGS = {
  臺北市: "taipei",
  台北市: "taipei",
  新北市: "new-taipei",
  桃園市: "taoyuan",
  臺中市: "taichung",
  台中市: "taichung",
  臺南市: "tainan",
  台南市: "tainan",
  高雄市: "kaohsiung",
  基隆市: "keelung",
  新竹市: "hsinchu-city",
  嘉義市: "chiayi-city",
  新竹縣: "hsinchu-county",
  苗栗縣: "miaoli",
  彰化縣: "changhua",
  南投縣: "nantou",
  雲林縣: "yunlin",
  嘉義縣: "chiayi-county",
  屏東縣: "pingtung",
  宜蘭縣: "yilan",
  花蓮縣: "hualien",
  臺東縣: "taitung",
  台東縣: "taitung",
  澎湖縣: "penghu",
  金門縣: "kinmen",
  連江縣: "lienchiang",
}

function readJson(relativePath, fallback) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, relativePath), "utf-8")
    )
  } catch {
    return fallback
  }
}

function fallbackSlug(value) {
  const slug = value
    .toLowerCase()
    .replace(/議會$/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || encodeURIComponent(value)
}

function getCitySlug(city) {
  const normalized = city.replace(/[\u3000\s]+/g, "")
  return COUNCILOR_CITY_SLUGS[normalized] ?? fallbackSlug(normalized)
}

function getCouncilorCitySlugFromOrganization(organization) {
  return getCitySlug(organization.replace(/議會$/g, ""))
}

function getMayorCitySlugFromOrganization(organization) {
  return getCitySlug(organization.replace(/政府$/g, ""))
}

function getMemberSlug(slug, citySlug) {
  return slug.startsWith(`${citySlug}-`)
    ? slug.slice(citySlug.length + 1)
    : slug
}

function createPaths() {
  const paths = new Set([
    "/",
    "/legislator",
    "/legislator/rankings",
    "/legislator/stocks",
    "/legislator/changes",
    "/councilor",
    "/mayor",
    "/candidates/2026-mayor",
  ])

  for (const partySlug of PARTY_SLUGS) {
    paths.add(`/party/${partySlug}`)
  }

  const index = readJson("index.json", { legislators: [] })
  for (const legislator of index.legislators ?? []) {
    if ((legislator.declarations ?? []).length > 0) {
      paths.add(`/legislator/${legislator.slug}`)
    }
  }

  const councilorIndex = readJson("councilors-index.json", { councilors: [] })
  const councilorCities = new Set()
  for (const councilor of councilorIndex.councilors ?? []) {
    if ((councilor.declarations ?? []).length === 0) continue

    const citySlug = getCouncilorCitySlugFromOrganization(
      councilor.organization
    )
    const memberSlug = getMemberSlug(councilor.slug, citySlug)
    councilorCities.add(citySlug)
    paths.add(`/councilor/${citySlug}/${memberSlug}`)
  }

  for (const citySlug of councilorCities) {
    paths.add(`/councilor/${citySlug}`)
    paths.add(`/councilor/${citySlug}/rankings`)
    paths.add(`/councilor/${citySlug}/stocks`)
    paths.add(`/councilor/${citySlug}/changes`)
  }

  const mayorIndex = readJson("mayors-index.json", { mayors: [] })
  for (const mayor of mayorIndex.mayors ?? []) {
    if ((mayor.declarations ?? []).length === 0) continue

    const citySlug = getMayorCitySlugFromOrganization(mayor.organization)
    const memberSlug = getMemberSlug(mayor.slug, citySlug)
    paths.add(`/mayor/${citySlug}/${memberSlug}`)
  }

  const candidateFile = readJson("candidates/2026-mayor.json", {
    candidates: [],
  })
  for (const candidate of candidateFile.candidates ?? []) {
    const citySlug = getCitySlug(candidate.city)
    paths.add(`/candidates/2026-mayor/${citySlug}`)
    paths.add(`/candidates/2026-mayor/${citySlug}/${candidate.slug}`)
  }

  return [...paths].sort()
}

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  trailingSlash: true,
  outDir: "./out",
  exclude: [
    "/_not-found",
    "/404",
    "/api/*",
    "/legislator/[name]",
    "/party/[slug]",
    "/councilor/[city]",
    "/councilor/[city]/*",
    "/mayor/[city]/*",
    "/candidates/2026-mayor/[city]",
    "/candidates/2026-mayor/[city]/*",
  ],
  additionalPaths: async (config) => {
    const fields = await Promise.all(
      createPaths().map((urlPath) => config.transform(config, urlPath))
    )

    return fields.filter(Boolean)
  },
}

export default config
