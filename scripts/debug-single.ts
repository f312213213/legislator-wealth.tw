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
  const text = await extractText('./test-pdfs/A0254-00054.pdf')
  const lines = text.split('\n')
  let inSection = false, count = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/3\.\s*基金/)) { inSection = true; count = 0 }
    if (inSection && count > 0 && lines[i].match(/4\.\s*其他/)) break
    if (inSection) { console.log(`${i}: ${lines[i]}`); count++; if (count > 200) break }
  }
}
main()
