import { useEffect, useState } from 'react'
import { X as XIcon } from 'lucide-react'

import { api, type ReachEstimate, type Targeting } from '../lib/api'
import { InfoDot } from '../components/ui/Tooltip'

type Props = {
  open: boolean
  surveyTitle: string
  questionCount: number
  onClose: () => void
  onConfirm: (input: {
    pointsPerUser: number
    targetCount: number
    estimatedReach: number
    targeting: Targeting
  }) => Promise<void> | void
}

const GENDER_OPTIONS: Array<{ value: 'male' | 'female' | 'unspecified'; label: string }> = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'unspecified', label: '선택 안 함' },
]

const INTEREST_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'food', label: '음식' },
  { value: 'tech', label: 'IT · 테크' },
  { value: 'beauty', label: '뷰티' },
  { value: 'fitness', label: '운동 · 건강' },
  { value: 'finance', label: '금융' },
  { value: 'travel', label: '여행' },
]

export function PublishModal({ open, surveyTitle, questionCount, onClose, onConfirm }: Props) {
  const [pointsPerUser, setPointsPerUser] = useState(500)
  const [targetCount, setTargetCount] = useState(200)
  const [ageMin, setAgeMin] = useState(20)
  const [ageMax, setAgeMax] = useState(39)
  const [genders, setGenders] = useState<Array<'male' | 'female' | 'unspecified'>>([
    'male',
    'female',
  ])
  const [interests, setInterests] = useState<string[]>(['food'])
  const [estimate, setEstimate] = useState<ReachEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    const timer = setTimeout(() => {
      const run = async () => {
        setEstimating(true)
        try {
          const res = await api.analytics.estimateReach({
            ageMin,
            ageMax,
            genders,
            interests,
          })
          if (alive) setEstimate(res)
        } catch (err) {
          if (alive) setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (alive) setEstimating(false)
        }
      }
      void run()
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [open, ageMin, ageMax, genders, interests])

  if (!open) return null

  const budget = pointsPerUser * targetCount
  const ageInvalid = ageMin > ageMax
  const blocked = ageInvalid || (estimate ? !estimate.feasible : false)

  const toggleGender = (g: 'male' | 'female' | 'unspecified') => {
    setGenders((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }
  const toggleInterest = (i: string) => {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  }

  const submit = async () => {
    if (!estimate) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({
        pointsPerUser,
        targetCount,
        estimatedReach: estimate.reach,
        targeting: { ageMin, ageMax, genders, interests },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="publish-modal-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <div className="sheet-handle" aria-hidden="true" />
        <header className="modal__head">
          <h3 id="publish-modal-title">발행 설정 · {surveyTitle}</h3>
          <button type="button" className="modal__close" aria-label="닫기" onClick={onClose}>
            <XIcon size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>
        <p className="modal__sub">
          {questionCount}문항 · 타겟을 설정하면 도달 가능한 모수를 실시간으로 보여드려요.
        </p>

        <div className="modal__grid">
          <label className="field">
            <span className="field__label">
              응답자당 포인트
              <InfoDot label="응답 1건당 지급하는 보상 포인트예요. 높을수록 응답률이 올라가지만 예산도 늘어나요." />
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              value={pointsPerUser}
              onChange={(e) => setPointsPerUser(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="field">
            <span className="field__label">
              목표 응답 수
              <InfoDot label="모으고 싶은 응답 개수예요. 이 수와 포인트를 곱한 값이 총 예산이 돼요." />
            </span>
            <input
              type="number"
              min={1}
              max={5000}
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="field">
            <span className="field__label">연령 최소</span>
            <input
              type="number"
              min={13}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(Math.min(99, Math.max(13, Number(e.target.value) || 13)))}
            />
          </label>
          <label className="field">
            <span className="field__label">연령 최대</span>
            <input
              type="number"
              min={13}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(Math.min(99, Math.max(13, Number(e.target.value) || 99)))}
            />
          </label>
        </div>

        {ageInvalid ? (
          <p className="modal__error" role="alert">
            연령 최소가 최대보다 클 수 없어요. 범위를 다시 확인해 주세요.
          </p>
        ) : null}

        <fieldset className="chipset">
          <legend>성별</legend>
          {GENDER_OPTIONS.map((g) => (
            <label
              key={g.value}
              className={`chip-toggle${genders.includes(g.value) ? ' is-on' : ''}`}
            >
              <input
                type="checkbox"
                checked={genders.includes(g.value)}
                onChange={() => toggleGender(g.value)}
              />
              {g.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="chipset">
          <legend>관심사</legend>
          {INTEREST_PRESETS.map((i) => (
            <label
              key={i.value}
              className={`chip-toggle${interests.includes(i.value) ? ' is-on' : ''}`}
            >
              <input
                type="checkbox"
                checked={interests.includes(i.value)}
                onChange={() => toggleInterest(i.value)}
              />
              {i.label}
            </label>
          ))}
        </fieldset>

        <div className={`reach-card${blocked ? ' is-blocked' : ''}`} aria-live="polite">
          <div className="reach-card__row">
            <span className="reach-card__label">
              예상 도달 모수
              <InfoDot label="설정한 타겟 조건에 맞는 패널 수예요. 50명 미만이면 발행이 차단되니 타겟을 넓혀 주세요." />
            </span>
            <strong className="reach-card__value">
              {estimating
                ? '계산하는 중…'
                : estimate
                  ? `${estimate.reach.toLocaleString()}명`
                  : '—'}
            </strong>
          </div>
          <div className="reach-card__row">
            <span className="reach-card__label">예산</span>
            <strong className="reach-card__value">{budget.toLocaleString()} P</strong>
          </div>
          {estimate && estimate.reasons.length > 0 ? (
            <ul className="reach-card__reasons">
              {estimate.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {blocked ? (
            <p className="reach-card__warn" role="alert">
              도달 모수가 50명 미만이에요. 타겟을 조금 넓힌 뒤 다시 시도해 주세요.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void submit()}
            disabled={submitting || estimating || !estimate || blocked}
          >
            {submitting ? '발행하는 중…' : '발행하기'}
          </button>
        </footer>
      </div>
    </div>
  )
}
