import fs from 'fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

async function main() {
  const filePath = process.argv[2] || './raw-pdfs/A0299-00137.pdf'
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const allLines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { str: string; x: number }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !(item as any).str.trim()) continue
      const y = Math.round((item as any).transform[5])
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ str: (item as any).str, x: Math.round((item as any).transform[4]) })
    }
    const sortedYs = [...rows.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const cells = rows.get(y)!.sort((a, b) => a.x - b.x)
      allLines.push(`[${y}] ` + cells.map(c => `${c.str}`).join(' | '))
    }
  }
  const text = allLines.join('\n')
  const lines = text.split('\n')
  let printing = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/股票|基金|債券|有價證券/)) printing = true
    if (line.match(/珠寶|保險/) && !line.match(/證券/)) printing = false
    if (printing) console.log(`L${i}: ${line}`)
  }
}
main()
