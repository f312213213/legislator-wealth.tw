import fs from 'fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

async function extractText(filePath: string): Promise<string> {
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
      allLines.push(cells.map(c => c.str).join(' '))
    }
  }
  return allLines.join('\n')
}

async function main() {
  const pdfs = [
    'A0238-00112.pdf',  // 江啟臣
    'A0254-00080.pdf',  // 柯志恩
    'A0254-00086.pdf',  // 翁曉玲
    'A0262-00342.pdf',  // 吳宗憲
    'A0266-00011.pdf',  // 吳琪銘
    'A0266-00040.pdf',  // 李柏毅
  ]

  for (const pdf of pdfs) {
    const text = await extractText(`./test-pdfs/${pdf}`)
    const lines = text.split('\n')
    console.log(`\n${'='.repeat(80)}`)
    console.log(`PDF: ${pdf}`)
    console.log('='.repeat(80))

    let inSection = false
    let count = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/[（(]\s*八\s*[）)]/)) { inSection = true; count = 0 }
      if (inSection && count > 0 && lines[i].match(/[（(]\s*(九|十)\s*[）)]/)) break
      if (inSection) { console.log(`${i}: ${lines[i]}`); count++; if (count > 200) break }
    }
  }
}
main()
