import { describe, expect, it } from 'vitest'
import { reassembleDirectoryText } from './directory-reassemble'

const OPTS = { pageCount: 340, pageOffset: 12 }

describe('reassembleDirectoryText', () => {
  it('无参数原样透传（零行为变化）', () => {
    const text = '第1章 概述 1\n|2.2运算|32|\n8 9 · 11\n官方开源，正文\n\n\n王道计'
    expect(reassembleDirectoryText(text).text).toBe(text)
  })

  it('竖线包行拆出标题页码，前导 - 可信、? 不可信', () => {
    const { text, stats } = reassembleDirectoryText(
      '|2.2运算方法和运算电路|32|\n|2.1.5 本节习题精选|-27|\n|2.9 测试标题|?2|',
      OPTS,
    )
    // -27 的前导 - 是点线残留（负页码不存在），信任 27；
    // ?2 的 ? 是缺字证据，高位数字已丢，转光杆
    expect(text.split('\n')).toEqual(['2.2运算方法和运算电路 32', '2.1.5本节习题精选 27', '2.9测试标题'])
    expect(stats.pipeRows).toBe(3)
    expect(stats.paired).toBe(0)
  })

  it('悬殊数量拒绝配对（防跨区错位）', () => {
    const oneVsSeven = reassembleDirectoryText(['2.1.3 整数的表示', '8 9 11 11 13 15 18'].join('\n'), OPTS)
    expect(oneVsSeven.text.split('\n')).toEqual(['2.1.3整数的表示'])
    expect(oneVsSeven.stats.paired).toBe(0)
    expect(oneVsSeven.stats.droppedPool).toBe(7)
    const tenVsTwo = reassembleDirectoryText(
      ['3.1 甲', '3.2 乙', '3.3 丙', '3.4 丁', '3.5 戊', '3.6 己', '3.7 庚', '3.8 辛', '3.9 壬', '3.10 癸', '6 2'].join('\n'),
      OPTS,
    )
    expect(tenVsTwo.stats.paired).toBe(0)
    expect(tenVsTwo.stats.droppedPool).toBe(2)
  })

  it('光杆标题按序配数字汤', () => {
    const { text, stats } = reassembleDirectoryText(
      ['1.1.1 硬件的发展', '1.1.2 软件的发展', '8 9'].join('\n'),
      OPTS,
    )
    expect(text.split('\n')).toEqual(['1.1.1硬件的发展 8', '1.1.2软件的发展 9'])
    expect(stats.paired).toBe(2)
    expect(stats.poolNumbers).toBe(2)
  })

  it('数字超范围进不了池（水印数字-collateral）', () => {
    const { text, stats } = reassembleDirectoryText(
      ['3.1 概述', '87929797王道计', '8 9'].join('\n'),
      OPTS,
    )
    // 水印行整体丢弃；光杆只配 8，多余的 9 计入 droppedPool
    expect(text.split('\n')).toEqual(['3.1概述 8'])
    expect(stats.paired).toBe(1)
    expect(stats.poolNumbers).toBe(2)
    expect(stats.droppedPool).toBe(1)
  })

  it('标题多于数字时余量转光杆，数字多余丢弃计数', () => {
    const { text, stats } = reassembleDirectoryText(['1.1 甲', '1.2 乙', '1.3 丙', '8 9'].join('\n'), OPTS)
    expect(text.split('\n')).toEqual(['1.1甲 8', '1.2乙 9', '1.3丙'])
    expect(stats.bareEmitted).toBe(1)
    const over = reassembleDirectoryText(['1.1 甲', '8 9 10'].join('\n'), OPTS)
    expect(over.text.split('\n')).toEqual(['1.1甲 8'])
    expect(over.stats.droppedPool).toBe(2)
  })

  it('章行不进配对（下游专规则处理）', () => {
    const { text } = reassembleDirectoryText(['第3章 存储系统', '3.1 概述 45'].join('\n'), OPTS)
    expect(text.split('\n')).toEqual(['第3章 存储系统', '3.1 概述 45'])
  })

  it('自带页码行触发吐出攒的标题（不跨区）', () => {
    const { text } = reassembleDirectoryText(
      ['1.1 甲', '1.2 乙 20', '1.3 丙', '30 31'].join('\n'),
      OPTS,
    )
    expect(text.split('\n')).toEqual(['1.1甲', '1.2 乙 20', '1.3丙 30'])
  })
})
