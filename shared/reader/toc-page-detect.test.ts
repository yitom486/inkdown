import { describe, expect, it } from 'vitest'
import {
  resolveDetectApply,
  resolveDetectWindow,
  scoreTocPageMarkdown,
  selectTocPageRange,
} from './toc-page-detect'

// 真书形状 fixture（王道书目录页特征压缩：标题/竖线表/点线页码/数字汤/光杆节）
const PAGE_8 = [
  '王道计',
  '录',
  '第1章 计算机系统概述 *1.1 计算机发展历程',
  '1.1.1 计算机硬件的发展',
  '1.1.2 计算机软件的发展',
  '1.2 计算机系统层次结构',
  '1.2.1计算机系统的组成·',
  '1.2.2 计算机硬件·',
  '1.2.3 计算机软件.',
  '1.2.4 计算机系统的层次结构·',
  '1.2.5 计算机系统的不同用户.',
  '1.2.6 计算机系统的工作原理',
  '1.2.7 本节习题精选',
  '1.2.8 答案与解析·',
  '1.3 计算机的性能指标',
  '1.3.1 计算机的主要性能指标',
  '1.3.2 本节习题精选',
  '1.3.3 答案与解析……',
  '1.4 本章小结',
  '1.5 常见问题和易混淆知识点',
  '|2.1.2 定点数的编码表示·|…22|',
  '|---|---|',
  '|2.1.4 C 语言中的整数类型及类型转换|…25|',
  '|2.1.5 本节习题精选|-27|',
  '|2.1.6 答案与解析…|·29|',
  '|2.2运算方法和运算电路|32|',
  '|2.2.1 基本运算部件|·32|',
  '|2.2.2 定点数的移位运算|·35|',
  '2.1.3 整数的表示·',
  '8 9 · 11 ·11 13 ·15 ·18',
  '2.2.4 定点数的乘除运算',
  '·39',
].join('\n')

const PAGE_9 = [
  '目录',
  '2.3 浮点数的表示与运算……',
  '2.3.1 IEEE 754 标准的浮点数 ……53',
  '2.3.2 浮点数的加减运算 ……54',
  '2.3.3 C 语言中的浮点数类型……58',
  '2.3.4 数据的宽度和存储……59',
  '2.3.5 本节习题精选 ……61',
  '2.3.6 答案与解析…66',
  '2.4 本章小结…75',
  '2.5 常见问题和易混淆知识点·75',
  '53 54 56 58 ·59 61',
].join('\n')

const PAGE_10 = [
  '3.1 存储器概述…',
  '3.1.1 存储器的分类',
  '3.1.2 主存储器的组成和基本操作…… 78',
  '3.1.3 存储器的层次化结构 79',
  '3.1.4 存储器的主要性能指标 79',
  '3.1.5 本节习题精选 …… 80',
  '3.1.6 答案与解析… 81',
  '3.2 主存储器……',
  '3.2.1 半导体随机存取存储器 82',
  '3.2.2 非易失性存储器 85',
  '3.2.3 多模块存储器',
  '3.2.4 本节习题精选',
  '3.2.5 答案与解析……',
  '… 85',
  '. 87',
  '53 54 56',
].join('\n')

const PAGE_11 = [
  '目录',
  '3.5.1 程序访问的局部性原理 109',
  '3.5.2 Cache 的基本工作原理… 110',
  '3.5.3 Cache 和主存的映射方式… 111',
  '3.5.5 Cache 的一致性问题… 115',
  '第4章 指令系统',
].join('\n')

const PAGE_12 = [
  '2027年计算机组成原理考研复习指导 XII',
  '5.7.3 多核处理器的基本概念………',
  '5.7.4 共享内存多处理器的基本概念…………',
  '5.7.5 本节习题精选……',
  '5.7.6 答案与解析……',
  '5.8 本章小结…',
  '第6章 总线…',
  '6.1 总线概述…',
  '6.1.1 总线的分类…',
  '6.1.2 常见的总线标准…',
  '6.1.3 总线的性能指标…',
  '6.2 总线事务和定时……',
  '6.2.1 总线事务…',
  '6.2.2 总线定时……',
  '· 269',
  '…… 271',
  '… 274',
  '…… 280',
  '… 283',
].join('\n')

const QUESTION_PAGE = [
  '一、单项选择题',
  '1．下列关于计算机的说法正确的是',
  'A．速度快',
  'B．精度高',
  '2．第二题的题干内容是什么',
  'A．选项一',
  '二、综合应用题',
  '1．大题题干',
].join('\n')

const BODY_TEXT = [
  '一个完整的计算机系统由硬件与软件组成。硬件指有形的物理装置。',
  '计算机系统的实际性能，在很大程度上取决于软件对硬件资源的利用效率。',
  '王道计',
].join('\n')

function scored(pages: { page: number; markdown: string }[]) {
  return pages.map(({ page, markdown }) => scoreTocPageMarkdown(page, markdown))
}

describe('toc-page-detect', () => {
  it('真书形状 8–12 页建议 [8, 12]', () => {
    const selection = selectTocPageRange(
      scored([
        { page: 8, markdown: PAGE_8 },
        { page: 9, markdown: PAGE_9 },
        { page: 10, markdown: PAGE_10 },
        { page: 11, markdown: PAGE_11 },
        { page: 12, markdown: PAGE_12 },
      ]),
    )
    expect(selection.outcome).toBe('found')
    expect(selection.fromPage).toBe(8)
    expect(selection.toPage).toBe(12)
  })

  it('单页强目录可通过（自带标题）', () => {
    const selection = selectTocPageRange(
      scored([
        { page: 3, markdown: BODY_TEXT },
        {
          page: 4,
          markdown: ['目录', '2.3 浮点数……53', '2.3.1 标准……54', '2.3.2 加减……56', '2.3.3 类型……58', '2.3.4 宽度……59', '2.4 小结…75'].join('\n'),
        },
        { page: 5, markdown: BODY_TEXT },
      ]),
    )
    expect(selection.outcome).toBe('found')
    expect(selection.fromPage).toBe(4)
    expect(selection.toPage).toBe(4)
  })

  it('跨页目录中间一页低分仍连段', () => {
    const selection = selectTocPageRange(
      scored([
        { page: 8, markdown: PAGE_8 },
        { page: 9, markdown: BODY_TEXT },
        { page: 10, markdown: PAGE_10 },
      ]),
    )
    expect(selection.outcome).toBe('found')
    expect(selection.fromPage).toBe(8)
    expect(selection.toPage).toBe(10)
  })

  it('正文题号页不误判', () => {
    const scores = scored([{ page: 20, markdown: QUESTION_PAGE }])
    expect(scores[0]?.score).toBeLessThan(25)
    expect(selectTocPageRange(scores).outcome).toBe('not-found')
  })

  it('正文表格单页不误判（无标题不过）', () => {
    const tablePage = [
      '某章小结表格',
      '| 项目 | 数值 |',
      '|---|---|',
      '| 吞吐量 | 100 |',
      '| 响应时间 | 200 |',
      '| 主频 | 300 |',
      '| CPI | 400 |',
    ].join('\n')
    const selection = selectTocPageRange(
      scored([
        { page: 26, markdown: tablePage },
        { page: 27, markdown: BODY_TEXT },
      ]),
    )
    expect(selection.outcome).toBe('not-found')
  })

  it('两段同分候选返回 ambiguous（不覆盖用户范围）', () => {
    const segA = ['目录', '2.1 甲……20', '2.1.1 乙……21', '2.1.2 丙……22', '2.2 丁……23'].join('\n')
    const segB = ['目录', '5.1 戊……100', '5.1.1 己……101', '5.1.2 庚……102', '5.2 辛……103'].join('\n')
    const selection = selectTocPageRange(
      scored([
        { page: 8, markdown: segA },
        { page: 9, markdown: BODY_TEXT },
        { page: 20, markdown: segB },
      ]),
    )
    expect(selection.outcome).toBe('ambiguous')
    expect(selection.fromPage).toBeUndefined()
    expect(selection.candidates).toHaveLength(2)
  })

  it('无可靠候选返回 not-found', () => {
    expect(selectTocPageRange(scored([{ page: 1, markdown: BODY_TEXT }])).outcome).toBe(
      'not-found',
    )
  })

  it('探测窗口上限 40 页且请求列表受限', () => {
    const full = resolveDetectWindow(340)
    expect(full).toHaveLength(40)
    expect(full[0]).toBe(1)
    expect(full[full.length - 1]).toBe(40)
    expect(resolveDetectWindow(10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(resolveDetectWindow(0)).toEqual([])
    expect(resolveDetectWindow(-3)).toEqual([])
    expect(resolveDetectWindow(Number.NaN)).toEqual([])
  })

  it('落子只填范围：found 填建议，ambiguous/not-found 保留', () => {
    expect(
      resolveDetectApply({ fromPage: 1, toPage: 5 }, { outcome: 'found', fromPage: 8, toPage: 12, candidates: [] }),
    ).toEqual({ fromPage: 8, toPage: 12, changed: true, toast: 'suggest' })
    expect(
      resolveDetectApply(
        { fromPage: 1, toPage: 5 },
        { outcome: 'ambiguous', candidates: [{ fromPage: 8, toPage: 9, score: 100 }] },
      ),
    ).toEqual({ fromPage: 1, toPage: 5, changed: false, toast: 'kept' })
    expect(
      resolveDetectApply({ fromPage: 1, toPage: 5 }, { outcome: 'not-found', candidates: [] }),
    ).toEqual({ fromPage: 1, toPage: 5, changed: false, toast: 'kept' })
  })
})
