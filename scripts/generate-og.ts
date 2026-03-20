import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { LegislatorIndex } from '../lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const OG_DIR = path.join(PUBLIC_DIR, 'og')

function formatNTD(amount: number): string {
  return new Intl.NumberFormat('zh-TW').format(amount)
}

function calcMarketTotal(decl: any, priceMap: Map<string, number>): number {
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
    const entries: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'STOCK_DAY_ALL.json'), 'utf-8'))
    for (const e of entries) {
      const p = parseFloat(e.ClosingPrice)
      if (p && !isNaN(p)) map.set(e.Name, p)
    }
  } catch {}
  try {
    const entries: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tpex_mainboard_quotes.json'), 'utf-8'))
    for (const e of entries) {
      if (map.has(e.CompanyName)) continue
      const p = parseFloat(e.Close)
      if (p && !isNaN(p)) map.set(e.CompanyName, p)
    }
  } catch {}
  try {
    const entries: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tpex_esb_latest_statistics.json'), 'utf-8'))
    for (const e of entries) {
      if (map.has(e.CompanyName)) continue
      const p = parseFloat(e.LatestPrice)
      if (p && !isNaN(p)) map.set(e.CompanyName, p)
    }
  } catch {}
  return map
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function svgToPng(svg: string, outPath: string) {
  await sharp(Buffer.from(svg)).png().toFile(outPath)
}

function generateSiteSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fafafa"/>
  <rect x="0" y="0" width="6" height="630" fill="#1a1a1a"/>
  <text x="80" y="240" font-family="serif" font-size="96" font-weight="900" fill="#1a1a1a">立委持股</text>
  <text x="80" y="320" font-family="sans-serif" font-size="32" fill="#666666">台灣立法委員股票及基金申報資料公開透明平台</text>
  <text x="80" y="520" font-family="sans-serif" font-size="24" fill="#999999">legislator-wealth.tw</text>
  <text x="80" y="560" font-family="sans-serif" font-size="20" fill="#bbbbbb">資料來源：監察院公報</text>
</svg>`
}

function generateLegislatorSvg(name: string, party: string, amount: number, avatarPath: string): string {
  const amountText = amount > 0 ? `NT$ ${formatNTD(amount)}` : '未持有股票'
  const stockLabel = amount > 0 ? '股票及基金市值' : ''

  const partyColors: Record<string, string> = {
    '中國國民黨': '#000099',
    '民主進步黨': '#1B9431',
    '台灣民眾黨': '#28C8C8',
    '無黨籍': '#999999',
  }
  const barColor = partyColors[party] || '#cccccc'

  const fullAvatarPath = path.join(PUBLIC_DIR, avatarPath.replace(/^\//, ''))
  let avatarEmbed = ''
  if (avatarPath && fs.existsSync(fullAvatarPath)) {
    const avatarData = fs.readFileSync(fullAvatarPath)
    const b64 = avatarData.toString('base64')
    const ext = avatarPath.endsWith('.png') ? 'png' : 'jpeg'
    avatarEmbed = `<image x="60" y="100" width="240" height="240" href="data:image/${ext};base64,${b64}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="avatarClip"><rect x="60" y="100" width="240" height="240"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#fafafa"/>
  <!-- Bold top band -->
  <rect x="0" y="0" width="1200" height="12" fill="${barColor}"/>
  <!-- Avatar -->
  ${avatarEmbed || `<rect x="60" y="100" width="240" height="240" fill="#e5e5e5"/><text x="180" y="245" font-family="serif" font-size="80" font-weight="900" fill="#999" text-anchor="middle">${escapeXml(name.charAt(0))}</text>`}
  <!-- Party color dot -->
  <circle cx="350" cy="165" r="10" fill="${barColor}"/>
  <text x="370" y="175" font-family="sans-serif" font-size="28" fill="#666666">${escapeXml(party)}</text>
  <!-- Name -->
  <text x="340" y="260" font-family="serif" font-size="80" font-weight="900" fill="#1a1a1a">${escapeXml(name)}</text>
  <!-- Amount -->
  <text x="340" y="380" font-family="sans-serif" font-size="22" fill="#999999">${escapeXml(stockLabel)}</text>
  <text x="340" y="440" font-family="serif" font-size="56" font-weight="900" fill="#1a1a1a">${escapeXml(amountText)}</text>
  <!-- Site -->
  <text x="60" y="580" font-family="sans-serif" font-size="22" fill="#bbbbbb">legislator-wealth.tw</text>
</svg>`
}

async function main() {
  fs.mkdirSync(OG_DIR, { recursive: true })

  const index: LegislatorIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf-8'))
  const priceMap = loadPriceMap()

  let metaRaw: Record<string, { party: string; avatar: string }> = {}
  try {
    metaRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'legislators-meta.json'), 'utf-8'))
  } catch {}

  // Site OG
  await svgToPng(generateSiteSvg(), path.join(PUBLIC_DIR, 'og.png'))
  console.log('Generated og.png')

  // Per-legislator OG
  let count = 0
  for (const leg of index.legislators) {
    if (leg.declarations.length === 0) continue
    const declPath = path.join(DATA_DIR, 'legislators', leg.declarations[0])
    if (!fs.existsSync(declPath)) continue

    const decl = JSON.parse(fs.readFileSync(declPath, 'utf-8'))
    const amount = calcMarketTotal(decl, priceMap)
    const meta = metaRaw[leg.name]

    const svg = generateLegislatorSvg(leg.name, meta?.party || '', amount, meta?.avatar || '')
    await svgToPng(svg, path.join(OG_DIR, `${leg.slug}.png`))
    count++
  }

  // Clean up old SVGs
  for (const f of fs.readdirSync(OG_DIR).filter(f => f.endsWith('.svg'))) {
    fs.unlinkSync(path.join(OG_DIR, f))
  }
  const siteSvg = path.join(PUBLIC_DIR, 'og.svg')
  if (fs.existsSync(siteSvg)) fs.unlinkSync(siteSvg)

  console.log(`Generated ${count} legislator OG images (PNG)`)
}

main()
