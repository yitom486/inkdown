import { describe, expect, it } from 'vitest'
import {
  backfillMissingPages,
  cleanupOcrTocTitle,
  extractOcrTocFromText,
  inferLevel,
  isBareChapterTitle,
  isDigitSoupTitle,
  isWatermarkTocEntry,
  normalizeOcrChinese,
} from '@shared/reader/ocr-toc-extractor'

describe('ocr-toc-extractor', () => {
  it('normalizeOcrChinese 合并汉字间空格', () => {
    expect(normalizeOcrChinese('计 算 机 发 展')).toBe('计算机发展')
  })

  it('从目录 OCR 文本提取章节', () => {
    const sample = `
日 录
#]1 1 计算 机 发 展 历 程 2
111 计算 机 硬件 的 发 展 1
112 计算 机 软件 的 发 展 2
12.6 计算 机 系统 的 工作 原 理 7
12.8 答案 与 解析 9
第 2 章 数据 的 表示 和 运算 20
2.12 定 点 数 的 编码 表示 2
官方 开源 ， 高 清 带 书签 PDF
`
    const entries = extractOcrTocFromText(sample)
    const titles = entries.map((e) => e.title)
    expect(titles.some((t) => t.includes('计算机发展') || t.startsWith('第1章'))).toBe(true)
    expect(titles.some((t) => t.includes('12.6') && t.includes('工作原理'))).toBe(true)
    expect(entries.every((e) => e.printedPage > 0)).toBe(true)
    expect(entries.some((e) => e.raw.includes('官方'))).toBe(false)
  })

  it('无页码父项从后继条目继承页码', () => {
    const entries = extractOcrTocFromText('第3章 存储系统\n3.1 主存储器\n3.1.1 概述 45\n3.1.2 组成 47\n')
    const byTitle = new Map(entries.map((e) => [e.title, e.printedPage]))
    // 章行无数字必是数字丢失（真目录章必带页码），不继承只丢弃
    expect(byTitle.has('第3章存储系统')).toBe(false)
    // 节父项与长子同起一页，继承合理
    expect(byTitle.get('3.1主存储器')).toBe(45)
    expect(byTitle.get('3.1.1概述')).toBe(45)
    // 尾部无后继的不收留
    expect(extractOcrTocFromText('3.1.1 概述 45\n尾部无页码父项')).toHaveLength(1)
  })

  it('同级兄弟不回填（防数字涂抹），仅父项继承长子', () => {
    const siblings = ['3.1 父项', '3.2 父项', '3.3 父项', '3.4 父项', '3.5 落点 45'].join('\n')
    // 3.1..3.4 与 3.5 同为 level1 兄弟：继承必错位，一律丢弃只留落点
    expect(extractOcrTocFromText(siblings).map((e) => e.title)).toEqual(['3.5落点'])
    // 父项 level1 < 长子 level2：继承合理（父与长子同起一页）
    const parent = extractOcrTocFromText('3.1 父项\n3.1.1 长子 45\n')
    expect(parent.map((e) => `${e.title}|${e.printedPage}`)).toEqual(['3.1父项|45', '3.1.1长子|45'])
  })

  it('水印碎片不成目录条目', () => {
    expect(isWatermarkTocEntry('87929797王道计')).toBe(true)
    expect(isWatermarkTocEntry('王道计 育')).toBe(true)
    expect(isWatermarkTocEntry('早机教育')).toBe(true)
    expect(isWatermarkTocEntry('1.2.6 计算机系统的工作原理')).toBe(false)
    expect(isWatermarkTocEntry('第1章 计算机系统概述')).toBe(false)
    expect(isWatermarkTocEntry('王道训练营')).toBe(false)

    const entries = extractOcrTocFromText('87929797王道计 149\n3.1.2主存储器的组成 31\n')
    expect(entries.map((e) => e.title)).toEqual(['3.1.2主存储器的组成'])
  })

  it('数字汤不成目录条目（短节名豁免）', () => {    expect(isDigitSoupTitle('…251254王道238242242')).toBe(true)
    expect(isDigitSoupTitle('3.1.2主存储器的组成和基本操作')).toBe(false)
    expect(isDigitSoupTitle('3.1.1概述')).toBe(false)
    expect(isDigitSoupTitle('第1章 计算机系统概述')).toBe(false)
    const entries = extractOcrTocFromText('3.1.2 主存储器的组成 78\n…251254王道238242242 254\n')
    expect(entries.map((e) => e.title)).toEqual(['3.1.2主存储器的组成'])
  })

  it('三段号是小节 level2（防侧栏扁平与同级回填）', () => {
    expect(inferLevel('第1章 概述')).toBe(0)
    expect(inferLevel('2.1 数制')).toBe(1)
    expect(inferLevel('2.1.1 进制')).toBe(2)
    expect(inferLevel('3.5.4 替换算法')).toBe(2)
    expect(cleanupOcrTocTitle('*7.1.1输入/输出系统')).toBe('7.1.1输入/输出系统')
    expect(cleanupOcrTocTitle('1.1历程①')).toBe('1.1历程')
  })

  it('* 黏连行拆成多条（删纲标记）', () => {
    const entries = extractOcrTocFromText('*7.1.1 输入/输出系统 *7.1.2 外部设备\n7.1.3 有页码 291\n')
    // 7.1.1/7.1.2 与 7.1.3 同级不继承，只留落点；拆分本身不断言页码，只断言不吞条
    expect(entries.some((e) => e.title.includes('7.1.3'))).toBe(true)
  })

  it('backfillMissingPages 纯函数语义', () => {
    expect(isBareChapterTitle('第3章 存储系统')).toBe(true)
    expect(isBareChapterTitle('3.1 主存储器')).toBe(false)
    const filled = backfillMissingPages([
      { title: '第3章', printedPage: null, level: 0 },
      { title: '3.1', printedPage: null, level: 1 },
      { title: '3.1.1', printedPage: 45, level: 2 },
    ])
    // 章无章节号前缀、调用方另行过滤：第3章不继承只丢弃，3.1←3.1.1 父子继承
    expect(filled.map((e) => e.printedPage)).toEqual([null, 45, 45])
  })
})
