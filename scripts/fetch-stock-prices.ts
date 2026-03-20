import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

const SOURCES = [
  {
    name: 'TWSE STOCK_DAY_ALL',
    url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    file: 'STOCK_DAY_ALL.json',
  },
  {
    name: 'TPEx mainboard quotes',
    url: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes',
    file: 'tpex_mainboard_quotes.json',
  },
  {
    name: 'TPEx ESB latest statistics',
    url: 'https://www.tpex.org.tw/openapi/v1/tpex_esb_latest_statistics',
    file: 'tpex_esb_latest_statistics.json',
  },
]

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  for (const source of SOURCES) {
    console.log(`Fetching ${source.name}...`)
    try {
      const res = await fetch(source.url, {
        headers: {
          'accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.text()
      fs.writeFileSync(path.join(DATA_DIR, source.file), data, 'utf-8')
      console.log(`  → ${source.file}`)
    } catch (err) {
      console.error(`  Failed: ${err}`)
    }
  }

  console.log('Done!')
}

main()
