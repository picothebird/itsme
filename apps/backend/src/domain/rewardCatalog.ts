export type CatalogItem = {
  id: string
  label: string
  vendor: 'naverpay' | 'starbucks' | 'cu'
  cost: number
  imageUrl?: string
}

export const REWARD_CATALOG: CatalogItem[] = [
  { id: 'reward_npay_1000', label: '네이버페이 1,000원', vendor: 'naverpay', cost: 1000 },
  { id: 'reward_npay_5000', label: '네이버페이 5,000원', vendor: 'naverpay', cost: 5000 },
  { id: 'reward_sbux_americano', label: '스타벅스 아메리카노', vendor: 'starbucks', cost: 4500 },
  { id: 'reward_cu_3000', label: 'CU 모바일상품권 3,000원', vendor: 'cu', cost: 3000 },
]

export const findCatalogItem = (id: string): CatalogItem | undefined =>
  REWARD_CATALOG.find((item) => item.id === id)
