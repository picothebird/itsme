import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, type RewardItem, type RewardOrder } from '../lib/api'

type Toast = { kind: 'info' | 'error'; message: string } | null

const ORDER_STATUS_LABEL: Record<string, string> = {
  issued: '발급 완료',
  pending: '처리 중',
  failed: '실패',
  refunded: '환불',
}

type Props = {
  pid: string
  /** parent-supplied balance; falls back to internal fetch when undefined */
  balance: number | null
  onRedeemed?: () => void
}

const generateIdempotencyKey = (): string => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `idem-${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function WalletPanel({ pid, balance, onRedeemed }: Props) {
  const [catalog, setCatalog] = useState<RewardItem[]>([])
  const [orders, setOrders] = useState<RewardOrder[]>([])
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const [items, recent] = await Promise.all([api.wallet.catalog(), api.wallet.orders(pid)])
        if (cancelled) return
        setCatalog(items)
        setOrders(recent)
      } catch {
        if (!cancelled) setToast({ kind: 'error', message: '리워드 목록을 불러오지 못했어요.' })
      }
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [pid])

  const sortedCatalog = useMemo(() => [...catalog].sort((a, b) => a.cost - b.cost), [catalog])

  const redeem = useCallback(
    async (item: RewardItem) => {
      if (busyItem) return
      if (balance != null && balance < item.cost) {
        setToast({ kind: 'error', message: '포인트 잔액이 부족해요.' })
        return
      }
      setBusyItem(item.id)
      try {
        const { order, idempotent } = await api.wallet.redeem({
          pid,
          itemId: item.id,
          idempotencyKey: generateIdempotencyKey(),
        })
        setToast({
          kind: 'info',
          message: idempotent
            ? '이미 처리된 주문이에요.'
            : `교환 완료 · ${order.itemLabel} · ${order.voucherCode ?? '-'}`,
        })
        const recent = await api.wallet.orders(pid)
        setOrders(recent)
        onRedeemed?.()
      } catch (err) {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : '교환에 실패했어요',
        })
      } finally {
        setBusyItem(null)
      }
    },
    [balance, busyItem, onRedeemed, pid],
  )

  return (
    <section className="card" aria-label="리워드 상점">
      <div className="card__head">
        <h3>리워드 상점</h3>
        <span className="card__count">
          잔액 {balance != null ? balance.toLocaleString() : '—'} P
        </span>
      </div>

      <div className="reward-grid">
        {sortedCatalog.map((item) => {
          const disabled = busyItem === item.id || (balance != null && balance < item.cost)
          return (
            <article key={item.id} className="reward-card">
              <span className="reward-card__vendor">{item.vendor}</span>
              <h4 className="reward-card__label">{item.label}</h4>
              <div className="reward-card__footer">
                <span className="reward-card__cost">{item.cost.toLocaleString()} P</span>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={disabled}
                  onClick={() => void redeem(item)}
                >
                  {busyItem === item.id ? '교환하는 중…' : '교환하기'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {orders.length > 0 ? (
        <div className="reward-orders">
          <h4>최근 주문</h4>
          <ul>
            {orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <span className={`reward-orders__status reward-orders__status--${order.status}`}>
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span className="reward-orders__label">{order.itemLabel}</span>
                <span className="reward-orders__voucher">{order.voucherCode ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast toast--${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}
