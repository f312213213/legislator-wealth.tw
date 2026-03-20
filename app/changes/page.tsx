import { getAllFlatChanges } from '@/lib/data'
import { ChangeFeed } from '@/components/change-feed'

export const metadata = {
  title: '變動紀錄 — 立委持股公開平台',
}

export default function ChangesPage() {
  const changes = getAllFlatChanges()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">變動紀錄</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          立法委員於申報期間內的股票異動紀錄，可依立委姓名或股票名稱篩選。
        </p>
      </div>

      <ChangeFeed changes={changes} />
    </div>
  )
}
