import type { SplitConfig, ConfigSnapshot } from '../types'

export function resolveConfig(pageNum: number, snapshot: ConfigSnapshot): SplitConfig {
  let cfg: SplitConfig = snapshot.globalConfig

  const isOdd = pageNum % 2 === 1
  const oe = isOdd ? snapshot.oddEvenConfig.odd : snapshot.oddEvenConfig.even
  if (oe) cfg = oe

  const matchedRange = snapshot.rangeConfigs.findLast(
    r => pageNum >= r.from && pageNum <= r.to
  )
  if (matchedRange) cfg = matchedRange.config

  const perPage = snapshot.pageConfigs[pageNum]
  if (perPage) cfg = perPage

  return cfg
}
