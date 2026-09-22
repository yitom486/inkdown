import { describe, expect, it } from 'vitest'
import type { AcpConfigOption } from '@inkdown/contracts'
import {
  buildModelVariant,
  collectThinkingCandidates,
  collectThinkingCandidatesAcrossKeys,
  extractModelSuffixThinking,
  findVariantThinkingKey,
  parseModelVariant,
  selectFastSuffixDefaultOffTarget,
  selectModelThinkingControl,
  selectReadonlyModelThinking,
  selectSuffixFastState,
} from './acp-model-thinking'

function selectOpt(
  partial: Partial<AcpConfigOption> & Pick<AcpConfigOption, 'configId' | 'name'>,
): AcpConfigOption {
  return {
    type: 'select',
    options: [{ value: 'a', name: 'A' }],
    currentValue: 'a',
    ...partial,
  } as AcpConfigOption
}

describe('extractModelSuffixThinking', () => {
  it('reasoning_effort 取值原文', () => {
    expect(extractModelSuffixThinking('gpt-5.6[reasoning_effort=high]')).toBe('high')
    expect(extractModelSuffixThinking('m[reasoning_effort = xhigh , foo=1]')).toBe('xhigh')
  })
  it('thinking 按开/关折叠', () => {
    expect(extractModelSuffixThinking('m[thinking=true]')).toBe('on')
    expect(extractModelSuffixThinking('m[thinking=false]')).toBe('off')
  })
  it('裸值直接返回原文', () => {
    expect(extractModelSuffixThinking('gpt-5.6-luna[high]')).toBe('high')
  })
  it('无后缀/空后缀/无关键返回 null', () => {
    expect(extractModelSuffixThinking('gpt-5.6')).toBeNull()
    expect(extractModelSuffixThinking('m[]')).toBeNull()
    expect(extractModelSuffixThinking('m[foo=1]')).toBeNull()
    expect(extractModelSuffixThinking(undefined)).toBeNull()
    expect(extractModelSuffixThinking(true)).toBeNull()
  })
})

describe('selectReadonlyModelThinking', () => {
  it('无 rank2 且模型尾缀有档位时返回档位', () => {
    const primary = [
      selectOpt({ configId: 'model', name: '模型', category: 'model', currentValue: 'm[high]' }),
    ]
    expect(selectReadonlyModelThinking(primary)).toBe('high')
  })
  it('有独立思考档时不显示只读徽标', () => {
    const primary = [
      selectOpt({ configId: 'model', name: '模型', category: 'model', currentValue: 'm[high]' }),
      selectOpt({ configId: 'effort', name: 'Effort', currentValue: 'high' }),
    ]
    expect(selectReadonlyModelThinking(primary)).toBeNull()
  })
  it('无模型项或模型无后缀时返回 null', () => {
    expect(selectReadonlyModelThinking([])).toBeNull()
    expect(
      selectReadonlyModelThinking([
        selectOpt({ configId: 'model', name: '模型', category: 'model', currentValue: 'plain' }),
      ]),
    ).toBeNull()
  })
})

/**
 * cursor-cli session configOptions 实测形状（39 项精简为 5 项代表）：
 * 仅 mode + model；同 base 多 variant（claude×2）、单 variant（grok）、
 * 空尾缀（default[]）、thinking 布尔（mini）、fast 缺失（claude/default/mini）。
 */
const CURSOR_MODEL_VALUES = [
  'claude-sonnet-4[reasoning_effort=low]',
  'claude-sonnet-4[reasoning_effort=high]',
  'grok-4.7[context=256k,reasoning_effort=high,fast=true]',
  'default[]',
  'mini[thinking=false]',
] as const

function cursorPrimary(current: string): AcpConfigOption[] {
  return [
    selectOpt({
      configId: 'mode',
      name: 'Mode',
      category: 'mode',
      currentValue: 'agent',
      options: [
        { value: 'agent', name: 'Agent' },
        { value: 'plan', name: 'Plan' },
        { value: 'ask', name: 'Ask' },
      ],
    }),
    selectOpt({
      configId: 'model',
      name: 'Model',
      category: 'model',
      currentValue: current,
      options: CURSOR_MODEL_VALUES.map((v) => ({ value: v, name: v })),
    }),
  ]
}

describe('parseModelVariant / buildModelVariant', () => {
  it('多 param 解析 + key 顺序保持', () => {
    const parsed = parseModelVariant('grok-4.7[context=256k,reasoning_effort=high,fast=true]')
    expect(parsed.base).toBe('grok-4.7')
    expect(Object.keys(parsed.params)).toEqual(['context', 'reasoning_effort', 'fast'])
    expect(parsed.params).toEqual({ context: '256k', reasoning_effort: 'high', fast: 'true' })
  })
  it('空尾缀 / 无尾缀 / 裸值', () => {
    expect(parseModelVariant('default[]')).toEqual({ base: 'default', params: {} })
    expect(parseModelVariant('gemini-3.1-pro[]')).toEqual({
      base: 'gemini-3.1-pro',
      params: {},
    })
    expect(parseModelVariant('plain')).toEqual({ base: 'plain', params: {} })
    expect(parseModelVariant('m[high]')).toEqual({ base: 'm', params: {} })
    expect(parseModelVariant(undefined)).toEqual({ base: '', params: {} })
  })
  it('build 往返：空 params 输出 base[]，顺序保持，新 key 追加', () => {
    expect(buildModelVariant('default', {})).toBe('default[]')
    const grok = 'grok-4.7[context=256k,reasoning_effort=high,fast=true]'
    const parsed = parseModelVariant(grok)
    expect(buildModelVariant(parsed.base, parsed.params)).toBe(grok)
    expect(buildModelVariant('default', parseModelVariant('default[]').params)).toBe(
      'default[]',
    )
    expect(buildModelVariant('a', { b: '1', c: '2' })).toBe('a[b=1,c=2]')
  })
})

describe('collectThinkingCandidates', () => {
  it('同 base 多 variant 去重（claude→low/high）', () => {
    expect(collectThinkingCandidates('claude-sonnet-4', [...CURSOR_MODEL_VALUES])).toEqual([
      'low',
      'high',
    ])
  })
  it('单 variant 仅 1 个（grok 不足 2，不可用）', () => {
    expect(collectThinkingCandidates('grok-4.7', [...CURSOR_MODEL_VALUES])).toEqual(['high'])
  })
  it('空尾缀 / 无关 base 返回空', () => {
    expect(collectThinkingCandidates('default', [...CURSOR_MODEL_VALUES])).toEqual([])
    expect(collectThinkingCandidates('', [...CURSOR_MODEL_VALUES])).toEqual([])
    expect(collectThinkingCandidates('missing', [...CURSOR_MODEL_VALUES])).toEqual([])
  })
})

describe('collectThinkingCandidatesAcrossKeys', () => {
  it('同 key 跨模型后备（reasoning_effort→low/high）', () => {
    expect(
      collectThinkingCandidatesAcrossKeys('reasoning_effort', [...CURSOR_MODEL_VALUES]),
    ).toEqual(['low', 'high'])
  })
  it('thinking 布尔仅 1 个（后备仍不足）', () => {
    expect(collectThinkingCandidatesAcrossKeys('thinking', [...CURSOR_MODEL_VALUES])).toEqual([
      'false',
    ])
  })
  it('非思考 key 直接返回空', () => {
    expect(collectThinkingCandidatesAcrossKeys('fast', [...CURSOR_MODEL_VALUES])).toEqual([])
    expect(collectThinkingCandidatesAcrossKeys('context', [...CURSOR_MODEL_VALUES])).toEqual([])
    expect(collectThinkingCandidatesAcrossKeys('', [...CURSOR_MODEL_VALUES])).toEqual([])
  })
})

describe('尾缀改写只动目标 key', () => {
  it('思考档改写其余不动（含顺序）', () => {
    const parsed = parseModelVariant('grok-4.7[context=256k,reasoning_effort=high,fast=true]')
    expect(
      buildModelVariant(parsed.base, { ...parsed.params, reasoning_effort: 'low' }),
    ).toBe('grok-4.7[context=256k,reasoning_effort=low,fast=true]')
  })
  it('fast 改写其余不动', () => {
    const parsed = parseModelVariant('grok-4.7[context=256k,reasoning_effort=high,fast=true]')
    expect(buildModelVariant(parsed.base, { ...parsed.params, fast: 'false' })).toBe(
      'grok-4.7[context=256k,reasoning_effort=high,fast=false]',
    )
  })
  it('thinking 布尔改写', () => {
    const parsed = parseModelVariant('mini[thinking=false]')
    expect(buildModelVariant(parsed.base, { ...parsed.params, thinking: 'true' })).toBe(
      'mini[thinking=true]',
    )
  })
})

describe('selectModelThinkingControl', () => {
  it('同 base≥2 直接可用（claude）', () => {
    const control = selectModelThinkingControl(
      cursorPrimary('claude-sonnet-4[reasoning_effort=low]'),
    )
    expect(control?.key).toBe('reasoning_effort')
    expect(control?.current).toBe('low')
    expect(control?.candidates).toEqual(['low', 'high'])
  })
  it('单 variant 经跨 key 后备可用（grok→low/high）', () => {
    const control = selectModelThinkingControl(
      cursorPrimary('grok-4.7[context=256k,reasoning_effort=high,fast=true]'),
    )
    expect(control?.key).toBe('reasoning_effort')
    expect(control?.candidates).toEqual(['low', 'high'])
    expect(findVariantThinkingKey(control?.params ?? {})).toBe('reasoning_effort')
  })
  it('候选不足返回 null（空尾缀 / thinking 单值）', () => {
    expect(selectModelThinkingControl(cursorPrimary('default[]'))).toBeNull()
    expect(selectModelThinkingControl(cursorPrimary('mini[thinking=false]'))).toBeNull()
  })
  it('有独立思考档（rank2）时返回 null', () => {
    const primary = [
      ...cursorPrimary('claude-sonnet-4[reasoning_effort=low]'),
      selectOpt({ configId: 'effort', name: 'Effort', currentValue: 'high' }),
    ]
    expect(selectModelThinkingControl(primary)).toBeNull()
  })
})

describe('selectSuffixFastState', () => {
  it('fast=true|false 均返回状态', () => {
    expect(
      selectSuffixFastState(cursorPrimary('grok-4.7[context=256k,reasoning_effort=high,fast=true]'))
        ?.checked,
    ).toBe(true)
    const off = selectOpt({
      configId: 'model',
      name: 'Model',
      category: 'model',
      currentValue: 'm[fast=false]',
      options: [{ value: 'm[fast=false]', name: 'M' }],
    })
    expect(selectSuffixFastState([off])?.checked).toBe(false)
  })
  it('fast 缺失返回 null', () => {
    expect(
      selectSuffixFastState(cursorPrimary('claude-sonnet-4[reasoning_effort=low]')),
    ).toBeNull()
    expect(selectSuffixFastState(cursorPrimary('default[]'))).toBeNull()
  })
})

describe('selectFastSuffixDefaultOffTarget', () => {
  const RUNTIME = 'cursor-cli'
  it('fast=true 无偏好 → 改写 fast=false', () => {
    const target = selectFastSuffixDefaultOffTarget(
      cursorPrimary('grok-4.7[context=256k,reasoning_effort=high,fast=true]'),
      {},
      RUNTIME,
    )
    expect(target?.configId).toBe('model')
    expect(target?.value).toBe('grok-4.7[context=256k,reasoning_effort=high,fast=false]')
  })
  it('有偏好 / 已 false / 无 fast → 不动', () => {
    const current = cursorPrimary('grok-4.7[context=256k,reasoning_effort=high,fast=true]')
    expect(
      selectFastSuffixDefaultOffTarget(current, { [RUNTIME]: { model: 'x' } }, RUNTIME),
    ).toBeNull()
    expect(
      selectFastSuffixDefaultOffTarget(
        cursorPrimary('claude-sonnet-4[reasoning_effort=low]'),
        {},
        RUNTIME,
      ),
    ).toBeNull()
    const offOpt = selectOpt({
      configId: 'model',
      name: 'Model',
      category: 'model',
      currentValue: 'm[fast=false]',
      options: [{ value: 'm[fast=false]', name: 'M' }],
    })
    expect(selectFastSuffixDefaultOffTarget([offOpt], {}, RUNTIME)).toBeNull()
    expect(selectFastSuffixDefaultOffTarget([], {}, RUNTIME)).toBeNull()
  })
})
