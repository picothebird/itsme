/**
 * PetCreature — 잇츠미 정령(다마고치) 캐릭터 에셋.
 *
 * 외부 래스터 에셋(라이선스/품질 리스크) 대신, 레벨별 진화 단계와 기분 상태를
 * 표현하는 자체 제작 인라인 SVG 캐릭터. 테마(보라 계열)와 일관되며, 다크 모드에서도
 * 선명하게 보이도록 설계. 아이들 모션은 CSS(`pm-creature`)에서 제어하며
 * prefers-reduced-motion을 존중한다.
 */

export type PetCreatureStage = 'egg' | 'baby' | 'adult'
export type PetCreatureMood = 'happy' | 'sick'

type Props = {
  stage: PetCreatureStage
  mood?: PetCreatureMood
  size?: number
  /** 아이들 애니메이션(둥실/깜빡임) 적용 여부 */
  animated?: boolean
  className?: string
}

const BODY_HAPPY = { from: '#9C8CFF', to: '#6D5BE0' }
const BODY_SICK = { from: '#B7B4C9', to: '#8E8AA6' }

export function PetCreature({
  stage,
  mood = 'happy',
  size = 96,
  animated = true,
  className,
}: Props) {
  const body = mood === 'sick' ? BODY_SICK : BODY_HAPPY
  const gid = `${stage}-${mood}`
  const rootClass = [
    'pm-creature',
    animated ? 'pm-creature--animated' : '',
    mood === 'sick' ? 'pm-creature--sick' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={rootClass}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`body-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={body.from} />
          <stop offset="1" stopColor={body.to} />
        </linearGradient>
        <radialGradient id={`cheek-${gid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF9FB6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FF9FB6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`egg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6E6" />
          <stop offset="1" stopColor="#FFE6C2" />
        </linearGradient>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse
        className="pm-creature__shadow"
        cx="60"
        cy="108"
        rx="30"
        ry="6"
        fill="#000"
        opacity="0.08"
      />

      <g className="pm-creature__body">
        {stage === 'egg' ? (
          <EggStage gid={gid} mood={mood} />
        ) : stage === 'baby' ? (
          <BabyStage gid={gid} mood={mood} />
        ) : (
          <AdultStage gid={gid} mood={mood} />
        )}
      </g>

      {mood === 'sick' ? (
        <g className="pm-creature__sweat">
          <path
            d="M88 40c0 3.3-2.4 6-5.4 6s-5.4-2.7-5.4-6 5.4-9 5.4-9 5.4 5.7 5.4 9z"
            fill="#7FD4FF"
          />
        </g>
      ) : null}
    </svg>
  )
}

function Eyes({
  mood,
  cx = 60,
  cy = 60,
  gap = 13,
}: {
  mood: PetCreatureMood
  cx?: number
  cy?: number
  gap?: number
}) {
  if (mood === 'sick') {
    // 반쯤 감긴 풀 죽은 눈 ( > < )
    return (
      <g stroke="#4B4660" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={`M${cx - gap - 4} ${cy - 3} L${cx - gap + 4} ${cy} L${cx - gap - 4} ${cy + 3}`} />
        <path d={`M${cx + gap + 4} ${cy - 3} L${cx + gap - 4} ${cy} L${cx + gap + 4} ${cy + 3}`} />
      </g>
    )
  }
  return (
    <g className="pm-creature__eyes">
      <circle className="pm-creature__eye" cx={cx - gap} cy={cy} r="5.4" fill="#2A2540" />
      <circle className="pm-creature__eye" cx={cx + gap} cy={cy} r="5.4" fill="#2A2540" />
      <circle cx={cx - gap - 1.6} cy={cy - 1.8} r="1.8" fill="#fff" />
      <circle cx={cx + gap - 1.6} cy={cy - 1.8} r="1.8" fill="#fff" />
    </g>
  )
}

function Mouth({ mood, cx = 60, cy = 72 }: { mood: PetCreatureMood; cx?: number; cy?: number }) {
  if (mood === 'sick') {
    return (
      <path
        d={`M${cx - 6} ${cy + 2} q6 -5 12 0`}
        stroke="#4B4660"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    )
  }
  return (
    <path
      d={`M${cx - 7} ${cy} q7 7 14 0`}
      stroke="#2A2540"
      strokeWidth="2.6"
      fill="none"
      strokeLinecap="round"
    />
  )
}

function Cheeks({
  gid,
  cx = 60,
  cy = 68,
  gap = 22,
}: {
  gid: string
  cx?: number
  cy?: number
  gap?: number
}) {
  return (
    <g>
      <circle cx={cx - gap} cy={cy} r="7" fill={`url(#cheek-${gid})`} />
      <circle cx={cx + gap} cy={cy} r="7" fill={`url(#cheek-${gid})`} />
    </g>
  )
}

function EggStage({ gid, mood }: { gid: string; mood: PetCreatureMood }) {
  return (
    <g>
      <ellipse
        cx="60"
        cy="62"
        rx="34"
        ry="40"
        fill={`url(#egg-${gid})`}
        stroke="#F2D2A0"
        strokeWidth="1.5"
      />
      {/* 얼룩 점무늬 */}
      <circle cx="46" cy="48" r="4" fill="#C9A6FF" opacity="0.85" />
      <circle cx="74" cy="56" r="5" fill="#A6E3C0" opacity="0.85" />
      <circle cx="52" cy="78" r="3.5" fill="#FFC59B" opacity="0.85" />
      {/* 균열 */}
      <path
        d="M40 66 L48 62 L44 70 L54 66 L50 74"
        stroke="#E0B884"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 광택 */}
      <ellipse
        cx="50"
        cy="44"
        rx="7"
        ry="11"
        fill="#fff"
        opacity="0.45"
        transform="rotate(-20 50 44)"
      />
      <Eyes mood={mood} cx={60} cy={64} gap={11} />
      <Mouth mood={mood} cx={60} cy={76} />
    </g>
  )
}

function BabyStage({ gid, mood }: { gid: string; mood: PetCreatureMood }) {
  return (
    <g>
      {/* 새싹 안테나 */}
      <path
        className="pm-creature__sprout"
        d="M60 26 C60 16 60 14 60 30"
        stroke="#4FB477"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="pm-creature__sprout"
        d="M60 22 C54 16 50 18 56 24 C58 26 60 25 60 22Z"
        fill="#6FD08C"
      />
      <path
        className="pm-creature__sprout"
        d="M60 24 C66 18 70 21 64 27 C62 28 60 27 60 24Z"
        fill="#57BE7A"
      />
      {/* 몸통 */}
      <circle cx="60" cy="66" r="34" fill={`url(#body-${gid})`} />
      {/* 발 */}
      <ellipse cx="48" cy="98" rx="8" ry="5" fill={`url(#body-${gid})`} />
      <ellipse cx="72" cy="98" rx="8" ry="5" fill={`url(#body-${gid})`} />
      {/* 배 하이라이트 */}
      <ellipse cx="60" cy="74" rx="20" ry="17" fill="#fff" opacity="0.16" />
      <Cheeks gid={gid} cx={60} cy={70} gap={21} />
      <Eyes mood={mood} cx={60} cy={62} gap={12} />
      <Mouth mood={mood} cx={60} cy={74} />
    </g>
  )
}

function AdultStage({ gid, mood }: { gid: string; mood: PetCreatureMood }) {
  return (
    <g>
      {/* 오라 링 */}
      {mood === 'happy' ? (
        <ellipse
          className="pm-creature__halo"
          cx="60"
          cy="20"
          rx="20"
          ry="6"
          fill="none"
          stroke="#FFD66B"
          strokeWidth="3"
          opacity="0.9"
        />
      ) : null}
      {/* 날개 */}
      <path
        className="pm-creature__wing pm-creature__wing--l"
        d="M30 60 C8 50 8 78 30 74 C24 68 24 66 30 60Z"
        fill={`url(#body-${gid})`}
        opacity="0.92"
      />
      <path
        className="pm-creature__wing pm-creature__wing--r"
        d="M90 60 C112 50 112 78 90 74 C96 68 96 66 90 60Z"
        fill={`url(#body-${gid})`}
        opacity="0.92"
      />
      {/* 머리 술 */}
      <path
        d="M60 24 C56 12 52 12 56 26"
        stroke="#6D5BE0"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 24 C64 12 68 12 64 26"
        stroke="#6D5BE0"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* 몸통 */}
      <circle cx="60" cy="64" r="38" fill={`url(#body-${gid})`} />
      {/* 발 */}
      <ellipse cx="46" cy="100" rx="9" ry="5.5" fill={`url(#body-${gid})`} />
      <ellipse cx="74" cy="100" rx="9" ry="5.5" fill={`url(#body-${gid})`} />
      {/* 배 하이라이트 */}
      <ellipse cx="60" cy="72" rx="23" ry="19" fill="#fff" opacity="0.16" />
      <Cheeks gid={gid} cx={60} cy={68} gap={24} />
      <Eyes mood={mood} cx={60} cy={60} gap={14} />
      <Mouth mood={mood} cx={60} cy={73} />
      {/* 별 장식 */}
      {mood === 'happy' ? (
        <g className="pm-creature__spark">
          <path d="M96 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFD66B" />
          <path
            d="M22 44 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"
            fill="#FFD66B"
          />
        </g>
      ) : null}
    </g>
  )
}
