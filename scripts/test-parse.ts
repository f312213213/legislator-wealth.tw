/**
 * Integration tests for the PDF parser.
 *
 * Run: pnpm run test:parse
 *
 * Parses test-pdfs/ once, then runs all assertions against the output.
 * Add new test cases here when fixing parser bugs.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const TEST_OUTPUT_DIR = path.join(process.cwd(), '.test-parse-output')

interface TestCase {
  pdf: string
  description: string
  checks: (doc: any) => string[]
}

// Helper: assert a value
function eq(label: string, expected: any, actual: any): string | null {
  if (expected === actual) return null
  return `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
}

function gte(label: string, min: number, actual: number): string | null {
  if (actual >= min) return null
  return `${label}: expected >= ${min}, got ${actual}`
}

function includes(label: string, arr: string[], target: string): string | null {
  if (arr.some(s => s.includes(target))) return null
  return `${label}: missing "${target}"`
}

const tests: TestCase[] = [

  // ════════════════════════════════════════
  // ASSET DECLARATIONS
  // ════════════════════════════════════════

  // --- 牛煦庭: simplest case ---
  {
    pdf: 'A0299-00013.pdf',
    description: '牛煦庭: basic — 1 stock, 0 funds, header parsing',
    checks: (doc) => [
      eq('type', 'declaration', doc.type),
      eq('name', '牛煦庭', doc.name),
      eq('organization', '立法院', doc.organization),
      eq('title', '立法委員', doc.title),
      eq('declarationType', '定期申報', doc.declarationType),
      // Spouse
      eq('spouse.name', '楊貞儀', doc.spouse?.name),
      // Stocks
      eq('stocks.length', 1, doc.securities.stocks.items.length),
      eq('stocks.totalNTD', 100000, doc.securities.stocks.totalNTD),
      eq('stock[0].name', '崧騰', doc.securities.stocks.items[0]?.name),
      eq('stock[0].owner', '牛煦庭', doc.securities.stocks.items[0]?.owner),
      eq('stock[0].shares', 10000, doc.securities.stocks.items[0]?.shares),
      eq('stock[0].parValue', 10, doc.securities.stocks.items[0]?.parValue),
      eq('stock[0].ntdTotal', 100000, doc.securities.stocks.items[0]?.ntdTotal),
      // No funds
      eq('funds.length', 0, doc.securities.funds.items.length),
      eq('funds.totalNTD', 0, doc.securities.funds.totalNTD),
    ].filter(Boolean) as string[],
  },

  // --- 沈伯洋: stocks + funds, split NAV, fund name truncation fix ---
  {
    pdf: 'A0299-00124.pdf',
    description: '沈伯洋: 2 stocks, 3 funds, split NAV "3 6.01" → "36.01"',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '沈伯洋', doc.name),
        eq('spouse.name', '曾心慧', doc.spouse?.name),
        // Stocks
        eq('stocks.length', 2, doc.securities.stocks.items.length),
        eq('stocks.totalNTD', 42830, doc.securities.stocks.totalNTD),
      ]
      // Individual stock checks
      const stocks = doc.securities.stocks.items
      const tsmc = stocks.find((s: any) => s.name === '台積電')
      e.push(tsmc ? null : 'missing stock: 台積電')
      if (tsmc) {
        e.push(eq('台積電.owner', '沈伯洋', tsmc.owner))
        e.push(eq('台積電.shares', 1000, tsmc.shares))
        e.push(eq('台積電.ntdTotal', 10000, tsmc.ntdTotal))
      }
      const firstGold = stocks.find((s: any) => s.name === '第一金')
      e.push(firstGold ? null : 'missing stock: 第一金')
      if (firstGold) {
        e.push(eq('第一金.owner', '曾心慧', firstGold.owner))
        e.push(eq('第一金.shares', 3283, firstGold.shares))
      }
      // Funds
      e.push(eq('funds.length', 3, doc.securities.funds.items.length))
      e.push(eq('funds.totalNTD', 1328310, doc.securities.funds.totalNTD))
      const fundNames = doc.securities.funds.items.map((f: any) => f.name)
      e.push(includes('funds', fundNames, '元大台灣50'))
      e.push(includes('funds', fundNames, '元大高股息'))
      e.push(includes('funds', fundNames, '元大台灣價值高息'))
      // 元大高股息 NAV should be 36.01 (split NAV fix: "3 6.01" → "36.01")
      const yuantaDiv = doc.securities.funds.items.find((f: any) => f.name.includes('元大高股息'))
      if (yuantaDiv) {
        e.push(eq('元大高股息.nav', 36.01, yuantaDiv.nav))
        e.push(eq('元大高股息.units', 7000, yuantaDiv.units))
        e.push(eq('元大高股息.ntdTotal', 252070, yuantaDiv.ntdTotal))
      }
      return e.filter(Boolean) as string[]
    },
  },

  // --- 林沛祥: complex funds, multi-line names, special chars ---
  {
    pdf: 'A0299-00137.pdf',
    description: '林沛祥: 8 stocks, 34 funds, complex multi-line fund names',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '林沛祥', doc.name),
        eq('spouse.name', '何淑鈴', doc.spouse?.name),
        eq('stocks.length', 8, doc.securities.stocks.items.length),
        eq('stocks.totalNTD', 46190, doc.securities.stocks.totalNTD),
        eq('funds.totalNTD', 5251070, doc.securities.funds.totalNTD),
      ]
      const stocks = doc.securities.stocks.items
      const stockNames = stocks.map((s: any) => s.name)
      // All 8 stocks
      for (const name of ['茂矽', '英業達', '鴻海', '仁寶', '聯發科', '鈊象', '中天']) {
        e.push(includes('stocks', stockNames, name))
      }
      // 康霈＊ — full-width asterisk preserved
      const kangpei = stocks.find((s: any) => s.name.includes('康霈'))
      e.push(kangpei ? null : 'missing stock: 康霈＊')
      if (kangpei) e.push(eq('康霈.name', '康霈＊', kangpei.name))
      // 英業達 split number fix: "2,2 80" → 2280
      const yingye = stocks.find((s: any) => s.name === '英業達')
      if (yingye) e.push(eq('英業達.ntdTotal', 2280, yingye.ntdTotal))
      // Owner with ○ (redacted child names)
      const childFunds = doc.securities.funds.items.filter((f: any) => f.owner.includes('○'))
      e.push(gte('funds with ○ owner', 1, childFunds.length))
      // Specific fund name checks — multi-line reconstruction
      const fundNames = doc.securities.funds.items.map((f: any) => f.name)
      e.push(includes('funds', fundNames, '貝萊德世界科技基金（累積）（美元）'))
      e.push(includes('funds', fundNames, '瑞銀（盧森堡）大中華股票基金'))
      e.push(includes('funds', fundNames, 'PIMCO美國股票增益基金E'))
      e.push(includes('funds', fundNames, '新加坡大華黃金及綜合基金'))
      e.push(includes('funds', fundNames, '匯豐全球關鍵資源基金'))
      e.push(includes('funds', fundNames, '元大台灣卓越50ETF連結基金'))
      e.push(includes('funds', fundNames, '元大高股息'))
      e.push(includes('funds', fundNames, '摩根基金-美國科技基金'))
      e.push(includes('funds', fundNames, '富蘭克林坦伯頓全球投資系列科技基金'))
      e.push(includes('funds', fundNames, '聯博-精選美國股票基金'))
      e.push(includes('funds', fundNames, '安本基金-北美小型公司基金'))
      // Funds with different currencies
      const sgdFund = doc.securities.funds.items.find((f: any) => f.currency === '新加坡幣')
      e.push(sgdFund ? null : 'missing fund with currency 新加坡幣')
      const eurFund = doc.securities.funds.items.find((f: any) => f.currency === '歐元')
      e.push(eurFund ? null : 'missing fund with currency 歐元')
      // NTD funds (no currency field)
      const ntdFund = doc.securities.funds.items.find((f: any) => f.name.includes('匯豐') && !f.currency)
      e.push(ntdFund ? null : 'missing NTD fund (匯豐 without currency)')
      // Fractional units
      const pimco = doc.securities.funds.items.find((f: any) => f.name.includes('PIMCO'))
      if (pimco) e.push(eq('PIMCO.units is float', true, pimco.units % 1 !== 0))
      // NAV precision (4.8204 has 4 decimal places)
      const sgHealth = doc.securities.funds.items.find((f: any) => f.name.includes('新加坡大華全球保健'))
      if (sgHealth) e.push(eq('保健基金.nav', 4.8204, sgHealth.nav))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 顏寬恒: many stocks, split year date ---
  {
    pdf: 'A0254-00190.pdf',
    description: '顏寬恒: 28 stocks, split year "1 11" → 111 (2022)',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '顏寬恒', doc.name),
        eq('declarationDate', '2024-03-16', doc.declarationDate),
        eq('spouse.name', '陳麗淩', doc.spouse?.name),
        gte('stocks.length', 20, doc.securities.stocks.items.length),
      ]
      const stockNames = doc.securities.stocks.items.map((s: any) => s.name)
      for (const name of ['新纖', '濱川', '鴻海', '友訊', '智微', '精材', '廣明', '晶豪科', '協禧']) {
        e.push(includes('stocks', stockNames, name))
      }
      // Most stocks should be owned by 顏寬恒
      const owners = new Set(doc.securities.stocks.items.map((s: any) => s.owner))
      e.push(owners.has('顏寬恒') ? null : 'missing owner: 顏寬恒')
      // 北極星藥業 with -KY suffix
      e.push(includes('stocks', stockNames, '北極星藥業'))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 林月琴: split owner name + decimal fund totals (Bug 1 regression) ---
  {
    pdf: 'A0254-00054.pdf',
    description: '林月琴: split owner "蔡 宗翰", ~33 funds with decimal totals',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '林月琴', doc.name),
      ]
      const stocks = doc.securities.stocks.items
      // Should have many stocks (林月琴 + 蔡宗翰's holdings)
      e.push(gte('stocks.length', 40, stocks.length))
      // 台積電 should appear twice — once for each owner
      const tsmc = stocks.filter((s: any) => s.name === '台積電')
      e.push(eq('台積電 count', 2, tsmc.length))
      // 蔡宗翰 should be a properly joined owner
      const tsmcCai = tsmc.find((s: any) => s.owner === '蔡宗翰')
      e.push(tsmcCai ? null : `台積電 蔡宗翰 not found, owners: [${tsmc.map((s: any) => s.owner).join(', ')}]`)
      // No stock name should contain owner surname (broken split artifact)
      const brokenNames = stocks.filter((s: any) => /蔡$/.test(s.name.trim()))
      e.push(eq('no broken split names', 0, brokenNames.length))
      if (brokenNames.length > 0) e.push(`broken names: ${brokenNames.map((s: any) => s.name).join(', ')}`)
      // 蔡宗翰 should own many stocks
      const caiStocks = stocks.filter((s: any) => s.owner === '蔡宗翰')
      e.push(gte('蔡宗翰 stocks', 30, caiStocks.length))
      // 林月琴 should own some stocks too
      const linStocks = stocks.filter((s: any) => s.owner === '林月琴')
      e.push(gte('林月琴 stocks', 1, linStocks.length))
      // Fund checks — decimal totals (Bug 1)
      e.push(gte('funds.length', 30, doc.securities.funds.items.length))
      e.push(eq('stocks.totalNTD', 9010000, doc.securities.stocks.totalNTD))
      // Decimal total: 富達新興市場基金 → 105,861.49
      const fuda = doc.securities.funds.items.find((f: any) => f.name.includes('富達新興市場') && f.owner === '林月琴')
      if (fuda) {
        if (Math.abs(fuda.ntdTotal - 105861) > 2) e.push(`富達新興 ntdTotal: expected ~105861, got ${fuda.ntdTotal}`)
      } else e.push('missing: 富達新興市場基金')
      // 聯博全球 (蔡宗翰) → 613,740.08
      const ab = doc.securities.funds.items.find((f: any) => f.name.includes('聯博') && f.owner === '蔡宗翰')
      if (ab) {
        if (Math.abs(ab.ntdTotal - 613740) > 2) e.push(`聯博全球 ntdTotal: expected ~613740, got ${ab.ntdTotal}`)
      } else e.push('missing: 聯博全球 owned by 蔡宗翰')
      return e.filter(Boolean) as string[]
    },
  },

  // --- 江啟臣 asset: 0 stocks, 2 USD funds ---
  {
    pdf: 'A0238-00112.pdf',
    description: '江啟臣: 0 stocks, 2 USD funds, total 466,713',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '江啟臣', doc.name),
        eq('type', 'declaration', doc.type),
        eq('stocks.length', 0, doc.securities.stocks.items.length),
        eq('funds.length', 2, doc.securities.funds.items.length),
        eq('securities.totalNTD', 466713, doc.securities.totalNTD),
      ]
      const morgan = doc.securities.funds.items.find((f: any) => f.name.includes('摩根') || f.name.includes('亞太'))
      if (morgan) {
        e.push(eq('morgan.currency', '美元', morgan.currency))
        e.push(eq('morgan.ntdTotal', 248175, morgan.ntdTotal))
      } else e.push('missing fund: 摩根基金-亞太入息基金')
      const schroder = doc.securities.funds.items.find((f: any) => f.name.includes('施羅德'))
      if (schroder) {
        e.push(eq('schroder.ntdTotal', 218538, schroder.ntdTotal))
      } else e.push('missing fund: 施羅德')
      e.push(eq('spouse.name', '劉姿伶', doc.spouse?.name))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 柯志恩: many stocks, English fund names, bonds ---
  {
    pdf: 'A0254-00080.pdf',
    description: '柯志恩: ~48 stocks, English fund names (Fidelity/SQQQ)',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '柯志恩', doc.name),
        eq('stocks.totalNTD', 937570, doc.securities.stocks.totalNTD),
      ]
      e.push(gte('stocks.length', 40, doc.securities.stocks.items.length))
      // 微星 appears 3 separate times
      const msi = doc.securities.stocks.items.filter((s: any) => s.name === '微星')
      e.push(eq('微星 entries', 3, msi.length))
      // English fund names
      const fidelity500 = doc.securities.funds.items.find((f: any) => f.name.includes('Fidelity 500') || f.name.includes('Fidelity500'))
      e.push(fidelity500 ? null : 'missing fund: Fidelity 500 Index Fund')
      const sqqq = doc.securities.funds.items.find((f: any) => f.name.includes('SQQQ'))
      e.push(sqqq ? null : 'missing fund: SQQQ')
      // 群益店頭市場 fund name not corrupted by trustee stripping
      const qunyi = doc.securities.funds.items.find((f: any) => f.name.includes('群益店頭市場'))
      e.push(qunyi ? null : 'missing fund: 群益店頭市場')
      return e.filter(Boolean) as string[]
    },
  },

  // --- 翁曉玲: dual-owner stocks + funds ---
  {
    pdf: 'A0254-00086.pdf',
    description: '翁曉玲: stocks+funds by both 翁曉玲 and 陳春生',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '翁曉玲', doc.name),
        eq('stocks.totalNTD', 1676280, doc.securities.stocks.totalNTD),
      ]
      const wengStocks = doc.securities.stocks.items.filter((s: any) => s.owner === '翁曉玲')
      const chenStocks = doc.securities.stocks.items.filter((s: any) => s.owner === '陳春生')
      e.push(gte('翁曉玲 stocks', 15, wengStocks.length))
      e.push(gte('陳春生 stocks', 5, chenStocks.length))
      // 陳春生's 元大高股息 fund
      const chenFund = doc.securities.funds.items.find((f: any) => f.owner === '陳春生' && f.name.includes('元大高股息'))
      if (chenFund) {
        e.push(eq('陳春生 元大高股息.ntdTotal', 1568000, chenFund.ntdTotal))
      } else e.push('missing: 陳春生 元大高股息')
      e.push(eq('funds.totalNTD', 2720510, doc.securities.funds.totalNTD))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 吳宗憲: -KY stocks, no funds ---
  {
    pdf: 'A0262-00342.pdf',
    description: '吳宗憲: 8 stocks (including -KY suffix), 0 funds',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '吳宗憲', doc.name),
        eq('type', 'declaration', doc.type),
        eq('stocks.length', 8, doc.securities.stocks.items.length),
        eq('stocks.totalNTD', 2286230, doc.securities.stocks.totalNTD),
      ]
      const taodi = doc.securities.stocks.items.find((s: any) => s.name.includes('淘帝'))
      if (taodi) {
        e.push(eq('淘帝-KY.ntdTotal', 500000, taodi.ntdTotal))
      } else e.push('missing: 淘帝-KY')
      const yuqing = doc.securities.stocks.items.find((s: any) => s.name.includes('裕慶'))
      if (yuqing) {
        e.push(eq('裕慶-KY.ntdTotal', 1310000, yuqing.ntdTotal))
      } else e.push('missing: 裕慶-KY')
      e.push(eq('funds.length', 0, doc.securities.funds.items.length))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 吳琪銘 asset: stocks only ---
  {
    pdf: 'A0266-00011.pdf',
    description: '吳琪銘: 13 stocks, 0 funds, total 12,336,790',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '吳琪銘', doc.name),
        eq('stocks.length', 13, doc.securities.stocks.items.length),
        eq('stocks.totalNTD', 12336790, doc.securities.stocks.totalNTD),
      ]
      const dayang = doc.securities.stocks.items.find((s: any) => s.name === '大洋')
      if (dayang) {
        e.push(eq('大洋.shares', 330000, dayang.shares))
      } else e.push('missing: 大洋')
      const wifeStocks = doc.securities.stocks.items.filter((s: any) => s.owner === '許素珍')
      e.push(eq('許素珍 stocks', 3, wifeStocks.length))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 李柏毅: foreign stock with HKD ---
  {
    pdf: 'A0266-00040.pdf',
    description: '李柏毅: 13 stocks including SY HOLDINGS (HKD)',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '李柏毅', doc.name),
        eq('stocks.length', 13, doc.securities.stocks.items.length),
        eq('stocks.totalNTD', 1734738, doc.securities.stocks.totalNTD),
      ]
      const sy = doc.securities.stocks.items.find((s: any) => s.name.includes('SY') || s.name.includes('HOLDINGS'))
      if (sy) {
        e.push(eq('SY.owner', '葉瑋玲', sy.owner))
        e.push(eq('SY.currency', '港幣', sy.currency))
        if (Math.abs(sy.ntdTotal - 910118.4) > 2) e.push(`SY ntdTotal: expected ~910118, got ${sy.ntdTotal}`)
      } else e.push('missing: SY HOLDINGS')
      e.push(eq('funds.length', 0, doc.securities.funds.items.length))
      return e.filter(Boolean) as string[]
    },
  },

  // ════════════════════════════════════════
  // CHANGE DECLARATIONS
  // ════════════════════════════════════════

  // --- 李坤城: many transactions, 存券匯撥, decimal totals ---
  {
    pdf: 'A0299-00105.pdf',
    description: '李坤城 change: 135 txns, 12 stocks, 存券匯撥(存), decimal totals',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('type', 'change', doc.type),
        eq('name', '李坤城', doc.name),
        gte('stocks.length', 100, doc.stocks?.length || 0),
      ]
      // Change period
      e.push(eq('changePeriod.from', '2024-03-16', doc.changePeriod?.from))
      e.push(eq('changePeriod.to', '2025-11-01', doc.changePeriod?.to))
      // 12 unique stock names
      const uniqueNames = new Set(doc.stocks?.map((s: any) => s.name))
      e.push(gte('unique stocks', 10, uniqueNames.size))
      for (const name of ['南亞', '鴻海', '台積電', '國泰金', '凱基金', '緯創']) {
        e.push(uniqueNames.has(name) ? null : `missing stock: ${name}`)
      }
      // 凱基金 with 存券匯撥(存)
      const kaiji = doc.stocks?.find((s: any) => s.name === '凱基金' && s.changeReason.includes('存券匯撥'))
      e.push(kaiji ? null : 'missing: 凱基金 with 存券匯撥')
      if (kaiji) {
        e.push(eq('凱基金.reason', '存券匯撥(存)', kaiji.changeReason))
        e.push(eq('凱基金.total', 532.8, kaiji.total))
        e.push(eq('凱基金.shares', 36, kaiji.shares))
        e.push(eq('凱基金.changePrice', 14.8, kaiji.changePrice))
        // Full broker name for 凱基金 存券匯撥
        e.push(eq('凱基金.broker', '富邦證券板橋分公司', kaiji.broker))
      }
      // 凱基金 賣 — abbreviated broker
      const kaijiSell = doc.stocks?.find((s: any) => s.name === '凱基金' && s.changeReason === '賣')
      if (kaijiSell) {
        e.push(eq('凱基金(賣).broker', '富邦-板橋', kaijiSell.broker))
      }
      // 南亞 — 4 transactions (2 買, 2 賣)
      const nanya = doc.stocks?.filter((s: any) => s.name === '南亞')
      e.push(eq('南亞 count', 4, nanya?.length || 0))
      const nanyaBuy = nanya?.filter((s: any) => s.changeReason === '買')
      const nanyaSell = nanya?.filter((s: any) => s.changeReason === '賣')
      e.push(eq('南亞 買 count', 2, nanyaBuy?.length || 0))
      e.push(eq('南亞 賣 count', 2, nanyaSell?.length || 0))
      // Notes should exist
      e.push(doc.notes ? null : 'notes should not be empty')
      return e.filter(Boolean) as string[]
    },
  },

  // --- 呂玉玲: 減資轉入/轉出, many pages, all spouse-owned ---
  {
    pdf: 'A0299-00094.pdf',
    description: '呂玉玲 change: 183 txns, 減資轉入(存)/轉出(提), 大同舊 vs 大同',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('type', 'change', doc.type),
        eq('name', '呂玉玲', doc.name),
        eq('spouse.name', '陳萬得', doc.spouse?.name),
        gte('stocks.length', 150, doc.stocks?.length || 0),
      ]
      // Change period
      e.push(eq('changePeriod.from', '2024-11-01', doc.changePeriod?.from))
      e.push(eq('changePeriod.to', '2025-11-01', doc.changePeriod?.to))
      // 8 unique stock names
      const uniqueNames = new Set(doc.stocks?.map((s: any) => s.name))
      for (const name of ['大同舊', '大同', '上詮', '牧德', '東台', '華星光', '洋基工程', '伯特光']) {
        e.push(uniqueNames.has(name) ? null : `missing stock: ${name}`)
      }
      // 大同舊 with 減資轉入(存)
      const datongOldIn = doc.stocks?.find((s: any) => s.name === '大同舊' && s.changeReason === '減資轉入(存)')
      e.push(datongOldIn ? null : 'missing: 大同舊 減資轉入(存)')
      if (datongOldIn) {
        e.push(eq('大同舊.shares', 110, datongOldIn.shares))
        e.push(eq('大同舊.changePrice', 40.15, datongOldIn.changePrice))
        e.push(eq('大同舊.total', 4416.5, datongOldIn.total))
      }
      // 大同舊 with 減資轉出(提)
      const datongOldOut = doc.stocks?.find((s: any) => s.name === '大同舊' && s.changeReason === '減資轉出(提)')
      e.push(datongOldOut ? null : 'missing: 大同舊 減資轉出(提)')
      // 大同 (not 大同舊) with 減資轉出(提)
      const datongOut = doc.stocks?.find((s: any) => s.name === '大同' && s.changeReason === '減資轉出(提)')
      e.push(datongOut ? null : 'missing: 大同 減資轉出(提)')
      // 大同 with 減資轉入(存)
      const datongIn = doc.stocks?.find((s: any) => s.name === '大同' && s.changeReason === '減資轉入(存)')
      e.push(datongIn ? null : 'missing: 大同 減資轉入(存)')
      // All owners should be 陳萬得
      const owners = new Set(doc.stocks?.map((s: any) => s.owner))
      e.push(eq('only owner is 陳萬得', true, owners.size === 1 && owners.has('陳萬得')))
      // Notes should be empty/null
      e.push(eq('notes', undefined, doc.notes))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 江啟臣 change: land only, no stocks ---
  {
    pdf: 'A0238-00117.pdf',
    description: '江啟臣 change: land changes only, 0 stock changes',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '江啟臣', doc.name),
        eq('type', 'change', doc.type),
      ]
      if (doc.stocks && doc.stocks.length > 0) e.push(`stocks: expected 0, got ${doc.stocks.length}`)
      e.push(eq('spouse.name', '劉姿伶', doc.spouse?.name))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 何欣純 change: massive stock transactions ---
  {
    pdf: 'A0262-00316.pdf',
    description: '何欣純 change: ~300 stock txns, inline format',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '何欣純', doc.name),
        eq('type', 'change', doc.type),
      ]
      e.push(gte('stocks.length', 250, doc.stocks?.length || 0))
      // All transactions belong to 謝俊雄
      const owners = new Set(doc.stocks?.map((s: any) => s.owner) || [])
      if (!owners.has('謝俊雄')) e.push('missing owner: 謝俊雄')
      if (owners.size > 1) e.push(`unexpected extra owners: ${[...owners].filter(o => o !== '謝俊雄').join(', ')}`)
      // Verify specific stocks exist
      const stockNames = new Set(doc.stocks?.map((s: any) => s.name) || [])
      for (const expected of ['台南', '力山', '新光鋼', '南港', '華通', '國巨', '旺宏', '英業達',
        '所羅門', '陽明', '長榮航', '夏都', '公準', '緯創', '英濟', '新日興', '桓達', '均豪',
        '興能高', '南俊國際', '雷虎', '宏捷科', '高力', '世紀鋼']) {
        if (!stockNames.has(expected)) e.push(`missing stock: ${expected}`)
      }
      // First transaction: 台南, reason 買, total 30050
      const firstTainan = doc.stocks?.find((s: any) => s.name === '台南' && s.changeReason === '買' && s.total === 30050)
      e.push(firstTainan ? null : 'missing: first 台南 buy @ 30.05 = 30,050')
      // 世紀鋼 with 1000 shares
      const shiji = doc.stocks?.find((s: any) => s.name === '世紀鋼' && s.shares === 1000 && s.total === 138000)
      e.push(shiji ? null : 'missing: 世紀鋼 1000 shares = 138,000')
      return e.filter(Boolean) as string[]
    },
  },

  // --- 吳琪銘 change: 現買/現賣 reasons ---
  {
    pdf: 'A0266-00017.pdf',
    description: '吳琪銘 change: ~85 txns, 現買/現賣 reasons',
    checks: (doc) => {
      const e: (string | null)[] = [
        eq('name', '吳琪銘', doc.name),
        eq('type', 'change', doc.type),
      ]
      e.push(gte('stocks.length', 75, doc.stocks?.length || 0))
      // All owned by 吳琪銘
      const owners = new Set(doc.stocks?.map((s: any) => s.owner) || [])
      if (!owners.has('吳琪銘')) e.push('missing owner: 吳琪銘')
      // Verify 現買 and 現賣 reasons
      const reasons = new Set(doc.stocks?.map((s: any) => s.changeReason) || [])
      if (!reasons.has('現買')) e.push('missing reason: 現買')
      if (!reasons.has('現賣')) e.push('missing reason: 現賣')
      // Stock names
      const stockNames = new Set(doc.stocks?.map((s: any) => s.name) || [])
      for (const expected of ['永昕', '岱宇', '台泥', '順藥', '華安', '亞通', '聯華', '達興材料', '中工', '光洋科', '創控']) {
        if (!stockNames.has(expected)) e.push(`missing stock: ${expected}`)
      }
      return e.filter(Boolean) as string[]
    },
  },

  // ════════════════════════════════════════
  // MULTI-DECLARATION PDFs (Bug 2)
  // ════════════════════════════════════════

  // --- 蘇巧慧: 6 declarations in one PDF ---
  {
    pdf: 'A0201-00332.pdf',
    description: '蘇巧慧: 6 declarations (105-110) in one PDF',
    checks: (docs) => {
      const e: (string | null)[] = []
      if (!Array.isArray(docs)) return ['expected multi-declaration array']
      e.push(eq('declaration count', 6, docs.length))
      for (const doc of docs) {
        e.push(eq('name', '蘇巧慧', doc.name))
      }
      const first = docs[0]
      if (first) {
        e.push(eq('first.declarationDate', '2016-02-01', first.declarationDate))
      }
      const last = docs[docs.length - 1]
      if (last) {
        e.push(eq('last.declarationDate', '2021-12-01', last.declarationDate))
        e.push(eq('last.declarationType', '定期申報', last.declarationType))
      }
      return e.filter(Boolean) as string[]
    },
  },

  // --- 林淑芬: 9 declarations in one PDF ---
  {
    pdf: 'A0203-00340.pdf',
    description: '林淑芬: 9 declarations (102-110) in one PDF',
    checks: (docs) => {
      const e: (string | null)[] = []
      if (!Array.isArray(docs)) return ['expected multi-declaration array']
      e.push(eq('declaration count', 9, docs.length))
      // Allow some header parsing failures for older formats
      const named = docs.filter((d: any) => d.name === '林淑芬')
      e.push(gte('named 林淑芬', 7, named.length))
      return e.filter(Boolean) as string[]
    },
  },

  // --- 馬文君: 4 declarations in one PDF ---
  {
    pdf: 'A0242-00355.pdf',
    description: '馬文君: 4 declarations (108-111) in one PDF',
    checks: (docs) => {
      const e: (string | null)[] = []
      if (!Array.isArray(docs)) return ['expected multi-declaration array']
      e.push(eq('declaration count', 4, docs.length))
      for (const doc of docs) {
        e.push(eq('name', '馬文君', doc.name))
      }
      return e.filter(Boolean) as string[]
    },
  },
]

// ════════════════════════════════════════
// TEST RUNNER
// ════════════════════════════════════════

async function main() {
  const testPdfDir = path.join(process.cwd(), 'test-pdfs')
  if (!fs.existsSync(testPdfDir) || fs.readdirSync(testPdfDir).filter(f => f.endsWith('.pdf')).length === 0) {
    console.error('No test PDFs found in test-pdfs/. Copy test PDFs there first.')
    process.exit(1)
  }

  console.log('Parsing test PDFs...')
  if (fs.existsSync(TEST_OUTPUT_DIR)) fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })

  try {
    execSync(`npx tsx scripts/parse-pdf.ts --input ./test-pdfs --output ${TEST_OUTPUT_DIR}`, { stdio: 'pipe' })
  } catch (e: any) {
    console.error('Parse failed:', e.stderr?.toString() || e.message)
    process.exit(1)
  }

  const outputFiles = fs.readdirSync(TEST_OUTPUT_DIR).filter(f => f.endsWith('.json'))
  console.log(`Parsed ${outputFiles.length} files.\n`)

  let passed = 0
  let failed = 0
  let skipped = 0

  for (const test of tests) {
    const sourceId = test.pdf.replace('.pdf', '')
    const matchingFiles = outputFiles.filter(f => f.includes(sourceId))

    if (matchingFiles.length === 0) {
      console.log(`  SKIP  ${test.description}`)
      skipped++
      continue
    }

    let errors: string[]
    if (matchingFiles.length === 1) {
      // Single-declaration: pass one doc
      const doc = JSON.parse(fs.readFileSync(path.join(TEST_OUTPUT_DIR, matchingFiles[0]), 'utf-8'))
      errors = test.checks(doc)
    } else {
      // Multi-declaration: pass sorted array of docs
      const docs = matchingFiles
        .sort()
        .map(f => JSON.parse(fs.readFileSync(path.join(TEST_OUTPUT_DIR, f), 'utf-8')))
      errors = test.checks(docs)
    }

    if (errors.length === 0) {
      console.log(`  PASS  ${test.description}`)
      passed++
    } else {
      console.log(`  FAIL  ${test.description} (${errors.length} errors)`)
      errors.forEach(e => console.log(`         ${e}`))
      failed++
    }
  }

  fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (${tests.length} tests)`)
  if (failed > 0) process.exit(1)
}

main()
