export interface InFeedAdConfig {
  client: string
  slot: string
  layoutKey: string
}

export function getInFeedAdConfig(): InFeedAdConfig | undefined {
  const client = process.env.GOOGLE_ADSENSE_ACCOUNT
  const slot = process.env.GOOGLE_ADSENSE_INFEED_SLOT
  const layoutKey = process.env.GOOGLE_ADSENSE_INFEED_LAYOUT_KEY
  if (!client || !slot || !layoutKey) return undefined
  return { client, slot, layoutKey }
}

export const AD_INSERT_AFTER_INDEX = 3

export function shouldShowInFeedAd(
  config: InFeedAdConfig | undefined,
  itemCount: number,
): config is InFeedAdConfig {
  return !!config && itemCount > AD_INSERT_AFTER_INDEX + 1
}
