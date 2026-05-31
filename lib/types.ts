export interface LegislatorDeclaration {
  type: 'declaration'
  name: string
  organization: string
  title: string
  declarationDate: string
  declarationType: string
  spouse?: { relation: '配偶'; name: string }
  minorChildren?: { relation: string; name: string }[]

  securities: {
    totalNTD: number
    stocks: {
      totalNTD: number
      items: {
        name: string
        owner: string
        shares: number
        parValue: number
        currency?: string
        ntdTotal: number
      }[]
    }
    funds: {
      totalNTD: number
      items: {
        name: string
        owner: string
        trustee: string
        units: number
        nav: number
        currency?: string
        ntdTotal: number
      }[]
    }
  }

  notes?: string
}

export interface ChangeDeclaration {
  type: 'change'
  name: string
  organization: string
  title: string
  declarationDate: string
  changePeriod: {
    from: string
    to: string
  }
  spouse?: { relation: '配偶'; name: string }
  minorChildren?: { relation: string; name: string }[]

  stocks?: {
    name: string
    broker: string
    owner: string
    shares: number
    changePrice: number
    changeDate: string
    changeReason: string
    total: number
  }[]

  notes?: string
}

export type LegislatorDocument = LegislatorDeclaration | ChangeDeclaration

export interface DeclarationIndexEntry {
  name: string
  slug: string
  latestDeclarationDate: string
  organization: string
  title: string
  declarations: string[]
  changes: string[]
}

export interface LegislatorIndex {
  legislators: DeclarationIndexEntry[]
  lastUpdated: string
}

export interface CouncilorIndex {
  councilors: DeclarationIndexEntry[]
  lastUpdated: string
}

export interface CouncilorMeta {
  name: string
  slug: string
  city: string
  organization: string
  title: string
  party: string
  avatar: string
  detailUrl: string
  sourceId: string
}

export interface CouncilorMetaFile {
  source: {
    title: string
    url: string
    fetchedAt: string
    cities: string[]
  }
  councilors: Record<string, CouncilorMeta>
}
