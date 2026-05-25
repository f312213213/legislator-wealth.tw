/* global Response, URL */

const PARTY_SLUG_TO_NAME = {
  kmt: '中國國民黨',
  dpp: '民主進步黨',
  tpp: '台灣民眾黨',
  ind: '無黨籍',
}

const SEARCH_ALIASES = {
  民進黨: '民主進步黨',
}

const MAX_DETAILED_RESULTS = 5

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, init = {}) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...CORS_HEADERS,
      ...init.headers,
    },
  })
}

function empty(init = {}) {
  return new Response(null, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...init.headers,
    },
  })
}

function listParams(searchParams, names) {
  return names
    .flatMap(name => searchParams.getAll(name))
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
}

function normalizeParty(value) {
  return PARTY_SLUG_TO_NAME[value.toLowerCase()] || value
}

function includesText(value, query) {
  return String(value || '').toLowerCase().includes(query)
}

function toSummary(legislator) {
  return {
    name: legislator.name,
    slug: legislator.slug,
    party: legislator.meta?.party || null,
    avatar: legislator.meta?.avatar || null,
    organization: legislator.organization,
    title: legislator.title,
    latestDeclarationDate: legislator.latestDeclarationDate,
    declarationCount: legislator.declarationCount,
    changeCount: legislator.changeCount,
    stockSummary: legislator.stockSummary || {
      holdingCount: 0,
      stockCount: 0,
      fundCount: 0,
      declaredValueTotal: 0,
      estimatedMarketValueTotal: 0,
      pricedHoldingCount: 0,
    },
    holdings: legislator.holdings || [],
  }
}

async function readJsonAsset(context, pathname) {
  const url = new URL(context.request.url)
  url.pathname = pathname
  url.search = ''

  const response = await context.env.ASSETS.fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to load ${pathname}: ${response.status}`)
  }

  return response.json()
}

async function hydrateLegislator(context, summary) {
  const detail = await readJsonAsset(context, `/api/legislators/${summary.slug}.json`)

  return {
    ...summary,
    latestDeclaration: detail.latestDeclaration || null,
    changes: detail.changes || [],
  }
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase()

  if (method === 'OPTIONS') {
    return empty({ status: 204 })
  }

  if (method === 'HEAD') {
    return empty({ status: 200 })
  }

  if (method !== 'GET') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url = new URL(context.request.url)
  const searchParams = url.searchParams
  const names = listParams(searchParams, ['name', 'legislator'])
  const slugs = listParams(searchParams, ['slug'])
  const parties = listParams(searchParams, ['party']).map(normalizeParty)
  const include = new Set(listParams(searchParams, ['include']).map(value => value.toLowerCase()))
  const q = (searchParams.get('q') || searchParams.get('search') || '').trim().toLowerCase()
  const searchQueries = [q, SEARCH_ALIASES[q]].filter(Boolean)

  let legislators
  try {
    legislators = await readJsonAsset(context, '/api/legislators.json')
  } catch (error) {
    return json(
      {
        error: 'Legislator API data is not available.',
        detail: error.message,
      },
      { status: 503 }
    )
  }

  let results = legislators

  if (names.length > 0) {
    results = results.filter(leg =>
      names.some(name => leg.name === name || leg.name.includes(name))
    )
  }

  if (slugs.length > 0) {
    results = results.filter(leg => slugs.includes(leg.slug))
  }

  if (parties.length > 0) {
    results = results.filter(leg => parties.includes(leg.meta?.party || ''))
  }

  if (searchQueries.length > 0) {
    results = results.filter(leg =>
      searchQueries.some(query =>
        includesText(leg.name, query) ||
        includesText(leg.slug, query) ||
        includesText(leg.meta?.party, query) ||
        includesText(leg.organization, query) ||
        includesText(leg.title, query)
      )
    )
  }

  const total = results.length
  const requestedLimit = Number.parseInt(searchParams.get('limit') || String(total), 10)
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 0), 200) : total
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0
  const page = results.slice(offset, offset + limit).map(toSummary)

  const directLookup = names.length > 0 || slugs.length > 0
  const wantsDetails =
    include.has('details') ||
    include.has('documents') ||
    include.has('declaration') ||
    include.has('changes')

  if (wantsDetails && (!directLookup || total > MAX_DETAILED_RESULTS)) {
    return json(
      {
        error: `include=details requires a name or slug lookup with ${MAX_DETAILED_RESULTS} or fewer matches.`,
        count: total,
        maxDetailedResults: MAX_DETAILED_RESULTS,
      },
      { status: 400 }
    )
  }

  const includeDetails =
    wantsDetails || (directLookup && total <= MAX_DETAILED_RESULTS)
  const responseResults = includeDetails
    ? await Promise.all(page.map(leg => hydrateLegislator(context, leg)))
    : page

  return json({
    count: total,
    limit,
    offset,
    query: {
      name: names,
      slug: slugs,
      party: parties,
      q,
      include: Array.from(include),
    },
    results: responseResults,
  })
}
