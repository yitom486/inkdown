import { describe, expect, it } from 'vitest'
import {
  buildCardStudioPrompt,
  CARD_STUDIO_PRESETS,
  getCardStudioPreset,
} from './card-studio-presets'

describe('card-studio-presets', () => {
  it('六预设齐全且 id 唯一', () => {
    expect(CARD_STUDIO_PRESETS.map((preset) => preset.id)).toEqual([
      'distill',
      'concept',
      'argue',
      'quote',
      'question',
      'link',
    ])
    expect(new Set(CARD_STUDIO_PRESETS.map((preset) => preset.id)).size).toBe(6)
  })

  it('组装含预设 directive + 原文；无补充时无用户节', () => {
    const preset = getCardStudioPreset('concept')!
    const prompt = buildCardStudioPrompt('  摘录正文  ', preset)
    expect(prompt).toContain(preset.directive)
    expect(prompt).toContain('<原文>\n摘录正文\n</原文>')
    expect(prompt).not.toContain('用户补充要求')
  })

  it('补充用显式分隔 + 冲突优先声明，不与预设打架', () => {
    const preset = getCardStudioPreset('distill')!
    const prompt = buildCardStudioPrompt('摘录', preset, '多举两个例子')
    expect(prompt).toContain('<用户补充要求>\n多举两个例子\n</用户补充要求>')
    expect(prompt).toContain('以用户补充为准')
  })

  it('未知 id 取不到预设（调用方 toast 报错不断流）', () => {
    expect(getCardStudioPreset('nope')).toBeNull()
  })
})
