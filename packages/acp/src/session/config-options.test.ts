import { describe, expect, it } from 'vitest'
import {
  findModelConfigOption,
  mergeTopLevelModelsIntoConfigOptions,
  parseAcpConfigOptions,
  synthesizeModelOptionFromTopLevelModels,
} from './config-options'

describe('parseAcpConfigOptions', () => {
  it('parses model select option', () => {
    const options = parseAcpConfigOptions([
      {
        configId: 'model',
        name: 'Model',
        category: 'model',
        type: 'select',
        currentValue: 'model-1',
        options: [
          { value: 'model-1', name: 'Fast' },
          { value: 'model-2', name: 'Strong' },
        ],
      },
    ])
    expect(options).toHaveLength(1)
    expect(findModelConfigOption(options)?.currentValue).toBe('model-1')
    expect(findModelConfigOption(options)?.options?.[1]?.name).toBe('Strong')
  })

  it('accepts legacy id field', () => {
    const options = parseAcpConfigOptions([{ id: 'mode', name: 'Mode', type: 'select' }])
    expect(options[0]?.configId).toBe('mode')
  })

  it('parses boolean fast option (parameterizedModelPicker shape)', () => {
    const options = parseAcpConfigOptions([
      {
        configId: 'fast',
        name: 'Fast',
        type: 'select',
        currentValue: false,
        options: [
          { value: false, name: 'Off' },
          { value: true, name: 'Fast' },
        ],
      },
    ])
    expect(options).toHaveLength(1)
    expect(options[0]?.options).toEqual([
      { value: 'false', name: 'Off', description: undefined },
      { value: 'true', name: 'Fast', description: undefined },
    ])
    // boolean currentValue 原样保留（Boolean() 语义不被 'false' 字符串破坏）
    expect(options[0]?.currentValue).toBe(false)
  })

  it('parses numeric option values and currentValue', () => {
    const options = parseAcpConfigOptions([
      {
        configId: 'effort',
        name: 'Effort',
        type: 'select',
        currentValue: 2,
        options: [
          { value: 1, name: 'Low' },
          { value: 2 },
        ],
      },
    ])
    expect(options[0]?.options).toEqual([
      { value: '1', name: 'Low', description: undefined },
      { value: '2', name: '2', description: undefined },
    ])
    expect(options[0]?.currentValue).toBe('2')
  })

  it('keeps declared-picker cursor shape: plain model + independent fast + thinking', () => {
    const options = parseAcpConfigOptions([
      {
        configId: 'model',
        name: 'Model',
        category: 'model',
        type: 'select',
        currentValue: 'grok-4.7',
        options: [
          { value: 'grok-4.7', name: 'grok-4.7' },
          { value: 'claude-sonnet-4', name: 'claude-sonnet-4' },
        ],
      },
      { configId: 'fast', name: 'Fast', type: 'boolean', currentValue: false },
      {
        configId: 'reasoning-effort',
        name: 'Reasoning effort',
        type: 'select',
        currentValue: 'high',
        options: [
          { value: 'low', name: 'Low' },
          { value: 'high', name: 'High' },
        ],
      },
    ])
    expect(options).toHaveLength(3)
    expect(findModelConfigOption(options)?.currentValue).toBe('grok-4.7')
    expect(options.find((o) => o.configId === 'fast')?.currentValue).toBe(false)
    expect(options.find((o) => o.configId === 'reasoning-effort')?.options).toHaveLength(2)
  })

  it('drops uncoercible values but keeps the option', () => {
    const options = parseAcpConfigOptions([
      {
        configId: 'mode',
        name: 'Mode',
        type: 'select',
        currentValue: 'a',
        options: [{ value: 'a', name: 'A' }, null, { value: {}, name: 'Bad' }],
      },
    ])
    expect(options[0]?.options).toEqual([{ value: 'a', name: 'A', description: undefined }])
  })
})

describe('synthesizeModelOptionFromTopLevelModels（dsh 方言兼容）', () => {
  it('数组 string 形：value=name=原串', () => {
    const synthesized = synthesizeModelOptionFromTopLevelModels(['m1', 'm2'])
    expect(synthesized).toMatchObject({
      configId: 'model',
      category: 'model',
      name: 'Model',
    })
    expect(synthesized?.options).toEqual([
      { value: 'm1', name: 'm1' },
      { value: 'm2', name: 'm2' },
    ])
    expect(synthesized?.currentValue).toBeUndefined()
  })

  it('数组对象形：{id|value/name} 取值', () => {
    const synthesized = synthesizeModelOptionFromTopLevelModels([
      { id: 'a', name: 'Alpha' },
      { value: 'b', name: 'Beta' },
      { value: 'c' },
      '',
      null,
    ])
    expect(synthesized?.options).toEqual([
      { value: 'a', name: 'Alpha' },
      { value: 'b', name: 'Beta' },
      { value: 'c', name: 'c' },
    ])
  })

  it('对象形 {availableModels, currentModelId}：currentValue 取 currentModelId', () => {
    const synthesized = synthesizeModelOptionFromTopLevelModels(
      { availableModels: [{ id: 'x', name: 'X' }, 'y'], currentModelId: 'y' },
      {},
    )
    expect(synthesized?.options).toEqual([
      { value: 'x', name: 'X' },
      { value: 'y', name: 'y' },
    ])
    expect(synthesized?.currentValue).toBe('y')
  })

  it('空数组 / 非法形状返回 null', () => {
    expect(synthesizeModelOptionFromTopLevelModels([])).toBeNull()
    expect(synthesizeModelOptionFromTopLevelModels(undefined)).toBeNull()
    expect(synthesizeModelOptionFromTopLevelModels(42)).toBeNull()
    expect(
      synthesizeModelOptionFromTopLevelModels({ availableModels: [] }),
    ).toBeNull()
  })
})

describe('mergeTopLevelModelsIntoConfigOptions', () => {
  it('无 model 类 configOption 时合成追加', () => {
    const merged = mergeTopLevelModelsIntoConfigOptions([], {
      models: ['m1'],
    }) as unknown[]
    expect(merged).toHaveLength(1)
    const parsed = parseAcpConfigOptions(merged)
    expect(findModelConfigOption(parsed)?.options).toEqual([{ value: 'm1', name: 'm1', description: undefined }])
  })

  it('已有 model 类 configOption 时不覆盖', () => {
    const base = [
      {
        configId: 'model',
        name: 'Model',
        category: 'model',
        type: 'select',
        currentValue: 'keep',
        options: [{ value: 'keep', name: 'Keep' }],
      },
    ]
    const merged = mergeTopLevelModelsIntoConfigOptions(base, {
      models: ['other'],
    })
    expect(merged).toBe(base)
    expect(parseAcpConfigOptions(merged)[0]?.currentValue).toBe('keep')
  })

  it('无顶层 models 时原样返回', () => {
    const base: unknown[] = []
    expect(mergeTopLevelModelsIntoConfigOptions(base, { sessionId: 's' })).toBe(base)
  })
})
