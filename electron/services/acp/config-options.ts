import type { AcpConfigOption, AcpConfigOptionValue } from '@shared/types/acp'

export function parseAcpConfigOptions(raw: unknown): AcpConfigOption[] {
  if (!Array.isArray(raw)) return []
  const options: AcpConfigOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const configId =
      typeof row.configId === 'string'
        ? row.configId
        : typeof row.id === 'string'
          ? row.id
          : null
    if (!configId) continue
    const name = typeof row.name === 'string' ? row.name : configId
    const type = typeof row.type === 'string' ? row.type : 'select'
    const values: AcpConfigOptionValue[] = []
    if (Array.isArray(row.options)) {
      for (const opt of row.options) {
        if (!opt || typeof opt !== 'object') continue
        const o = opt as Record<string, unknown>
        const value = typeof o.value === 'string' ? o.value : typeof o.id === 'string' ? o.id : null
        if (!value) continue
        values.push({
          value,
          name: typeof o.name === 'string' ? o.name : value,
          description: typeof o.description === 'string' ? o.description : undefined,
        })
      }
    }
    options.push({
      configId,
      name,
      description: typeof row.description === 'string' ? row.description : undefined,
      category: typeof row.category === 'string' ? row.category : undefined,
      type,
      currentValue:
        typeof row.currentValue === 'string' || typeof row.currentValue === 'boolean'
          ? row.currentValue
          : undefined,
      options: values.length > 0 ? values : undefined,
    })
  }
  return options
}

export function findModelConfigOption(options: AcpConfigOption[]): AcpConfigOption | undefined {
  return (
    options.find((o) => o.category === 'model') ??
    options.find((o) => o.configId === 'model' || o.configId.includes('model'))
  )
}
