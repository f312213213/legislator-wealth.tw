import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

const SOURCES = [
  {
    name: 'TWSE STOCK_DAY_ALL',
    url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    file: 'STOCK_DAY_ALL.json',
    requiredKeys: ['Code', 'Name', 'ClosingPrice'],
  },
  {
    name: 'TPEx mainboard quotes',
    url: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes',
    file: 'tpex_mainboard_quotes.json',
    requiredKeys: ['SecuritiesCompanyCode', 'CompanyName', 'Close'],
  },
  {
    name: 'TPEx ESB latest statistics',
    url: 'https://www.tpex.org.tw/openapi/v1/tpex_esb_latest_statistics',
    file: 'tpex_esb_latest_statistics.json',
    requiredKeys: ['SecuritiesCompanyCode', 'CompanyName', 'LatestPrice'],
  },
]

type Source = (typeof SOURCES)[number]

function hasRequiredKeys(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return keys.every((key) => typeof record[key] === 'string')
}

function validateStockData(source: Source, data: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch (error) {
    throw new Error(
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!Array.isArray(parsed)) throw new Error('expected a JSON array')
  if (parsed.length === 0) throw new Error('received an empty array')
  if (!parsed.some((row) => hasRequiredKeys(row, source.requiredKeys))) {
    throw new Error(
      `missing expected keys: ${source.requiredKeys.join(', ')}`
    )
  }
}

function hasValidExistingData(source: Source): boolean {
  try {
    validateStockData(
      source,
      fs.readFileSync(path.join(DATA_DIR, source.file), 'utf-8')
    )
    return true
  } catch {
    return false
  }
}

async function fetchSource(source: Source) {
  console.log(`Fetching ${source.name}...`)
  try {
    const res = await fetch(source.url, {
      headers: {
        accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.text()
    validateStockData(source, data)
    fs.writeFileSync(path.join(DATA_DIR, source.file), data, 'utf-8')
    console.log(`  → ${source.file}`)
  } catch (error) {
    if (hasValidExistingData(source)) {
      console.warn(`  Failed: ${error}`)
      console.warn(`  Keeping existing valid ${source.file}`)
      return
    }

    throw new Error(
      `${source.name} fetch failed and no valid existing ${source.file} is available: ${error}`
    )
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  for (const source of SOURCES) {
    await fetchSource(source)
  }

  console.log('Done!')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
