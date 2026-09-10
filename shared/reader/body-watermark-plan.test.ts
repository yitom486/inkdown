import { describe, expect, it } from 'vitest'
import {
  computeBodyWatermarkPlanSignature,
  planBodyWatermarkPatches,
  TRIM_ELIGIBLE_WATERMARKS,
  WHOLE_BLOCK_ONLY_WATERMARKS,
  type BodyBlockInput,
} from './body-watermark-plan'

function block(over: Partial<BodyBlockInput> & { content: string }): BodyBlockInput {
  return { id: 1, type: 'paragraph', pageNumber: 36, ...over }
}

describe('body-watermark-plan', () => {
  it('规则表 frozen：trim 表全 ≥3 字，无单字/双字', () => {
    for (const key of TRIM_ELIGIBLE_WATERMARKS) {
      expect([...key].length).toBeGreaterThanOrEqual(3)
    }
    expect(WHOLE_BLOCK_ONLY_WATERMARKS.length).toBeGreaterThan(0)
    expect(TRIM_ELIGIBLE_WATERMARKS.length).toBeGreaterThan(0)
  })

  it('单字“王”独立块删除；“王 DMA 方式”不动', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 978, content: '王' }),
      block({ id: 991, content: '(4)移码表示法 王道计 移码主要用于表示' }),
      block({ id: 992, content: '多重中断和中断屏蔽的概念 王 DMA 方式' }),
    ])
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ id: 978, action: 'delete', pageNumber: 36 })
    expect(patches[0]?.reason).toContain('whole-block')
  })

  it('“输入/输出系统 王道计”只修剪末尾，保留内部空格', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 7893, content: '输入/输出系统 王道计' }),
    ])
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({
      id: 7893,
      action: 'update',
      before: '输入/输出系统 王道计',
      after: '输入/输出系统',
      pageNumber: 36,
    })
  })

  it('全水印 token 块删块不留空串；首尾双水印层层剥离', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 7, content: '王道计 王道计 机教育 机教育' }),
      block({ id: 8, content: '购买王道书，就上' }),
    ])
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ id: 7, action: 'delete' })
    expect(patches[0]?.reason).toContain('trim-to-empty')
    expect(patches[0]).not.toHaveProperty('after')
  })

  it('修剪残留仍是整块水印时删块，不留“王道/王”碎片', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 767, content: '机教育 算机' }),
      block({ id: 848, content: '早机教育 单项选择题' }),
      block({ id: 6480, content: '二、综合应用题 王道计' }),
    ])
    expect(patches).toHaveLength(3)
    expect(patches[0]).toMatchObject({ id: 767, action: 'delete' })
    expect(patches[0]?.reason).toContain('trim-then-whole')
    // 真实标题逐字保留，水印被剥离
    expect(patches[1]).toMatchObject({ id: 848, action: 'update', after: '单项选择题' })
    expect(patches[2]).toMatchObject({ id: 6480, action: 'update', after: '二、综合应用题' })
  })

  it('表格、长正文、真实重复标题逐字保留', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 100, type: 'table', content: '| 王道计 | 说明 |\n|---|---|\n| CPU | 运算 |' }),
      block({
        id: 101,
        content: '从主机的视角来看，输入是指将信息从外部设备传送到主机，育人的理念要求输出稳定',
      }),
      block({ id: 102, type: 'heading', content: '二、综合应用题' }),
      block({ id: 103, type: 'heading', content: '一、单项选择题' }),
      block({ id: 104, content: '单项选择题' }),
      block({ id: 105, content: '第7章' }),
      block({ id: 106, content: '考点追踪补码大小的判断（2015） ①正数的原码相同' }),
    ])
    expect(patches).toEqual([])
  })

  it('补丁为空幂等；补丁只携带六字段，不碰归属/坐标', () => {
    expect(planBodyWatermarkPatches([])).toEqual([])
    const patches = planBodyWatermarkPatches([block({ id: 982, content: '王道计' })])
    expect(patches).toHaveLength(1)
    expect(Object.keys(patches[0] ?? {}).sort()).toEqual(
      ['action', 'before', 'id', 'pageNumber', 'reason'].sort(),
    )
  })

  it('P0.3 窄规则：块首黏连早机教育删恰好 4 字', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 1, content: '早机教育4.2.1 指令寻址' }),
      block({ id: 2, content: '早机教育二、综合应用题' }),
    ])
    expect(patches).toHaveLength(2)
    expect(patches[0]).toMatchObject({
      id: 1,
      action: 'update',
      before: '早机教育4.2.1 指令寻址',
      after: '4.2.1 指令寻址',
      reason: 'attached-start:早机教育',
    })
    expect(patches[1]).toMatchObject({
      id: 2,
      action: 'update',
      after: '二、综合应用题',
      reason: 'attached-start:早机教育',
    })
  })

  it('P0.3：前导空白保留，余空白不补丁（整块规则优先）', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 3, content: '  早机教育正文' }),
      // 纯水印块归整块删除，不走窄规则（同一 block 至多一条补丁）
      block({ id: 4, content: '早机教育   ' }),
    ])
    expect(patches).toHaveLength(2)
    expect(patches[0]).toMatchObject({ id: 3, action: 'update', after: '  正文' })
    expect(patches[1]).toMatchObject({ id: 4, action: 'delete', reason: 'whole-block:早机教育' })
  })

  it('P0.3：中间/结尾黏连、table、王道计开头一律不动', () => {
    const patches = planBodyWatermarkPatches([
      block({ id: 5, content: '正文早机教育正文' }),
      block({ id: 6, content: '正文早机教育残留' }),
      block({ id: 7, type: 'table', content: '早机教育表格' }),
      block({ id: 8, content: '王道计早机教育' }),
      block({ id: 9, content: '机教育早机教育' }),
    ])
    expect(patches).toEqual([])
  })

  it('P0.3：与既有规则共存，单块单补丁，签名稳定', () => {
    const inputs = [
      block({ id: 10, content: '王道计' }),
      block({ id: 11, content: '输入/输出系统 王道计' }),
      block({ id: 12, content: '早机教育09. D' }),
      block({ id: 13, content: '王 DMA 方式' }),
      // 空格分隔的尾随早机教育仍走既有 trim（冻结行为不变），不进窄规则
      block({ id: 14, content: '正文 早机教育' }),
    ]
    const patches = planBodyWatermarkPatches(inputs)
    expect(patches).toHaveLength(4)
    expect(new Set(patches.map((p) => p.id)).size).toBe(4)
    expect(patches.find((p) => p.id === 10)?.action).toBe('delete')
    expect(patches.find((p) => p.id === 11)).toMatchObject({ action: 'update', after: '输入/输出系统' })
    expect(patches.find((p) => p.id === 12)).toMatchObject({
      action: 'update',
      after: '09. D',
      reason: 'attached-start:早机教育',
    })
    expect(patches.find((p) => p.id === 14)).toMatchObject({
      action: 'update',
      after: '正文',
      reason: 'trim-edge:早机教育',
    })
    const forward = computeBodyWatermarkPlanSignature(patches)
    const reversed = computeBodyWatermarkPlanSignature([...patches].reverse())
    expect(forward).toBe(reversed)
    expect(forward).toMatch(/^[0-9a-f]{64}$/)
  })
})
