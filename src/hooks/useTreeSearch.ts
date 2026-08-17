import { useMemo, useState } from 'react'
import { normalize } from '../utils/normalize'
import type { TreeChild, TreeNode } from '../types'

function matches(name: string, keyword: string): boolean {
  return normalize(name).includes(keyword)
}

/**
 * 학부 아래 전공까지 훑는다.
 *
 * 학부 이름이 걸리면 소속 전공을 전부 보여주고,
 * 전공만 걸리면 걸린 전공만 남긴 학부를 돌려준다.
 * 아무것도 안 걸리면 null 이라 상위에서 걸러진다.
 */
function filterChild(child: TreeChild, keyword: string): TreeChild | null {
  if (!child.children?.length) {
    return matches(child.name, keyword) ? child : null
  }

  if (matches(child.name, keyword)) return child

  const hits = child.children.filter((grandchild) => matches(grandchild.name, keyword))
  return hits.length > 0 ? { ...child, children: hits } : null
}

/** 단과대 이름이 걸리면 소속 학과를 전부, 아니면 걸린 학과만 남긴다. */
function filterNode(node: TreeNode, keyword: string): TreeNode | null {
  if (matches(node.name, keyword)) return node

  const hits = node.children
    .map((child) => filterChild(child, keyword))
    .filter((child): child is TreeChild => child !== null)

  return hits.length > 0 ? { ...node, children: hits } : null
}

/** 검색어에 걸리는 가지만 남긴 트리. 검색어가 비면 원본 그대로. */
export function filterTree(nodes: readonly TreeNode[], query: string): TreeNode[] {
  const keyword = normalize(query)
  if (keyword.length === 0) return [...nodes]

  return nodes
    .map((node) => filterNode(node, keyword))
    .filter((node): node is TreeNode => node !== null)
}

interface TreeSearch {
  query: string
  setQuery: (value: string) => void
  /** 검색어가 걸러낸 트리. 검색 중이 아니면 원본. */
  results: TreeNode[]
  /** 검색 중인지. 검색 중일 때는 결과를 펼친 채로 보여준다. */
  isSearching: boolean
}

export function useTreeSearch(nodes: readonly TreeNode[]): TreeSearch {
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterTree(nodes, query), [nodes, query])

  return {
    query,
    setQuery,
    results,
    isSearching: query.trim().length > 0,
  }
}
