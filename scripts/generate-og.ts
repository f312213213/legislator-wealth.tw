import fs from "fs"
import path from "path"
import React from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
import { ImageResponse } from "next/og"
import sharp from "sharp"
import type {
  CouncilorIndex,
  DeclarationIndexEntry,
  LegislatorDeclaration,
  LegislatorIndex,
  MayorIndex,
} from "../lib/types"

const DATA_DIR = path.join(process.cwd(), "data")
const PUBLIC_DIR = path.join(process.cwd(), "public")
const OG_DIR = path.join(PUBLIC_DIR, "og")
const COUNCILOR_OG_DIR = path.join(OG_DIR, "councilors")
const MAYOR_OG_DIR = path.join(OG_DIR, "mayors")
const OG_WIDTH = 1200
const OG_HEIGHT = 630
const FONT_SANS = "Noto Sans TC"
const FONT_SERIF = "Noto Serif TC"
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource")
const h = React.createElement
type ImageResponseOptions = ConstructorParameters<typeof ImageResponse>[1]
type ImageResponseFont = NonNullable<ImageResponseOptions>["fonts"][number]
const OG_FONTS: ImageResponseFont[] = [
  {
    name: FONT_SANS,
    data: fs.readFileSync(
      path.join(
        FONT_DIR,
        "noto-sans-tc",
        "files",
        "noto-sans-tc-chinese-traditional-400-normal.woff"
      )
    ),
    weight: 400,
    style: "normal",
  },
  {
    name: FONT_SERIF,
    data: fs.readFileSync(
      path.join(
        FONT_DIR,
        "noto-serif-tc",
        "files",
        "noto-serif-tc-chinese-traditional-900-normal.woff"
      )
    ),
    weight: 900,
    style: "normal",
  },
]

function formatNTD(amount: number): string {
  return new Intl.NumberFormat("zh-TW").format(amount)
}

interface TwsePriceRow {
  Name: string
  ClosingPrice: string
}

interface TpexPriceRow {
  CompanyName: string
  Close: string
}

interface EsbPriceRow {
  CompanyName: string
  LatestPrice: string
}

function calcMarketTotal(
  decl: LegislatorDeclaration,
  priceMap: Map<string, number>
): number {
  let total = 0
  for (const s of decl.securities?.stocks?.items || []) {
    const p = priceMap.get(s.name)
    total += p ? Math.round(s.shares * p) : s.ntdTotal
  }
  for (const f of decl.securities?.funds?.items || []) {
    const p = priceMap.get(f.name)
    total += p ? Math.round(f.units * p) : f.ntdTotal
  }
  return total
}

function loadPriceMap(): Map<string, number> {
  const map = new Map<string, number>()
  try {
    const entries = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "STOCK_DAY_ALL.json"), "utf-8")
    ) as TwsePriceRow[]
    for (const e of entries) {
      const p = parseFloat(e.ClosingPrice)
      if (p && !isNaN(p)) map.set(e.Name, p)
    }
  } catch {}
  try {
    const entries = JSON.parse(
      fs.readFileSync(
        path.join(DATA_DIR, "tpex_mainboard_quotes.json"),
        "utf-8"
      )
    ) as TpexPriceRow[]
    for (const e of entries) {
      if (map.has(e.CompanyName)) continue
      const p = parseFloat(e.Close)
      if (p && !isNaN(p)) map.set(e.CompanyName, p)
    }
  } catch {}
  try {
    const entries = JSON.parse(
      fs.readFileSync(
        path.join(DATA_DIR, "tpex_esb_latest_statistics.json"),
        "utf-8"
      )
    ) as EsbPriceRow[]
    for (const e of entries) {
      if (map.has(e.CompanyName)) continue
      const p = parseFloat(e.LatestPrice)
      if (p && !isNaN(p)) map.set(e.CompanyName, p)
    }
  } catch {}
  return map
}

function div(style: CSSProperties, children?: ReactNode): ReactElement {
  return h("div", { style }, children)
}

async function imageToPng(element: ReactElement, outPath: string) {
  const response = new ImageResponse(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: OG_FONTS,
  })
  await fs.promises.writeFile(
    outPath,
    Buffer.from(await response.arrayBuffer())
  )
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch {
    return fallback
  }
}

function getDeclarationFromEntry(
  entry: DeclarationIndexEntry,
  dir: string
): LegislatorDeclaration | null {
  const [filename] = entry.declarations
  if (!filename) return null

  const declPath = path.join(dir, filename)
  if (!fs.existsSync(declPath)) return null

  return JSON.parse(fs.readFileSync(declPath, "utf-8")) as LegislatorDeclaration
}

function mergeDeclarations(
  declarations: LegislatorDeclaration[]
): LegislatorDeclaration | null {
  const [base, ...rest] = declarations
  if (!base) return null

  const stocks = declarations.flatMap((d) => d.securities.stocks.items)
  const funds = declarations.flatMap((d) => d.securities.funds.items)
  const declarationDate = declarations.reduce(
    (latest, d) => (d.declarationDate > latest ? d.declarationDate : latest),
    base.declarationDate
  )
  const stockTotal = stocks.reduce((sum, item) => sum + item.ntdTotal, 0)
  const fundTotal = funds.reduce((sum, item) => sum + item.ntdTotal, 0)
  const notes = [base.notes, ...rest.map((d) => d.notes)]
    .filter((note): note is string => Boolean(note))
    .filter((note, index, all) => all.indexOf(note) === index)

  return {
    ...base,
    declarationForm: declarations.length > 1 ? "merged" : base.declarationForm,
    declarationDate,
    securities: {
      totalNTD: stockTotal + fundTotal,
      stocks: {
        totalNTD: stockTotal,
        items: stocks,
      },
      funds: {
        totalNTD: fundTotal,
        items: funds,
      },
    },
    notes: notes.length > 0 ? notes.join("\n") : undefined,
  }
}

function declarationFormOf(
  declaration: LegislatorDeclaration
): "asset" | "trust" {
  if (declaration.declarationForm === "trust") return "trust"
  if (/信託財產申報/.test(declaration.declarationType)) return "trust"
  return "asset"
}

function latestDeclarationsByForm(
  declarations: LegislatorDeclaration[],
  form: "asset" | "trust"
): LegislatorDeclaration[] {
  const matching = declarations.filter((d) => declarationFormOf(d) === form)
  const latestDate = matching.reduce(
    (latest, d) => (d.declarationDate > latest ? d.declarationDate : latest),
    ""
  )
  return latestDate
    ? matching.filter((d) => d.declarationDate === latestDate)
    : []
}

function hasSecurityItems(declaration: LegislatorDeclaration): boolean {
  return (
    declaration.securities.stocks.items.length > 0 ||
    declaration.securities.funds.items.length > 0
  )
}

function latestMayorTrustDeclarations(
  declarations: LegislatorDeclaration[]
): LegislatorDeclaration[] {
  const trustDeclarations = declarations.filter(
    (d) => declarationFormOf(d) === "trust"
  )
  const trustWithHoldings = trustDeclarations.filter(hasSecurityItems)
  return latestDeclarationsByForm(
    trustWithHoldings.length > 0 ? trustWithHoldings : trustDeclarations,
    "trust"
  )
}

function getMergedMayorLatestDeclaration(
  entry: DeclarationIndexEntry
): LegislatorDeclaration | null {
  const declarations = entry.declarations
    .map((filename) => path.join(DATA_DIR, "mayors", filename))
    .filter((filePath) => fs.existsSync(filePath))
    .map(
      (filePath) =>
        JSON.parse(fs.readFileSync(filePath, "utf-8")) as LegislatorDeclaration
    )

  const selected = [
    ...latestDeclarationsByForm(declarations, "asset"),
    ...latestMayorTrustDeclarations(declarations),
  ].sort((a, b) => b.declarationDate.localeCompare(a.declarationDate))

  return mergeDeclarations(selected)
}

function generateSiteImage(
  title = "政治人物持股",
  subtitle = "台灣民意代表與地方首長持股資料入口",
  note = "資料來源：監察院公報與政府公開資料"
): ReactElement {
  return div(
    {
      position: "relative",
      display: "flex",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      overflow: "hidden",
      background: "#fafafa",
    },
    [
      div({
        position: "absolute",
        left: 0,
        top: 0,
        width: 6,
        height: OG_HEIGHT,
        background: "#1a1a1a",
      }),
      div(
        {
          position: "absolute",
          left: 80,
          top: 148,
          display: "flex",
          fontFamily: FONT_SERIF,
          fontSize: 96,
          fontWeight: 900,
          lineHeight: 1.05,
          color: "#1a1a1a",
          whiteSpace: "nowrap",
        },
        title
      ),
      div(
        {
          position: "absolute",
          left: 80,
          top: 300,
          display: "flex",
          fontFamily: FONT_SANS,
          fontSize: 32,
          fontWeight: 400,
          lineHeight: 1.25,
          color: "#666666",
          whiteSpace: "nowrap",
        },
        subtitle
      ),
      div(
        {
          position: "absolute",
          left: 80,
          top: 502,
          display: "flex",
          fontFamily: FONT_SANS,
          fontSize: 24,
          fontWeight: 400,
          lineHeight: 1.2,
          color: "#999999",
          whiteSpace: "nowrap",
        },
        "legislator-wealth.tw"
      ),
      div(
        {
          position: "absolute",
          left: 80,
          top: 542,
          display: "flex",
          fontFamily: FONT_SANS,
          fontSize: 20,
          fontWeight: 400,
          lineHeight: 1.2,
          color: "#bbbbbb",
          whiteSpace: "nowrap",
        },
        note
      ),
    ]
  )
}

function getNameFontSize(name: string): number {
  if (name.length <= 3) return 88
  if (name.length <= 5) return 80
  if (name.length <= 8) return 66
  return 54
}

async function generatePersonImage({
  name,
  party,
  role,
  amount,
  avatarPath,
}: {
  name: string
  party: string
  role: string
  amount: number
  avatarPath: string
}): Promise<ReactElement> {
  const amountText = amount > 0 ? `NT$ ${formatNTD(amount)}` : "未持有股票"
  const stockLabel = amount > 0 ? "股票及基金市值，以台股最新收盤價計算" : ""
  const badgeText = party || role
  const nameFontSize = getNameFontSize(name)
  const amountFontSize =
    amountText.length > 24 ? 46 : amountText.length > 20 ? 50 : 56

  const partyColors: Record<string, string> = {
    中國國民黨: "#1a5ccc",
    民主進步黨: "#1B9431",
    台灣民眾黨: "#28C8C8",
    無黨籍: "#999999",
  }
  const barColor = partyColors[party] || "#cccccc"

  const fullAvatarPath = path.join(PUBLIC_DIR, avatarPath.replace(/^\//, ""))
  let avatarDataUri = ""
  if (avatarPath && fs.existsSync(fullAvatarPath)) {
    try {
      const avatarData = await sharp(fullAvatarPath)
        .resize(240, 240, { fit: "cover" })
        .jpeg({ quality: 84 })
        .toBuffer()
      avatarDataUri = `data:image/jpeg;base64,${avatarData.toString("base64")}`
    } catch {}
  }

  const avatarElement = avatarDataUri
    ? h("img", {
        src: avatarDataUri,
        style: {
          position: "absolute",
          left: 60,
          top: 100,
          width: 240,
          height: 240,
        } satisfies CSSProperties,
      })
    : div(
        {
          position: "absolute",
          left: 60,
          top: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 240,
          height: 240,
          background: "#e5e5e5",
          color: "#999999",
          fontFamily: FONT_SERIF,
          fontSize: 80,
          fontWeight: 900,
          lineHeight: 1,
        },
        name.charAt(0)
      )

  return div(
    {
      position: "relative",
      display: "flex",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      overflow: "hidden",
      background: "#fafafa",
    },
    [
      div({
        position: "absolute",
        left: 0,
        top: 0,
        width: OG_WIDTH,
        height: 12,
        background: barColor,
      }),
      avatarElement,
      div({
        position: "absolute",
        left: 340,
        top: 155,
        width: 20,
        height: 20,
        borderRadius: 999,
        background: barColor,
      }),
      div(
        {
          position: "absolute",
          left: 370,
          top: 144,
          display: "flex",
          width: 780,
          overflow: "hidden",
          fontFamily: FONT_SANS,
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1.25,
          color: "#666666",
          whiteSpace: "nowrap",
        },
        badgeText
      ),
      div(
        {
          position: "absolute",
          left: 340,
          top: 184,
          display: "flex",
          width: 860,
          overflow: "hidden",
          fontFamily: FONT_SERIF,
          fontSize: nameFontSize,
          fontWeight: 900,
          lineHeight: 1.05,
          color: "#1a1a1a",
          whiteSpace: "nowrap",
        },
        name
      ),
      div(
        {
          position: "absolute",
          left: 340,
          top: 306,
          display: "flex",
          width: 860,
          overflow: "hidden",
          fontFamily: FONT_SANS,
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1.25,
          color: "#666666",
          whiteSpace: "nowrap",
        },
        role
      ),
      div(
        {
          position: "absolute",
          left: 340,
          top: 356,
          display: "flex",
          width: 860,
          overflow: "hidden",
          fontFamily: FONT_SANS,
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.25,
          color: "#999999",
          whiteSpace: "nowrap",
        },
        stockLabel
      ),
      div(
        {
          position: "absolute",
          left: 340,
          top: 388,
          display: "flex",
          width: 860,
          overflow: "hidden",
          fontFamily: FONT_SERIF,
          fontSize: amountFontSize,
          fontWeight: 900,
          lineHeight: 1.1,
          color: "#1a1a1a",
          whiteSpace: "nowrap",
        },
        amountText
      ),
      div(
        {
          position: "absolute",
          left: 60,
          top: 552,
          display: "flex",
          fontFamily: FONT_SANS,
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.2,
          color: "#bbbbbb",
          whiteSpace: "nowrap",
        },
        "legislator-wealth.tw"
      ),
    ]
  )
}

async function main() {
  fs.mkdirSync(OG_DIR, { recursive: true })
  fs.mkdirSync(COUNCILOR_OG_DIR, { recursive: true })
  fs.mkdirSync(MAYOR_OG_DIR, { recursive: true })

  const index = readJson<LegislatorIndex>(path.join(DATA_DIR, "index.json"), {
    legislators: [],
    lastUpdated: "",
  })
  const councilorIndex = readJson<CouncilorIndex>(
    path.join(DATA_DIR, "councilors-index.json"),
    { councilors: [], lastUpdated: "" }
  )
  const mayorIndex = readJson<MayorIndex>(
    path.join(DATA_DIR, "mayors-index.json"),
    { mayors: [], lastUpdated: "" }
  )
  const priceMap = loadPriceMap()

  let metaRaw: Record<string, { party: string; avatar: string }> = {}
  try {
    metaRaw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "legislators-meta.json"), "utf-8")
    )
  } catch {}
  const councilorMetaRaw =
    readJson<{
      councilors?: Record<
        string,
        {
          name: string
          party: string
          avatar: string
          city: string
          title: string
        }
      >
    }>(path.join(DATA_DIR, "councilors-meta.json"), {}).councilors ?? {}
  const mayorMetaRaw =
    readJson<{
      mayors?: Record<
        string,
        {
          name: string
          party: string
          avatar: string
          city: string
          title: string
        }
      >
    }>(path.join(DATA_DIR, "mayors-meta.json"), {}).mayors ?? {}

  // Site OG
  await imageToPng(generateSiteImage(), path.join(PUBLIC_DIR, "og.png"))
  console.log("Generated og.png")
  await imageToPng(
    generateSiteImage(
      "地方議員持股",
      "縣市議員財產申報、股票基金市值排行與個別明細",
      "資料來源：監察院公報與內政部地方公職人員資訊"
    ),
    path.join(OG_DIR, "councilor.png")
  )
  await imageToPng(
    generateSiteImage(
      "縣市首長持股",
      "直轄市長與縣市長財產申報、持股排行與個別明細",
      "資料來源：監察院公報與內政部地方公職人員資訊"
    ),
    path.join(OG_DIR, "mayor.png")
  )

  // Per-legislator OG
  let count = 0
  for (const leg of index.legislators) {
    if (leg.declarations.length === 0) continue
    const decl = getDeclarationFromEntry(
      leg,
      path.join(DATA_DIR, "legislators")
    )
    if (!decl) continue

    const amount = calcMarketTotal(decl, priceMap)
    const meta = metaRaw[leg.name]

    const image = await generatePersonImage({
      name: leg.name,
      party: meta?.party || "",
      role: "第十一屆立法委員",
      amount,
      avatarPath: meta?.avatar || "",
    })
    await imageToPng(image, path.join(OG_DIR, `${leg.slug}.png`))
    count++
  }

  let councilorCount = 0
  for (const councilor of councilorIndex.councilors) {
    if (councilor.declarations.length === 0) continue
    const decl = getDeclarationFromEntry(
      councilor,
      path.join(DATA_DIR, "councilors")
    )
    if (!decl) continue

    const amount = calcMarketTotal(decl, priceMap)
    const meta = councilorMetaRaw[councilor.slug]
    const city = meta?.city ?? councilor.organization.replace(/議會$/g, "")
    const title = meta?.title ?? councilor.title
    const image = await generatePersonImage({
      name: meta?.name ?? councilor.name,
      party: meta?.party || "",
      role: `${city}${title}`,
      amount,
      avatarPath: meta?.avatar || "",
    })
    await imageToPng(
      image,
      path.join(COUNCILOR_OG_DIR, `${councilor.slug}.png`)
    )
    councilorCount++
  }

  let mayorCount = 0
  for (const mayor of mayorIndex.mayors) {
    if (mayor.declarations.length === 0) continue
    const decl = getMergedMayorLatestDeclaration(mayor)
    if (!decl) continue

    const amount = calcMarketTotal(decl, priceMap)
    const meta = mayorMetaRaw[mayor.slug]
    const city = meta?.city ?? mayor.organization.replace(/政府$/g, "")
    const title = meta?.title ?? mayor.title
    const image = await generatePersonImage({
      name: meta?.name ?? mayor.name,
      party: meta?.party || "",
      role: `${city}${title}`,
      amount,
      avatarPath: meta?.avatar || "",
    })
    await imageToPng(image, path.join(MAYOR_OG_DIR, `${mayor.slug}.png`))
    mayorCount++
  }

  // Clean up old SVGs
  for (const f of fs.readdirSync(OG_DIR).filter((f) => f.endsWith(".svg"))) {
    fs.unlinkSync(path.join(OG_DIR, f))
  }
  const siteSvg = path.join(PUBLIC_DIR, "og.svg")
  if (fs.existsSync(siteSvg)) fs.unlinkSync(siteSvg)

  console.log(`Generated ${count} legislator OG images (PNG)`)
  console.log(`Generated ${councilorCount} councilor OG images (PNG)`)
  console.log(`Generated ${mayorCount} mayor OG images (PNG)`)
}

main()
