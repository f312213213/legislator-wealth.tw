import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://www.ly.gov.tw'
const LIST_URL = `${BASE_URL}/Pages/List.aspx?nodeid=109`
const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars')
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'legislators-meta.json')

const PARTY_MAP: Record<string, string> = {
  '中國國民黨徽章': '中國國民黨',
  '民主進步黨徽章': '民主進步黨',
  '台灣民眾黨徽章': '台灣民眾黨',
  '無徽章': '無黨籍',
}

interface LegislatorMeta {
  party: string
  avatar: string
}

function extractChineseName(fullName: string): string | null {
  // Match leading Chinese characters (CJK Unified Ideographs)
  const match = fullName.match(/^[\u4e00-\u9fff]+/)
  return match ? match[0] : null
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  Failed to download ${url}: ${res.status}`)
    return
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buffer)
}

async function main() {
  console.log('Fetching legislator list...')
  const res = await fetch(LIST_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  const html = await res.text()

  // Only parse current legislators — cut off at the "離職" section
  const resignedIdx = html.indexOf('離職')
  const activeHtml = resignedIdx > 0 ? html.slice(0, resignedIdx) : html

  // Parse legislators from HTML
  const legislators: { name: string; party: string; avatarUrl: string }[] = []

  const avatarRegex = /<img[^>]+src="(\/Images\/Legislators\/\d+\.jpg)"[^>]+alt="([^"]+)"/g
  const partyRegex = /<img[^>]+class="six-party-icon"[^>]+alt="([^"]+)"/g
  const nameRegex = /<div\s+class="legislatorname"[^>]*>([\s\S]*?)<\/div>/g

  const avatars: { src: string; alt: string }[] = []
  const parties: string[] = []
  const names: string[] = []

  let m: RegExpExecArray | null
  while ((m = avatarRegex.exec(activeHtml)) !== null) {
    avatars.push({ src: m[1], alt: m[2] })
  }
  while ((m = partyRegex.exec(activeHtml)) !== null) {
    parties.push(m[1])
  }
  while ((m = nameRegex.exec(activeHtml)) !== null) {
    names.push(m[1].replace(/\s+/g, ' ').trim())
  }

  console.log(`Found ${names.length} names, ${avatars.length} avatars, ${parties.length} parties`)

  if (names.length !== avatars.length || names.length !== parties.length) {
    console.warn('Warning: count mismatch between names, avatars, and parties')
  }

  const count = Math.min(names.length, avatars.length, parties.length)
  for (let i = 0; i < count; i++) {
    legislators.push({
      name: names[i],
      party: PARTY_MAP[parties[i]] || parties[i],
      avatarUrl: `${BASE_URL}${avatars[i].src}`,
    })
  }

  console.log(`Parsed ${legislators.length} legislators`)

  // Create avatar directory
  fs.mkdirSync(AVATAR_DIR, { recursive: true })

  // Build meta and download avatars
  const meta: Record<string, LegislatorMeta> = {}

  for (const leg of legislators) {
    const avatarPath = `/avatars/${leg.name}.jpg`
    const destFile = path.join(AVATAR_DIR, `${leg.name}.jpg`)

    console.log(`  ${leg.name} (${leg.party})`)
    await downloadImage(leg.avatarUrl, destFile)

    meta[leg.name] = { party: leg.party, avatar: avatarPath }

    // If name has non-Chinese suffix, add alias with just Chinese name
    const chineseName = extractChineseName(leg.name)
    if (chineseName && chineseName !== leg.name) {
      meta[chineseName] = { party: leg.party, avatar: avatarPath }
    }
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8')
  console.log(`\nWrote ${OUTPUT_PATH}`)
  console.log(`Done! ${legislators.length} legislators processed.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
