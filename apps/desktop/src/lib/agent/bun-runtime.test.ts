import { describe, expect, it } from 'vitest'
import { isLikelyBunMissingMessage } from '@/lib/agent/bun-runtime'

describe('bun-runtime', () => {
  it('识别 Windows 未找到 bunx', () => {
    expect(
      isLikelyBunMissingMessage("'bunx' 不是内部或外部命令，也不是可运行的程序"),
    ).toBe(true)
  })

  it('识别 ENOENT spawn bunx', () => {
    expect(isLikelyBunMissingMessage("spawn bunx ENOENT")).toBe(true)
  })

  it('忽略无关协议错误', () => {
    expect(isLikelyBunMissingMessage('协议版本不兼容')).toBe(false)
  })
})
