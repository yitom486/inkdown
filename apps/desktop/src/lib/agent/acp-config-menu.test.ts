import { describe, expect, it } from 'vitest'
import { currentLabel, isSelectOption, rankPrimary, splitConfigOptions } from './acp-config-menu'
import type { AcpConfigOption } from '@inkdown/contracts'

function opt(partial: Partial<AcpConfigOption> & Pick<AcpConfigOption, 'configId' | 'name'>): AcpConfigOption {
  return { type: 'select', options: [{ value: 'a', name: 'A' }], currentValue: 'a', ...partial } as AcpConfigOption
}

describe('isSelectOption', () => {
  it('boolean 类型不参与菜单', () => {
    expect(isSelectOption({ type: 'boolean', configId: 'x', name: 'X' } as AcpConfigOption)).toBe(false)
  })
  it('无选项列表不参与菜单', () => {
    expect(isSelectOption(opt({ configId: 'nonselect', name: 'N', options: [] }))).toBe(false)
  })
  it('category 白名单命中', () => {
    expect(isSelectOption(opt({ configId: 'whatever', name: 'Whatever', category: 'model_config' }))).toBe(true)
  })
  it('无 category 时按名称正则兜底', () => {
    expect(isSelectOption(opt({ configId: 'reasoning-effort', name: '推理档' }))).toBe(true)
    expect(isSelectOption(opt({ configId: 'color', name: '颜色' }))).toBe(false)
  })
})

describe('rankPrimary / splitConfigOptions', () => {
  it('mode→0、model→1、thought→2，primary 按 rank 定序', () => {
    const { primary, secondary } = splitConfigOptions([
      opt({ configId: 'thought_level', name: '思考档', category: 'thought_level' }),
      opt({ configId: 'session-mode', name: '模式', category: 'mode' }),
      opt({ configId: 'model', name: '模型', category: 'model' }),
    ])
    expect(primary.map((o) => o.configId)).toEqual(['session-mode', 'model', 'thought_level'])
    expect(secondary).toHaveLength(0)
  })

  it('同一 rank 第二个起进 secondary；name 含 collab 的 mode 不占 primary', () => {
    const { primary, secondary } = splitConfigOptions([
      opt({ configId: 'collab-mode', name: 'Collab Mode', category: 'mode' }),
      opt({ configId: 'session-mode', name: 'Mode', category: 'mode' }),
      opt({ configId: 'model', name: 'Model', category: 'model' }),
      opt({ configId: 'model-fast', name: 'Fast Model' }),
    ])
    expect(primary.map((o) => o.configId)).toEqual(['session-mode', 'model'])
    expect(secondary.map((o) => o.configId)).toEqual(['collab-mode', 'model-fast'])
  })

  it('rankPrimary：无关项返回 null；复合词仅靠自身不命中 mode', () => {
    expect(rankPrimary(opt({ configId: 'verbosity', name: 'Verbose' }))).toBeNull()
    expect(rankPrimary(opt({ configId: 'session-mode', name: '模式' }))).toBeNull()
    expect(rankPrimary(opt({ configId: 'model-fast', name: 'Fast Model' }))).toBe(1)
  })
})

describe('currentLabel', () => {
  it('命中选项名；无当前值时回退选项组名', () => {
    expect(
      currentLabel({
        configId: 'model',
        name: '模型',
        type: 'select',
        options: [
          { value: 'a', name: 'Alpha' },
          { value: 'b', name: 'Beta' },
        ],
        currentValue: 'b',
      }),
    ).toBe('Beta')
    expect(currentLabel({ configId: 'model', name: '模型' } as AcpConfigOption)).toBe('模型')
  })
})
