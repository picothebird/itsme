import { useEffect, useRef, useState } from 'react'
import { X, Check, Sparkles } from 'lucide-react'

import { api, getAuthToken, setAuthToken, type Account } from '../lib/api'
import { PanelistMobile } from './PanelistMobile'
import { PetCreature } from './PetCreature'
import { creatureStageFromLevel } from '../lib/petStage'
import { InfoDot } from '../components/ui/Tooltip'
import { celebrate } from '../lib/celebrate'

type Props = {
  onClose?: () => void
}

type Phase = 'loading' | 'login' | 'onboarding' | 'hatch' | 'app'

type HatchResult = {
  welcomeBonus: number
  pet: { level: number; evolutionStage: string | null }
}

const PROVIDERS: Array<{
  id: 'kakao' | 'apple' | 'google'
  label: string
  className: string
}> = [
  { id: 'kakao', label: '카카오로 시작하기', className: 'pm-oauth--kakao' },
  { id: 'apple', label: 'Apple로 시작하기', className: 'pm-oauth--apple' },
  { id: 'google', label: 'Google로 시작하기', className: 'pm-oauth--google' },
]

const INTEREST_OPTIONS = [
  '음식',
  'IT·테크',
  '뷰티',
  '운동·건강',
  '금융',
  '여행',
  '패션',
  '게임',
  '교육',
  '반려동물',
]

const currentYear = new Date().getFullYear()

export function PanelistApp({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (getAuthToken() ? 'loading' : 'login'))
  const [account, setAccount] = useState<Account | null>(null)
  const [hatch, setHatch] = useState<HatchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    const token = getAuthToken()
    if (!token) return
    api.auth
      .me()
      .then((data) => {
        setAccount(data.account)
        setPhase(data.account.onboarded ? 'app' : 'onboarding')
      })
      .catch(() => {
        setAuthToken(null)
        setPhase('login')
      })
  }, [])

  const handleLogin = async (provider: 'kakao' | 'apple' | 'google') => {
    setBusy(true)
    setError(null)
    try {
      // MVP: a stable per-device pseudo identity stands in for the real OAuth
      // round-trip. Production swaps this for the provider's id_token.
      const providerUserId = deviceIdentity(provider)
      const res = await api.auth.login({ provider, providerUserId, displayName: '데모 패널' })
      setAuthToken(res.token)
      setAccount(res.account)
      setPhase(res.nextStep === 'onboarding' ? 'onboarding' : 'app')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  const handleOnboard = async (input: {
    birthYear: number
    gender: 'male' | 'female' | 'unspecified'
    interests: string[]
  }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.auth.onboarding(input)
      setAccount(res.account)
      setHatch({ welcomeBonus: res.welcomeBonus, pet: res.pet })
      setPhase('hatch')
    } catch (err) {
      setError(err instanceof Error ? err.message : '온보딩에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'app' && account) {
    return <PanelistMobile pid={account.pid} onClose={onClose} />
  }

  return (
    <div
      className={`pm-root${onClose ? '' : ' pm-root--standalone'}`}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? 'true' : undefined}
      aria-label="패널 로그인"
    >
      <header className="pm-topbar">
        <div className="pm-topbar__brand">
          {onClose ? (
            <button
              type="button"
              className="pm-iconbtn pm-iconbtn--tight"
              onClick={onClose}
              aria-label="닫기"
            >
              <X size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
          <span className="pm-topbar__logo" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="26" height="26">
              <defs>
                <linearGradient id="pm-app-logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#9C8CFF" />
                  <stop offset="1" stopColor="#6D5BE0" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="26" height="26" rx="9" fill="url(#pm-app-logo-grad)" />
              <circle cx="11" cy="13" r="2.4" fill="#fff" />
              <circle cx="18" cy="13" r="2.4" fill="#fff" />
              <path
                d="M10.5 18.5q3.5 3 7 0"
                stroke="#fff"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="pm-topbar__wordmark">itsme</span>
        </div>
      </header>

      {error ? (
        <div className="pm-toast" role="alert">
          {error}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setError(null)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ) : null}

      {phase === 'loading' ? (
        <main className="pm-stage pm-stage--center pm-bootsplash" aria-busy="true">
          <div className="pm-bootsplash__egg" aria-hidden>
            <div className="pm-bootsplash__egg-shine" />
          </div>
          <p className="pm-bootsplash__label" role="status" aria-live="polite">
            정령을 깨우는 중...
          </p>
        </main>
      ) : null}

      {phase === 'login' ? <LoginStage busy={busy} onLogin={handleLogin} /> : null}

      {phase === 'onboarding' ? <OnboardingStage busy={busy} onSubmit={handleOnboard} /> : null}

      {phase === 'hatch' && hatch ? (
        <HatchStage hatch={hatch} onStart={() => setPhase('app')} />
      ) : null}
    </div>
  )
}

function LoginStage({
  busy,
  onLogin,
}: {
  busy: boolean
  onLogin: (provider: 'kakao' | 'apple' | 'google') => void
}) {
  return (
    <main className="pm-stage pm-login">
      <div className="pm-login__hero">
        <div className="pm-login__egg" aria-hidden>
          <div className="pm-login__egg-shine" />
        </div>
        <h1 className="pm-login__title">
          질문에 답하고
          <br />
          정령을 키워요
        </h1>
        <p className="pm-login__sub">
          간단한 설문으로 포인트를 모으고
          <br />
          나만의 데이터 정령을 진화시켜요.
        </p>
      </div>
      <div className="pm-login__providers">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pm-oauth ${p.className}`}
            onClick={() => onLogin(p.id)}
            disabled={busy}
          >
            <ProviderIcon id={p.id} />
            <span className="pm-oauth__label">{p.label}</span>
          </button>
        ))}
        <p className="pm-login__legal">가입 시 이용약관·개인정보 처리방침에 동의하게 돼요.</p>
      </div>
    </main>
  )
}

function YearWheel({
  years,
  value,
  onChange,
}: {
  years: number[]
  value: number | null
  onChange: (year: number) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Center the selected (or a sensible default) on first render.
  useEffect(() => {
    const target = value ?? years[Math.floor(years.length / 2)]
    if (value === null) onChangeRef.current(target)
    const el = itemRefs.current.get(target)
    el?.scrollIntoView({ block: 'center' })
    // mount-only: intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Select whichever year scrolls into the center band.
  useEffect(() => {
    const root = listRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const year = Number((entry.target as HTMLElement).dataset.year)
          if (!Number.isNaN(year)) onChangeRef.current(year)
        }
      },
      { root, rootMargin: '-46% 0px -46% 0px', threshold: 0 },
    )
    itemRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="pm-wheel" role="group" aria-label="태어난 해 선택">
      <div className="pm-wheel__band" aria-hidden />
      <ul className="pm-wheel__list" ref={listRef}>
        {years.map((y) => {
          const selected = value === y
          return (
            <li
              key={y}
              ref={(el) => {
                if (el) itemRefs.current.set(y, el)
                else itemRefs.current.delete(y)
              }}
              data-year={y}
              className={`pm-wheel__item${selected ? ' is-selected' : ''}`}
            >
              <button
                type="button"
                className="pm-wheel__btn"
                aria-pressed={selected}
                onClick={(e) => {
                  onChange(y)
                  e.currentTarget.parentElement?.scrollIntoView({
                    block: 'center',
                    behavior: 'smooth',
                  })
                }}
              >
                {y}
                <span className="pm-wheel__unit">년</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function OnboardingStage({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (input: {
    birthYear: number
    gender: 'male' | 'female' | 'unspecified'
    interests: string[]
  }) => void
}) {
  const [step, setStep] = useState(0)
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified' | null>(null)
  const [interests, setInterests] = useState<string[]>([])

  const years = Array.from({ length: 60 }, (_, i) => currentYear - 14 - i)

  const toggleInterest = (label: string) => {
    setInterests((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]))
  }

  const canNext =
    step === 0 ? birthYear !== null : step === 1 ? gender !== null : interests.length > 0

  const next = () => {
    if (step < 2) {
      setStep((s) => s + 1)
      return
    }
    if (birthYear && gender && interests.length > 0) {
      onSubmit({ birthYear, gender, interests })
    }
  }

  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <main className="pm-stage pm-onboard">
      <div
        className="pm-onboard__progress"
        role="group"
        aria-label={`온보딩 3단계 중 ${step + 1}단계`}
      >
        <div className="pm-onboard__dots" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`pm-dot${i <= step ? ' is-active' : ''}`} />
          ))}
        </div>
        <span className="pm-onboard__count" role="status" aria-live="polite">
          {step + 1} / 3
        </span>
      </div>

      {step === 0 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">태어난 해를 알려주세요</h2>
          <p className="pm-q__hint">맞춤 설문을 추천하는 데 사용돼요.</p>
          <YearWheel years={years} value={birthYear} onChange={setBirthYear} />
        </section>
      ) : null}

      {step === 1 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">성별을 선택해주세요</h2>
          <div className="pm-choices">
            {(
              [
                { v: 'female', l: '여성' },
                { v: 'male', l: '남성' },
                { v: 'unspecified', l: '선택 안 함' },
              ] as const
            ).map((g) => (
              <button
                key={g.v}
                type="button"
                className={`pm-choice${gender === g.v ? ' is-selected' : ''}`}
                onClick={() => setGender(g.v)}
              >
                <span className="pm-choice__bullet" aria-hidden>
                  {gender === g.v ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className="pm-choice__label">{g.l}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">
            관심사를 골라주세요
            <InfoDot
              label="입력한 정보는 맞춤 설문 추천에만 쓰이고, 설정에서 언제든 바꾸거나 삭제할 수 있어요."
              placement="bottom"
            />
          </h2>
          <p className="pm-q__hint">정령이 좋아하는 주제가 돼요. (1개 이상)</p>
          <div className="pm-taggrid">
            {INTEREST_OPTIONS.map((label) => (
              <button
                key={label}
                type="button"
                className={`pm-chip pm-chip--lg${interests.includes(label) ? ' is-selected' : ''}`}
                onClick={() => toggleInterest(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pm-bottom-cta pm-bottom-cta--row">
        {step > 0 ? (
          <button
            type="button"
            className="pm-btn pm-btn--ghost pm-btn--xl"
            onClick={back}
            disabled={busy}
          >
            이전
          </button>
        ) : null}
        <button
          type="button"
          className="pm-btn pm-btn--primary pm-btn--xl"
          onClick={next}
          disabled={!canNext || busy}
        >
          {step < 2 ? '다음' : busy ? '정령을 깨우는 중...' : '정령 깨우기'}
        </button>
      </div>
    </main>
  )
}

function HatchStage({ hatch, onStart }: { hatch: HatchResult; onStart: () => void }) {
  const [cracked, setCracked] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCracked(true)
      celebrate({ intensity: 'big' })
    }, 900)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <main className="pm-stage pm-stage--center pm-hatch">
      <div className={`pm-hatch__egg${cracked ? ' is-cracked' : ''}`} aria-hidden>
        <div className="pm-hatch__egg-top" />
        <div className="pm-hatch__egg-bottom" />
        <PetCreature
          stage={creatureStageFromLevel(hatch.pet.level)}
          size={88}
          className="pm-hatch__spirit"
        />
        <div className="pm-hatch__sparkle pm-hatch__sparkle--1" />
        <div className="pm-hatch__sparkle pm-hatch__sparkle--2" />
        <div className="pm-hatch__sparkle pm-hatch__sparkle--3" />
      </div>

      <p className="pm-celebrate__eyebrow" aria-live="polite">
        {cracked ? '정령이 깨어났어요!' : '알을 깨우는 중...'}
      </p>
      <h1 className="pm-hatch__title">
        <Sparkles size={18} strokeWidth={2.2} aria-hidden="true" />
        나만의 데이터 정령 탄생
      </h1>

      {hatch.welcomeBonus > 0 ? (
        <p className="pm-celebrate__points">
          +{hatch.welcomeBonus}
          <span className="pm-celebrate__unit">P</span>
        </p>
      ) : null}
      <p className="pm-celebrate__body">
        가입 보너스가 지갑에 들어왔어요. 질문에 답할수록 정령이 함께 자라요.
      </p>

      <div className="pm-celebrate__actions">
        <button
          type="button"
          className="pm-btn pm-btn--primary pm-btn--xl"
          onClick={onStart}
          disabled={!cracked}
        >
          {cracked ? '첫 설문 시작하기' : '잠시만요...'}
        </button>
      </div>
    </main>
  )
}

/**
 * Brand glyphs for the social providers. Inline SVG keeps the bundle lean and
 * avoids shipping a full brand-icon package for three logos.
 */
function ProviderIcon({ id }: { id: 'kakao' | 'apple' | 'google' }) {
  if (id === 'kakao') {
    return (
      <svg className="pm-oauth__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.99 3 3 6.2 3 10.13c0 2.52 1.68 4.73 4.2 5.99-.18.65-.67 2.43-.77 2.81-.12.47.17.46.36.34.15-.1 2.4-1.63 3.37-2.29.41.06.82.09 1.24.09 5.01 0 9-3.2 9-7.13S17.01 3 12 3Z"
        />
      </svg>
    )
  }
  if (id === 'apple') {
    return (
      <svg className="pm-oauth__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.36 12.78c.03 2.86 2.5 3.81 2.53 3.82-.02.07-.4 1.36-1.31 2.69-.79 1.15-1.61 2.29-2.9 2.32-1.27.02-1.68-.75-3.13-.75-1.45 0-1.9.73-3.1.78-1.25.05-2.2-1.24-3-2.39-1.62-2.34-2.86-6.61-1.2-9.5.83-1.43 2.3-2.34 3.9-2.36 1.22-.02 2.38.82 3.13.82.75 0 2.16-1.02 3.64-.87.62.03 2.36.25 3.48 1.89-.09.06-2.08 1.22-2.05 3.62ZM14.03 4.5c.66-.8 1.1-1.92.98-3.03-.95.04-2.1.63-2.78 1.43-.61.71-1.15 1.84-1 2.93 1.06.08 2.14-.54 2.8-1.33Z"
        />
      </svg>
    )
  }
  return (
    <svg className="pm-oauth__icon" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  )
}

/**
 * Stable per-device identity so re-opening the demo resumes the same account.
 * Real builds replace this with the provider's verified user id.
 */
function deviceIdentity(provider: string): string {
  const key = `itsme.device.${provider}`
  let id = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  if (!id) {
    id = `${provider}_${Math.random().toString(36).slice(2, 10)}`
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, id)
  }
  return id
}
