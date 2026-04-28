import { describe, it, expect } from 'vitest'
import { resolveConfig } from './splitConfigResolver'
import type { SplitConfig, ConfigSnapshot } from '../types'

const V: SplitConfig = { ratio: 0.5, direction: 'vertical' }
const snap = (overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot => ({
  globalConfig: V,
  oddEvenConfig: {},
  rangeConfigs: [],
  pageConfigs: {},
  ...overrides,
})

describe('resolveConfig', () => {
  it('无任何覆盖时返回全局配置', () => {
    expect(resolveConfig(1, snap())).toEqual(V)
  })

  it('奇数页有奇页覆盖时使用奇页配置', () => {
    const oddCfg: SplitConfig = { ratio: 0.45, direction: 'vertical' }
    expect(resolveConfig(1, snap({ oddEvenConfig: { odd: oddCfg } }))).toEqual(oddCfg)
  })

  it('偶数页有偶页覆盖时使用偶页配置', () => {
    const evenCfg: SplitConfig = { ratio: 0.55, direction: 'vertical' }
    expect(resolveConfig(2, snap({ oddEvenConfig: { even: evenCfg } }))).toEqual(evenCfg)
  })

  it('奇偶页互斥：奇数页只用奇页配置，偶数页只用偶页配置', () => {
    const oddCfg: SplitConfig = { ratio: 0.45, direction: 'vertical' }
    const evenCfg: SplitConfig = { ratio: 0.55, direction: 'vertical' }
    const s = snap({ oddEvenConfig: { odd: oddCfg, even: evenCfg } })
    expect(resolveConfig(3, s)).toEqual(oddCfg)   // 奇数页使用奇页配置
    expect(resolveConfig(2, s)).toEqual(evenCfg)  // 偶数页使用偶页配置
  })

  it('页范围覆盖奇偶配置', () => {
    const oddCfg: SplitConfig = { ratio: 0.45, direction: 'vertical' }
    const rangeCfg: SplitConfig = { ratio: 0.6, direction: 'vertical' }
    const s = snap({
      oddEvenConfig: { odd: oddCfg },
      rangeConfigs: [{ from: 1, to: 5, config: rangeCfg }],
    })
    expect(resolveConfig(1, s)).toEqual(rangeCfg)
  })

  it('逐页配置覆盖所有其他配置', () => {
    const pageCfg: SplitConfig = { ratio: 0.7, direction: 'horizontal' }
    const s = snap({
      oddEvenConfig: { odd: { ratio: 0.45, direction: 'vertical' } },
      rangeConfigs: [{ from: 1, to: 10, config: { ratio: 0.6, direction: 'vertical' } }],
      pageConfigs: { 1: pageCfg },
    })
    expect(resolveConfig(1, s)).toEqual(pageCfg)
  })

  it('页范围取最后匹配项（多个范围重叠时）', () => {
    const cfg1: SplitConfig = { ratio: 0.4, direction: 'vertical' }
    const cfg2: SplitConfig = { ratio: 0.6, direction: 'vertical' }
    const s = snap({
      rangeConfigs: [
        { from: 1, to: 10, config: cfg1 },
        { from: 3, to: 8, config: cfg2 },
      ],
    })
    expect(resolveConfig(5, s)).toEqual(cfg2)
    expect(resolveConfig(2, s)).toEqual(cfg1)
  })

  it('不在范围内的页使用全局配置，端点本身属于范围内', () => {
    const rangeCfg: SplitConfig = { ratio: 0.6, direction: 'vertical' }
    const s = snap({ rangeConfigs: [{ from: 3, to: 5, config: rangeCfg }] })
    // 范围外
    expect(resolveConfig(1, s)).toEqual(V)
    expect(resolveConfig(6, s)).toEqual(V)
    // 端点本身属于范围内
    expect(resolveConfig(3, s)).toEqual(rangeCfg)  // from 端点
    expect(resolveConfig(5, s)).toEqual(rangeCfg)  // to 端点
  })
})
