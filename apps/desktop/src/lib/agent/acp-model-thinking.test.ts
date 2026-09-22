import { describe, expect, it } from 'vitest'
import type { AcpConfigOption } from '@inkdown/contracts'
import {
  extractModelSuffixThinking,
  selectReadonlyModelThinking,
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
