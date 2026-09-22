import { describe, expect, it } from 'vitest'
import {
  currentLabel,
  findFastToggle,
  isSelectOption,
  rankPrimary,
  selectFastDefaultOffTarget,
  splitConfigOptions,
} from './acp-config-menu'
import type { AcpConfigOption } from '@inkdown/contracts'

function opt(partial: Partial<AcpConfigOption> & Pick<AcpConfigOption, 'configId' | 'name'>): AcpConfigOption {
  return { type: 'select', options: [{ value: 'a', name: 'A' }], currentValue: 'a', ...partial } as AcpConfigOption
}

function bool(partial: Partial<AcpConfigOption> & Pick<AcpConfigOption, 'configId' | 'name'>): AcpConfigOption {
  return { type: 'boolean', currentValue: false, ...partial } as AcpConfigOption
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
    expect(isSelectOption(opt({ configId: 'effort', name: 'Effort' }))).toBe(true)
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

  it('rankPrimary：effort 本体命中思考档（rank2）', () => {
    expect(rankPrimary(opt({ configId: 'effort', name: 'Effort' }))).toBe(2)
    expect(rankPrimary(opt({ configId: 'reasoning-effort', name: '推理档' }))).toBe(2)
  })

  it('splitConfigOptions：boolean 开关不进 primary，直接跟进 secondary', () => {
    const fast = {
      type: 'boolean',
      configId: 'fast-mode',
      name: '快速模式',
      currentValue: true,
    } as AcpConfigOption
    const verbose = {
      type: 'boolean',
      configId: 'verbose',
      name: '详细输出',
      currentValue: false,
    } as AcpConfigOption
    const { primary, secondary, fastToggle } = splitConfigOptions([
      opt({ configId: 'model', name: '模型', category: 'model' }),
      fast,
      verbose,
    ])
    expect(primary.map((o) => o.configId)).toEqual(['model'])
    // fast 命中项单列，不再进 secondary，避免输入栏与更多设置重复
    expect(fastToggle?.configId).toBe('fast-mode')
    expect(secondary.map((o) => o.configId)).toEqual(['verbose'])
  })

  it('splitConfigOptions：无 fast 项时 fastToggle 为 null，界面零变化', () => {
    const { primary, secondary, fastToggle } = splitConfigOptions([
      opt({ configId: 'model', name: '模型', category: 'model' }),
      bool({ configId: 'verbose', name: '详细输出' }),
    ])
    expect(fastToggle).toBeNull()
    expect(primary.map((o) => o.configId)).toEqual(['model'])
    expect(secondary.map((o) => o.configId)).toEqual(['verbose'])
  })
})

describe('findFastToggle', () => {
  it('configId 大小写命中', () => {
    expect(findFastToggle([bool({ configId: 'FAST-mode', name: '极速' })])?.configId).toBe('FAST-mode')
    expect(findFastToggle([bool({ configId: 'enable-fast-path', name: '加速' })])?.configId).toBe(
      'enable-fast-path',
    )
  })
  it('name 大小写命中（category 不限）', () => {
    expect(
      findFastToggle([bool({ configId: 'speed', name: 'Fast Mode', category: 'model' })])?.configId,
    ).toBe('speed')
  })
  it('非 boolean 不命中', () => {
    expect(findFastToggle([opt({ configId: 'fast-model', name: 'Fast Model' })])).toBeNull()
  })
  it('多项取首个；无此项返回 null', () => {
    const first = bool({ configId: 'fast-one', name: 'Fast One' })
    const second = bool({ configId: 'fast-two', name: 'Fast Two' })
    expect(findFastToggle([first, second])).toBe(first)
    expect(findFastToggle([bool({ configId: 'verbose', name: '详细' })])).toBeNull()
  })
})

describe('selectFastDefaultOffTarget', () => {
  const RUNTIME = 'codex-acp'
  it('无偏好 + 默认开 → 返回该项（调用方置 false 并记住）', () => {
    const fast = bool({ configId: 'fast-mode', name: 'Fast', currentValue: true })
    expect(selectFastDefaultOffTarget([fast], {}, RUNTIME)).toBe(fast)
  })
  it('有偏好 → 不动（用户拨过之后为准）', () => {
    const fast = bool({ configId: 'fast-mode', name: 'Fast', currentValue: true })
    expect(selectFastDefaultOffTarget([fast], { [RUNTIME]: { 'fast-mode': 'true' } }, RUNTIME)).toBeNull()
    expect(selectFastDefaultOffTarget([fast], { [RUNTIME]: { 'fast-mode': 'false' } }, RUNTIME)).toBeNull()
  })
  it('默认已关 → 不调用', () => {
    expect(
      selectFastDefaultOffTarget([bool({ configId: 'fast-mode', name: 'Fast', currentValue: false })], {}, RUNTIME),
    ).toBeNull()
  })
  it('无 fast 项 → 不调用', () => {
    expect(selectFastDefaultOffTarget([bool({ configId: 'verbose', name: '详细', currentValue: true })], {}, RUNTIME)).toBeNull()
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
