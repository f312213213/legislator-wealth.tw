/**
 * Integration tests for the PDF parser.
 *
 * Run: npx tsx scripts/test-parse.ts
 *
 * Tests parse specific PDFs and verify expected output values.
 * Add new test cases here when fixing parser bugs.
 */

import fs from 'fs'
import path from 'path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Import the parser by running it in a subprocess — we test the output JSON
const PARSE_CMD = 'npx tsx scripts/parse-pdf.ts'
const TEST_OUTPUT_DIR = path.join(process.cwd(), '.test-parse-output')

interface TestCase {
  pdf: string
  description: string
  checks: (doc: any) => string[] // returns list of errors, empty = pass
}

const tests: TestCase[] = [
  // === 牛煦庭: simple case, 1 stock, 0 funds ===
  {
    pdf: 'A0299-00013.pdf',
    description: '牛煦庭: 1 stock (崧騰), 0 funds',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '牛煦庭') errors.push(`name: expected 牛煦庭, got ${doc.name}`)
      if (doc.type !== 'declaration') errors.push(`type: expected declaration, got ${doc.type}`)
      if (doc.securities.stocks.items.length !== 1) errors.push(`stocks count: expected 1, got ${doc.securities.stocks.items.length}`)
      if (doc.securities.stocks.totalNTD !== 100000) errors.push(`stocks totalNTD: expected 100000, got ${doc.securities.stocks.totalNTD}`)
      if (doc.securities.funds.items.length !== 0) errors.push(`funds count: expected 0, got ${doc.securities.funds.items.length}`)
      const s = doc.securities.stocks.items[0]
      if (s?.name !== '崧騰') errors.push(`stock name: expected 崧騰, got ${s?.name}`)
      if (s?.owner !== '牛煦庭') errors.push(`stock owner: expected 牛煦庭, got ${s?.owner}`)
      if (s?.shares !== 10000) errors.push(`stock shares: expected 10000, got ${s?.shares}`)
      return errors
    },
  },

  // === 沈伯洋: 2 stocks, 3 funds ===
  {
    pdf: 'A0299-00124.pdf',
    description: '沈伯洋: 2 stocks, 3 funds, split NAV fix',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '沈伯洋') errors.push(`name: expected 沈伯洋, got ${doc.name}`)
      if (doc.securities.stocks.items.length !== 2) errors.push(`stocks count: expected 2, got ${doc.securities.stocks.items.length}`)
      if (doc.securities.stocks.totalNTD !== 42830) errors.push(`stocks totalNTD: expected 42830, got ${doc.securities.stocks.totalNTD}`)
      if (doc.securities.funds.items.length !== 3) errors.push(`funds count: expected 3, got ${doc.securities.funds.items.length}`)
      if (doc.securities.funds.totalNTD !== 1328310) errors.push(`funds totalNTD: expected 1328310, got ${doc.securities.funds.totalNTD}`)
      // Check fund names
      const fundNames = doc.securities.funds.items.map((f: any) => f.name)
      if (!fundNames.includes('元大台灣50')) errors.push(`missing fund: 元大台灣50`)
      if (!fundNames.includes('元大高股息')) errors.push(`missing fund: 元大高股息`)
      if (!fundNames.includes('元大台灣價值高息')) errors.push(`missing fund: 元大台灣價值高息`)
      return errors
    },
  },

  // === 林沛祥: 8 stocks (including 康霈＊), 34 funds with multi-line names ===
  {
    pdf: 'A0299-00137.pdf',
    description: '林沛祥: 8 stocks, 34 funds, complex fund names',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '林沛祥') errors.push(`name: expected 林沛祥, got ${doc.name}`)
      if (doc.securities.stocks.items.length !== 8) errors.push(`stocks count: expected 8, got ${doc.securities.stocks.items.length}`)
      if (doc.securities.stocks.totalNTD !== 46190) errors.push(`stocks totalNTD: expected 46190, got ${doc.securities.stocks.totalNTD}`)
      // 康霈＊ with full-width asterisk
      const kangpei = doc.securities.stocks.items.find((s: any) => s.name.includes('康霈'))
      if (!kangpei) errors.push(`missing stock: 康霈＊`)
      else if (kangpei.name !== '康霈＊') errors.push(`康霈 name: expected 康霈＊, got ${kangpei.name}`)
      // 英業達 split number fix (was 80, should be 2280)
      const yingye = doc.securities.stocks.items.find((s: any) => s.name === '英業達')
      if (yingye?.ntdTotal !== 2280) errors.push(`英業達 ntdTotal: expected 2280, got ${yingye?.ntdTotal}`)
      // Funds
      if (doc.securities.funds.totalNTD !== 5251070) errors.push(`funds totalNTD: expected 5251070, got ${doc.securities.funds.totalNTD}`)
      // Check specific fund names
      const fundNames = doc.securities.funds.items.map((f: any) => f.name)
      if (!fundNames.some((n: string) => n.includes('貝萊德世界科技基金（累積）（美元）')))
        errors.push(`missing fund: 貝萊德世界科技基金（累積）（美元）`)
      if (!fundNames.some((n: string) => n.includes('瑞銀（盧森堡）大中華股票基金')))
        errors.push(`missing fund: 瑞銀（盧森堡）大中華股票基金`)
      if (!fundNames.some((n: string) => n.includes('PIMCO美國股票增益基金E')))
        errors.push(`missing fund: PIMCO美國股票增益基金E`)
      // Owner with ○ (redacted child name)
      const childOwned = doc.securities.funds.items.filter((f: any) => f.owner.includes('○'))
      if (childOwned.length === 0) errors.push(`no funds owned by redacted child names (○)`)
      return errors
    },
  },

  // === 顏寬恒: 28 stocks from A0254 (the one with data) ===
  {
    pdf: 'A0254-00190.pdf',
    description: '顏寬恒: 28 stocks, split year date (1 11 → 111)',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '顏寬恒') errors.push(`name: expected 顏寬恒, got ${doc.name}`)
      if (doc.declarationDate !== '2024-03-16') errors.push(`date: expected 2024-03-16, got ${doc.declarationDate}`)
      if (doc.securities.stocks.items.length < 20) errors.push(`stocks count: expected ~28, got ${doc.securities.stocks.items.length}`)
      // Check specific stocks exist
      const stockNames = doc.securities.stocks.items.map((s: any) => s.name)
      for (const expected of ['新纖', '濱川', '鴻海', '友訊', '智微', '精材', '廣明']) {
        if (!stockNames.some((n: string) => n.includes(expected)))
          errors.push(`missing stock: ${expected}`)
      }
      return errors
    },
  },

  // === 林月琴: split owner name (蔡 宗翰 → 蔡宗翰) ===
  {
    pdf: 'A0254-00054.pdf',
    description: '林月琴: split owner name 蔡宗翰, many stocks',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '林月琴') errors.push(`name: expected 林月琴, got ${doc.name}`)
      // 台積電 should exist twice — once for 林月琴, once for 蔡宗翰
      const tsmc = doc.securities.stocks.items.filter((s: any) => s.name === '台積電')
      if (tsmc.length !== 2) errors.push(`台積電 count: expected 2, got ${tsmc.length}`)
      // 蔡宗翰's 台積電 should have correct owner (not split)
      const tsmcCai = tsmc.find((s: any) => s.owner === '蔡宗翰')
      if (!tsmcCai) {
        const owners = tsmc.map((s: any) => s.owner)
        errors.push(`台積電 蔡宗翰: not found, owners are [${owners.join(', ')}]`)
      }
      // No stock should have name "台積電 蔡" (the broken split)
      const broken = doc.securities.stocks.items.find((s: any) => s.name.includes('蔡'))
      if (broken) errors.push(`broken split: stock name "${broken.name}" contains owner surname`)
      return errors
    },
  },

  // === 李坤城 change declaration: many stock transactions ===
  {
    pdf: 'A0299-00105.pdf',
    description: '李坤城 change: 135 transactions, 存券匯撥(存)',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '李坤城') errors.push(`name: expected 李坤城, got ${doc.name}`)
      if (doc.type !== 'change') errors.push(`type: expected change, got ${doc.type}`)
      if (!doc.stocks || doc.stocks.length < 100) errors.push(`stocks count: expected ~135, got ${doc.stocks?.length || 0}`)
      // 凱基金 with 存券匯撥(存)
      const kaiji = doc.stocks?.find((s: any) => s.name === '凱基金' && s.changeReason.includes('存券匯撥'))
      if (!kaiji) errors.push(`missing: 凱基金 with 存券匯撥`)
      else if (!kaiji.changeReason.includes('(存)')) errors.push(`凱基金 reason: expected 存券匯撥(存), got ${kaiji.changeReason}`)
      // Decimal total
      if (kaiji && kaiji.total !== 532.8) errors.push(`凱基金 total: expected 532.8, got ${kaiji.total}`)
      return errors
    },
  },

  // === 呂玉玲 change: 減資轉入(存), 減資轉出(提) ===
  {
    pdf: 'A0299-00094.pdf',
    description: '呂玉玲 change: 減資轉入(存), 大同舊 vs 大同',
    checks: (doc) => {
      const errors: string[] = []
      if (doc.name !== '呂玉玲') errors.push(`name: expected 呂玉玲, got ${doc.name}`)
      if (doc.type !== 'change') errors.push(`type: expected change, got ${doc.type}`)
      if (!doc.stocks || doc.stocks.length < 100) errors.push(`stocks count: expected ~183, got ${doc.stocks?.length || 0}`)
      // 大同舊 with 減資轉入(存)
      const datongOld = doc.stocks?.find((s: any) => s.name === '大同舊' && s.changeReason.includes('減資轉入'))
      if (!datongOld) errors.push(`missing: 大同舊 with 減資轉入`)
      else if (!datongOld.changeReason.includes('(存)')) errors.push(`大同舊 reason: expected 減資轉入(存), got ${datongOld.changeReason}`)
      // All owners should be 陳萬得
      const owners = new Set(doc.stocks?.map((s: any) => s.owner))
      if (!owners.has('陳萬得')) errors.push(`missing owner: 陳萬得`)
      return errors
    },
  },
]

// --- Runner ---

import { execSync } from 'child_process'

async function main() {
  console.log('Parsing all PDFs...')

  // Clean and create test output dir
  if (fs.existsSync(TEST_OUTPUT_DIR)) fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })

  // Parse once
  try {
    execSync(`npx tsx scripts/parse-pdf.ts --input ./test-pdfs --output ${TEST_OUTPUT_DIR}`, {
      stdio: 'pipe',
    })
  } catch (e: any) {
    console.error('Parse failed:', e.stderr?.toString() || e.message)
    process.exit(1)
  }

  const outputFiles = fs.readdirSync(TEST_OUTPUT_DIR).filter(f => f.endsWith('.json'))
  console.log(`Parsed ${outputFiles.length} files.\n`)
  console.log(`Running ${tests.length} test cases...\n`)

  let passed = 0
  let failed = 0
  let skipped = 0

  for (const test of tests) {
    // Find output file matching the PDF source ID
    const sourceId = test.pdf.replace('.pdf', '')
    const matchingFile = outputFiles.find(f => f.includes(sourceId))

    if (!matchingFile) {
      console.log(`  SKIP  ${test.description} (no output for ${test.pdf})`)
      skipped++
      continue
    }

    const doc = JSON.parse(fs.readFileSync(path.join(TEST_OUTPUT_DIR, matchingFile), 'utf-8'))
    const errors = test.checks(doc)

    if (errors.length === 0) {
      console.log(`  PASS  ${test.description}`)
      passed++
    } else {
      console.log(`  FAIL  ${test.description}`)
      errors.forEach(e => console.log(`         ${e}`))
      failed++
    }
  }

  // Cleanup
  fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped, ${tests.length} total`)
  if (failed > 0) process.exit(1)
}

main()
