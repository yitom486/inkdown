/**
 * 流式稳定区/尾部分割：已闭合的块冻结复用，只重解析正在生成的尾部。
 * 保守策略：边界只取围栏之外、数学定界符之外的最后 "\n\n"；
 * 拿不准就宁可尾部大一点，完成时再整段精确渲染一次。
 */
export function isInsideFence(text: string): boolean {
  return ((text.match(/^```/gm) ?? []).length % 2) === 1
}

export function findStableBoundary(text: string): number {
  if (!text) return 0
  // 数学定界符未闭合（$…/$$…/\(…\)）时整段视为不稳定
  const dollars = (text.match(/\$\$/g) ?? []).length
  if (dollars % 2 === 1) return 0
  let idx = text.lastIndexOf('\n\n')
  while (idx > 0) {
    const head = text.slice(0, idx)
    if (!isInsideFence(head)) return idx + 2
    idx = head.lastIndexOf('\n\n')
  }
  return 0
}

export function splitStableTail(text: string): { stable: string; tail: string } {
  const at = findStableBoundary(text)
  return { stable: text.slice(0, at), tail: text.slice(at) }
}
