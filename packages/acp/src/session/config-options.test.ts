import { describe, expect, it } from 'vitest'
import { findModelConfigOption, parseAcpConfigOptions } from './config-options'

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
})
