import { getAllStockHoldings, getAggregatedStocks } from '@/lib/data'
import { StockTable } from '@/components/stock-table'
import { StockPopularityChart } from '@/components/stock-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: '股票及基金 — 立委持股公開平台',
}

export default function StocksPage() {
  const holdings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()

  const topStocksChart = aggregatedStocks.slice(0, 10).map(s => ({
    name: s.name,
    count: s.holderCount,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">股票及基金持有分析</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          所有立法委員申報的股票及基金持有明細，可依標的名稱或立委姓名搜尋及排序。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">最多立委持有的標的</CardTitle>
        </CardHeader>
        <CardContent>
          {topStocksChart.length > 0 ? (
            <StockPopularityChart data={topStocksChart} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
          )}
        </CardContent>
      </Card>

      <StockTable rows={holdings} />
    </div>
  )
}
