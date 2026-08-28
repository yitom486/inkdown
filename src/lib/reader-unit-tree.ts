import type { ReaderUnit } from '@/lib/reader-navigation'

export interface ReaderUnitTreeNode {
  unit: ReaderUnit
  children: ReaderUnitTreeNode[]
}

/** 将带 level 的扁平目录还原为树（用于 PDF outline 折叠） */
export function buildReaderUnitTree(units: ReaderUnit[]): ReaderUnitTreeNode[] {
  const roots: ReaderUnitTreeNode[] = []
  const stack: Array<{ level: number; node: ReaderUnitTreeNode }> = []

  for (const unit of units) {
    const node: ReaderUnitTreeNode = { unit, children: [] }

    while (stack.length > 0 && stack[stack.length - 1]!.level >= unit.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1]!.node.children.push(node)
    }

    stack.push({ level: unit.level, node })
  }

  return roots
}

/** 默认展开到第 2 层（depth 0、1 的节点展开） */
export function shouldExpandReaderUnitNode(depth: number, maxExpandedDepth = 1): boolean {
  return depth <= maxExpandedDepth
}
