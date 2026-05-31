const COUNCILOR_CITY_SLUGS: Record<string, string> = {
  '臺北市': 'taipei',
  '台北市': 'taipei',
  '新北市': 'new-taipei',
  '桃園市': 'taoyuan',
  '臺中市': 'taichung',
  '台中市': 'taichung',
  '臺南市': 'tainan',
  '台南市': 'tainan',
  '高雄市': 'kaohsiung',
  '基隆市': 'keelung',
  '新竹市': 'hsinchu-city',
  '嘉義市': 'chiayi-city',
  '新竹縣': 'hsinchu-county',
  '苗栗縣': 'miaoli',
  '彰化縣': 'changhua',
  '南投縣': 'nantou',
  '雲林縣': 'yunlin',
  '嘉義縣': 'chiayi-county',
  '屏東縣': 'pingtung',
  '宜蘭縣': 'yilan',
  '花蓮縣': 'hualien',
  '臺東縣': 'taitung',
  '台東縣': 'taitung',
  '澎湖縣': 'penghu',
  '金門縣': 'kinmen',
  '連江縣': 'lienchiang',
}

export const COUNCILOR_CITY_NAMES: Record<string, string> = {
  taipei: '臺北市',
  'new-taipei': '新北市',
  taoyuan: '桃園市',
  taichung: '臺中市',
  tainan: '臺南市',
  kaohsiung: '高雄市',
  keelung: '基隆市',
  'hsinchu-city': '新竹市',
  'chiayi-city': '嘉義市',
  'hsinchu-county': '新竹縣',
  miaoli: '苗栗縣',
  changhua: '彰化縣',
  nantou: '南投縣',
  yunlin: '雲林縣',
  'chiayi-county': '嘉義縣',
  pingtung: '屏東縣',
  yilan: '宜蘭縣',
  hualien: '花蓮縣',
  taitung: '臺東縣',
  penghu: '澎湖縣',
  kinmen: '金門縣',
  lienchiang: '連江縣',
}

const KNOWN_CITY_SLUGS = Object.values(COUNCILOR_CITY_SLUGS)
  .filter((slug, index, slugs) => slugs.indexOf(slug) === index)
  .sort((a, b) => b.length - a.length)

function fallbackSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/議會$/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || encodeURIComponent(value)
}

export function getCouncilorCitySlug(city: string): string {
  const normalized = city.replace(/[\u3000\s]+/g, '')
  return COUNCILOR_CITY_SLUGS[normalized] ?? fallbackSlug(normalized)
}

export function getCouncilorCityName(citySlug: string): string | null {
  return COUNCILOR_CITY_NAMES[citySlug] ?? null
}

export function getCouncilorCitySlugFromOrganization(organization: string): string {
  return getCouncilorCitySlug(organization.replace(/議會$/g, ''))
}

export function getCouncilorCitySlugFromPersonSlug(slug: string): string {
  return KNOWN_CITY_SLUGS.find(citySlug => slug === citySlug || slug.startsWith(`${citySlug}-`)) ?? slug.split('-')[0]
}

export function getCouncilorMemberSlug(slug: string, cityOrSlug: string): string {
  const citySlug = getCouncilorCityName(cityOrSlug) ? cityOrSlug : getCouncilorCitySlug(cityOrSlug)
  return slug.startsWith(`${citySlug}-`) ? slug.slice(citySlug.length + 1) : slug
}

export function getCouncilorPath(person: {
  slug: string
  city?: string
  organization?: string
}): string {
  const citySlug = person.city
    ? getCouncilorCitySlug(person.city)
    : person.organization
      ? getCouncilorCitySlugFromOrganization(person.organization)
      : getCouncilorCitySlugFromPersonSlug(person.slug)

  return `/councilor/${citySlug}/${getCouncilorMemberSlug(person.slug, citySlug)}`
}
