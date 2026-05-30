import { useState } from 'react'

import type { Survey } from '../lib/api'

type Props = {
  title: string
  category?: string
  pointsPerUser?: number
  questions: Survey['questions']
}

export function MobilePreview({ title, category, pointsPerUser, questions }: Props) {
  const [index, setIndex] = useState(0)
  const total = questions.length
  const safeIndex = Math.min(index, Math.max(total - 1, 0))
  const current = questions[safeIndex]
  const progress = total > 0 ? Math.round(((safeIndex + 1) / total) * 100) : 0

  return (
    <aside className="mobile-preview" aria-label="모바일 미리보기">
      <div className="mobile-preview__device">
        <div className="mobile-preview__notch" aria-hidden="true" />
        <div className="mobile-preview__screen">
          <header className="mp-card__head">
            <span className="mp-card__category">{category ?? 'general'}</span>
            {pointsPerUser ? <span className="mp-card__points">{pointsPerUser} P</span> : null}
          </header>
          <h4 className="mp-card__title">{title || '제목 없음'}</h4>
          {total > 0 ? (
            <>
              <div className="mp-card__progress" aria-hidden="true">
                <div className="mp-card__progressFill" style={{ width: `${progress}%` }} />
              </div>
              <p className="mp-card__meta">
                Q{safeIndex + 1} / {total}
              </p>
              <p className="mp-card__question">{current?.text}</p>
              <ul className="mp-card__choices">
                {current?.type === 'text' ? (
                  <li className="mp-card__text">자유 응답…</li>
                ) : (
                  (current?.choices ?? []).slice(0, 6).map((c) => (
                    <li key={c.id} className="mp-card__choice">
                      {c.label}
                    </li>
                  ))
                )}
              </ul>
              <div className="mp-card__nav">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={safeIndex === 0}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  disabled={safeIndex >= total - 1}
                >
                  다음
                </button>
              </div>
            </>
          ) : (
            <p className="mp-card__empty">초안을 생성하면 카드 형태로 미리볼 수 있습니다.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
