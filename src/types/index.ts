import type { CategoryKey } from '../constants/colors'

export type BuildingCategory = '강의' | '식당' | '편의' | '주차'

export interface BuildingLink {
  label: string
  url: string
}

export interface Building {
  name: string
  lat: number
  lng: number
  cx: number
  cy: number
  color: string
  category: BuildingCategory
  type: string
  floors: number
  hours: string
  anchorX: number
  anchorY: number
  description?: string
  facilities?: string[]
  contact?: string
  link?: BuildingLink
  boundary?: [number, number][]
}

export interface TreeNode {
  name: string
  children: TreeChild[]
}

export interface TreeChild {
  id: string
  name: string
}

export interface NewsItem {
  category: CategoryKey
  title: string
  preview: string
  source: string
  sourceId: string
  date: string
}

export type FilterChip = '전체' | BuildingCategory
