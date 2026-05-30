import type { CatalogItem } from '../../domain/rewardCatalog.js'

export type VendorResult =
  | { ok: true; voucherCode: string }
  | { ok: false; reason: string; retryable: boolean }

export type VendorAdapter = (item: CatalogItem) => Promise<VendorResult>

// §5.3.3 — dummy vendor (always succeeds with a deterministic voucher); replace per vendor later
let activeVendor: VendorAdapter = async (item) => ({
  ok: true,
  voucherCode: `${item.vendor.toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
})

export const setRewardVendor = (vendor: VendorAdapter): void => {
  activeVendor = vendor
}

export const resetRewardVendor = (): void => {
  activeVendor = async (item) => ({
    ok: true,
    voucherCode: `${item.vendor.toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  })
}

export const issueVoucher = (item: CatalogItem): Promise<VendorResult> => activeVendor(item)
