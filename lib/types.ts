export interface LegislatorDeclaration {
  type: "declaration"
  declarationForm?: "asset" | "trust" | "merged"
  name: string
  organization: string
  title: string
  declarationDate: string
  declarationType: string
  spouse?: { relation: "配偶"; name: string }
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
  type: "change"
  name: string
  organization: string
  title: string
  declarationDate: string
  changePeriod: {
    from: string
    to: string
  }
  spouse?: { relation: "配偶"; name: string }
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

export interface MayorIndex {
  mayors: DeclarationIndexEntry[]
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
    urls?: string[]
    fetchedAt: string
    cities: string[]
  }
  councilors: Record<string, CouncilorMeta>
}

export interface MayorMeta {
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

export interface MayorMetaFile {
  source: {
    title: string
    url: string
    urls?: string[]
    fetchedAt: string
    cities: string[]
  }
  mayors: Record<string, MayorMeta>
}

export type CandidateAmountKey =
  | "cash"
  | "deposits"
  | "securities"
  | "stocksTotal"
  | "bondsTotal"
  | "fundsTotal"
  | "otherSecuritiesTotal"
  | "valuables"
  | "virtualAssets"
  | "claims"
  | "debts"
  | "investments"
  | "trustTotal"

export type CandidateCountKey = "land" | "buildings" | "vehicles" | "insurance"

export interface CandidateSource {
  fileId: string
  url: string
  textPdf: string
  originalPages: number
  note: string
}

/** Portrait from an earlier election bulletin or official page, with its source for attribution. */
export interface CandidatePhoto {
  src: string
  credit: string
  url: string
}

export interface CandidateDeclaration {
  slug: string
  name: string
  city: string
  party: string | null
  ballotNumber: number | null
  incumbent: boolean | null
  photo: CandidatePhoto | null
  declarationDate: string | null
  submittedDate: string | null
  isCorrection: boolean
  counts: Record<CandidateCountKey, number | null>
  amounts: Record<CandidateAmountKey, number | null>
  stocks: {
    name: string
    owner: string
    shares: number
    parValue: number | null
    currency: string | null
    ntd: number
  }[]
  funds: {
    name: string
    owner: string
    trustee: string
    units: number
    nav: number | null
    currency: string | null
    ntd: number
  }[]
  /** Amounts whose printed total was blank, so the value is the sum of line items (0 = section left unfilled). */
  derived: CandidateAmountKey[]
  uncertain: string[]
  sources: CandidateSource[]
}

export interface CandidateElectionFile {
  election: {
    id: string
    title: string
    electionDate: string
    updatedAt: string
    source: { title: string; url: string }
  }
  candidates: CandidateDeclaration[]
}
