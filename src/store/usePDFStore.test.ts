import { describe, it, expect, beforeEach } from 'vitest'
import { usePDFStore } from './usePDFStore'

describe('usePDFStore', () => {
  beforeEach(() => {
    usePDFStore.getState().reset()
  })

  it('初始状态：全局配置为 50% 垂直分割', () => {
    const { globalConfig } = usePDFStore.getState()
    expect(globalConfig).toEqual({ ratio: 0.5, direction: 'vertical' })
  })

  it('setGlobalConfig 更新全局配置', () => {
    usePDFStore.getState().setGlobalConfig({ ratio: 0.4, direction: 'horizontal' })
    expect(usePDFStore.getState().globalConfig).toEqual({ ratio: 0.4, direction: 'horizontal' })
  })

  it('setPageConfig 设置单页配置', () => {
    usePDFStore.getState().setPageConfig(3, { ratio: 0.6, direction: 'vertical' })
    expect(usePDFStore.getState().pageConfigs[3]).toEqual({ ratio: 0.6, direction: 'vertical' })
  })

  it('applyConfigToAll 清除所有覆盖配置', () => {
    usePDFStore.getState().setPageConfig(1, { ratio: 0.7, direction: 'vertical' })
    usePDFStore.getState().addRangeConfig(1, 5, { ratio: 0.45, direction: 'vertical' })
    usePDFStore.getState().applyConfigToAll({ ratio: 0.5, direction: 'vertical' })
    const state = usePDFStore.getState()
    expect(Object.keys(state.pageConfigs)).toHaveLength(0)
    expect(state.rangeConfigs).toHaveLength(0)
    expect(state.globalConfig.ratio).toBe(0.5)
  })

  it('pushHistory + undo + redo 撤销重做', () => {
    const store = usePDFStore.getState()
    store.setGlobalConfig({ ratio: 0.5, direction: 'vertical' })
    store.pushHistory()
    store.setGlobalConfig({ ratio: 0.6, direction: 'vertical' })
    store.pushHistory()
    usePDFStore.getState().undo()
    expect(usePDFStore.getState().globalConfig.ratio).toBe(0.5)
    usePDFStore.getState().redo()
    expect(usePDFStore.getState().globalConfig.ratio).toBe(0.6)
  })

  it('setOddConfig / setEvenConfig 分别设置奇偶页', () => {
    usePDFStore.getState().setOddConfig({ ratio: 0.45, direction: 'vertical' })
    usePDFStore.getState().setEvenConfig({ ratio: 0.55, direction: 'vertical' })
    const { oddEvenConfig } = usePDFStore.getState()
    expect(oddEvenConfig.odd?.ratio).toBe(0.45)
    expect(oddEvenConfig.even?.ratio).toBe(0.55)
  })
})
