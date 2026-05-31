/**
 * PetCreature — 잇츠미 정령 캐릭터 에셋.
 *
 * 외부 래스터 에셋(라이선스/품질/다크모드 일관성 리스크) 대신, 레벨별 진화 단계와
 * 기분 상태를 표현하는 자체 제작 인라인 SVG 캐릭터. "포켓몬 스타터"풍으로 큰 눈·
 * 입체 음영·단계별 뚜렷한 실루엣을 갖도록 설계했고, 보라 테마와 일관되며 다크 모드에서도
 * 선명하게 보인다. 아이들 모션은 CSS(`pm-creature`)에서 제어하며 prefers-reduced-motion을
 * 존중한다.
 */

export type PetCreatureStage = 'egg' | 'baby' | 'adult'
export type PetCreatureMood = 'happy' | 'sick'

type Props = {
  stage: PetCreatureStage
  mood?: PetCreatureMood
  size?: number
  /** 아이들 애니메이션(둥실/깜빡임/날갯짓) 적용 여부 */
  animated?: boolean
  className?: string
}

/** 기분별 몸통 색 (밝은 면 / 중간 / 그림자 면). */
const BODY_HAPPY = { light: '#A99BFF', mid: '#7C6BEC', dark: '#5A49C8' }
const BODY_SICK = { light: '#BCB9CE', mid: '#9893AE', dark: '#797592' }

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
        {/* 몸통: 위 밝고 아래 어두운 입체 그라데이션 */}
        <linearGradient id={`body-${gid}`} x1="0.3" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={body.light} />
          <stop offset="0.55" stopColor={body.mid} />
          <stop offset="1" stopColor={body.dark} />
        </linearGradient>
        {/* 배 무늬 */}
        <linearGradient id={`belly-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#F1ECFF" stopOpacity="0.85" />
        </linearGradient>
        {/* 귀·날개 안쪽 */}
        <linearGradient id={`inner-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC0D2" />
          <stop offset="1" stopColor="#FF9FB6" />
        </linearGradient>
        {/* 볼터치 */}
        <radialGradient id={`cheek-${gid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF8FAB" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FF8FAB" stopOpacity="0" />
        </radialGradient>
        {/* 알 */}
        <linearGradient id={`egg-${gid}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#FFFBF0" />
          <stop offset="0.6" stopColor="#FFEFD2" />
          <stop offset="1" stopColor="#FCDFAE" />
        </linearGradient>
        {/* 이마 보석 */}
        <linearGradient id={`gem-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9CF7DE" />
          <stop offset="1" stopColor="#3FCBA6" />
        </linearGradient>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse
        className="pm-creature__shadow"
        cx="60"
        cy="110"
        rx="30"
        ry="6"
        fill="#1A1530"
        opacity="0.1"
      />

      <g className="pm-creature__body">
        {stage === 'egg' ? (
          <EggStage gid={gid} />
        ) : stage === 'baby' ? (
          <BabyStage gid={gid} mood={mood} />
        ) : (
          <AdultStage gid={gid} mood={mood} />
        )}
      </g>

      {mood === 'sick' ? (
        <g className="pm-creature__sweat">
          <path
            d="M90 38c0 3.4-2.5 6.2-5.6 6.2s-5.6-2.8-5.6-6.2 5.6-9.4 5.6-9.4 5.6 6 5.6 9.4z"
            fill="#7FD4FF"
          />
          <ellipse cx="82" cy="36" rx="1.6" ry="2.4" fill="#fff" opacity="0.7" />
        </g>
      ) : null}
    </svg>
  )
}

/** 포켓몬식 큰 눈 (흰자 + 동공 + 하이라이트 2개). */
function BigEyes({
  mood,
  cx = 60,
  cy = 60,
  gap = 14,
  rx = 6.4,
  ry = 8.2,
}: {
  mood: PetCreatureMood
  cx?: number
  cy?: number
  gap?: number
  rx?: number
  ry?: number
}) {
  if (mood === 'sick') {
    // 반쯤 감긴 풀 죽은 눈 ( > < )
    return (
      <g stroke="#4B4660" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={`M${cx - gap - 5} ${cy - 3} L${cx - gap + 4} ${cy} L${cx - gap - 5} ${cy + 3}`} />
        <path d={`M${cx + gap + 5} ${cy - 3} L${cx + gap - 4} ${cy} L${cx + gap + 5} ${cy + 3}`} />
      </g>
    )
  }
  return (
    <>
      {[-1, 1].map((s) => {
        const ex = cx + s * gap
        return (
          <g className="pm-creature__eye" key={s}>
            {/* 흰자 */}
            <ellipse cx={ex} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" />
            {/* 동공 */}
            <ellipse cx={ex} cy={cy + 0.8} rx={rx - 1.4} ry={ry - 1.4} fill="#2A2540" />
            {/* 큰 하이라이트 */}
            <circle cx={ex - 1.8} cy={cy - 2.6} r="2.1" fill="#FFFFFF" />
            {/* 작은 하이라이트 */}
            <circle cx={ex + 2} cy={cy + 3} r="1.1" fill="#FFFFFF" opacity="0.85" />
          </g>
        )
      })}
    </>
  )
}

function Mouth({
  mood,
  cx = 60,
  cy = 74,
  open = false,
}: {
  mood: PetCreatureMood
  cx?: number
  cy?: number
  open?: boolean
}) {
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
  if (open) {
    // 살짝 벌린 입 + 혀
    return (
      <g>
        <path
          d={`M${cx - 7} ${cy - 1} q7 9 14 0 q-7 4 -14 0z`}
          fill="#3A2540"
          stroke="#2A2540"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d={`M${cx - 3.5} ${cy + 3} q3.5 3 7 0z`} fill="#FF8FAB" />
      </g>
    )
  }
  return (
    <path
      d={`M${cx - 6.5} ${cy} q6.5 6.5 13 0`}
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
  cy = 70,
  gap = 24,
  r = 6.5,
}: {
  gid: string
  cx?: number
  cy?: number
  gap?: number
  r?: number
}) {
  return (
    <g>
      <ellipse cx={cx - gap} cy={cy} rx={r} ry={r * 0.78} fill={`url(#cheek-${gid})`} />
      <ellipse cx={cx + gap} cy={cy} rx={r} ry={r * 0.78} fill={`url(#cheek-${gid})`} />
    </g>
  )
}

function EggStage({ gid }: { gid: string }) {
  return (
    <g>
      <ellipse
        cx="60"
        cy="62"
        rx="35"
        ry="41"
        fill={`url(#egg-${gid})`}
        stroke="#F0CE93"
        strokeWidth="1.5"
      />
      {/* 얼룩 점무늬 */}
      <circle cx="44" cy="46" r="4.5" fill="#C9A6FF" opacity="0.9" />
      <circle cx="76" cy="54" r="5.5" fill="#9FE6C4" opacity="0.9" />
      <circle cx="50" cy="80" r="4" fill="#FFC59B" opacity="0.9" />
      <circle cx="72" cy="82" r="3" fill="#FFB3C8" opacity="0.85" />
      {/* 지그재그 균열 */}
      <path
        d="M38 64 L47 60 L43 69 L53 64 L49 73 L58 68"
        stroke="#D9A867"
        strokeWidth="2.2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 빼꼼 눈 (균열 사이) */}
      <g className="pm-creature__eye">
        <circle cx="60" cy="56" r="3" fill="#2A2540" />
        <circle cx="59" cy="55" r="1" fill="#fff" />
      </g>
      {/* 광택 */}
      <ellipse
        cx="49"
        cy="42"
        rx="8"
        ry="12"
        fill="#fff"
        opacity="0.5"
        transform="rotate(-20 49 42)"
      />
      <circle cx="68" cy="40" r="2.4" fill="#fff" opacity="0.6" />
    </g>
  )
}

function BabyStage({ gid, mood }: { gid: string; mood: PetCreatureMood }) {
  return (
    <g>
      {/* 꼬리 */}
      <path
        className="pm-creature__tail"
        d="M86 82 q20 0 18 -20 q-1 13 -18 13z"
        fill={`url(#body-${gid})`}
      />
      <circle cx="103" cy="61" r="4.5" fill={`url(#inner-${gid})`} />

      {/* 귀 (둥근 고양이 귀) */}
      <path d="M42 40 C36 18 26 22 34 44 Z" fill={`url(#body-${gid})`} />
      <path d="M78 40 C84 18 94 22 86 44 Z" fill={`url(#body-${gid})`} />
      <path d="M40 38 C36 24 31 27 36 41 Z" fill={`url(#inner-${gid})`} opacity="0.85" />
      <path d="M80 38 C84 24 89 27 84 41 Z" fill={`url(#inner-${gid})`} opacity="0.85" />

      {/* 몸통 */}
      <ellipse cx="60" cy="68" rx="36" ry="34" fill={`url(#body-${gid})`} />
      {/* 아랫면 음영 */}
      <path d="M27 74 Q60 112 93 74 Q60 96 27 74Z" fill="#3A2C8A" opacity="0.16" />
      {/* 배 무늬 */}
      <ellipse cx="60" cy="78" rx="21" ry="19" fill={`url(#belly-${gid})`} />
      {/* 발 */}
      <ellipse cx="46" cy="99" rx="9" ry="6" fill={`url(#body-${gid})`} />
      <ellipse cx="74" cy="99" rx="9" ry="6" fill={`url(#body-${gid})`} />
      {/* 림 라이트 */}
      <path
        d="M30 56 Q40 38 60 35"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />

      <Cheeks gid={gid} cx={60} cy={72} gap={23} r={6.5} />
      <BigEyes mood={mood} cx={60} cy={64} gap={13} rx={6.4} ry={8.2} />
      <Mouth mood={mood} cx={60} cy={77} />
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
          cy="16"
          rx="22"
          ry="6"
          fill="none"
          stroke="#FFD66B"
          strokeWidth="3"
          opacity="0.9"
        />
      ) : null}

      {/* 날개 */}
      <g className="pm-creature__wing pm-creature__wing--l">
        <path
          d="M32 58 C6 44 2 76 30 76 C20 70 20 66 32 58Z"
          fill={`url(#body-${gid})`}
          opacity="0.95"
        />
        <path
          d="M30 60 C14 52 12 70 28 72"
          stroke="#fff"
          strokeWidth="1.6"
          fill="none"
          opacity="0.3"
        />
      </g>
      <g className="pm-creature__wing pm-creature__wing--r">
        <path
          d="M88 58 C114 44 118 76 90 76 C100 70 100 66 88 58Z"
          fill={`url(#body-${gid})`}
          opacity="0.95"
        />
        <path
          d="M90 60 C106 52 108 70 92 72"
          stroke="#fff"
          strokeWidth="1.6"
          fill="none"
          opacity="0.3"
        />
      </g>

      {/* 머리 크레스트 */}
      <path
        d="M60 22 C54 8 49 9 54 26"
        stroke={`url(#body-${gid})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 22 C66 8 71 9 66 26"
        stroke={`url(#body-${gid})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 24 C57 14 55 15 58 27"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* 몸통 */}
      <ellipse cx="60" cy="66" rx="38" ry="36" fill={`url(#body-${gid})`} />
      {/* 아랫면 음영 */}
      <path d="M25 72 Q60 112 95 72 Q60 96 25 72Z" fill="#3A2C8A" opacity="0.16" />
      {/* 배 무늬 */}
      <ellipse cx="60" cy="76" rx="22" ry="20" fill={`url(#belly-${gid})`} />
      {/* 발 */}
      <ellipse cx="45" cy="99" rx="10" ry="6.5" fill={`url(#body-${gid})`} />
      <ellipse cx="75" cy="99" rx="10" ry="6.5" fill={`url(#body-${gid})`} />
      {/* 림 라이트 */}
      <path
        d="M27 54 Q38 36 60 33"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />

      {/* 이마 보석 */}
      <g className="pm-creature__gem">
        <path
          d="M60 40 l6 6 -6 7 -6 -7z"
          fill={`url(#gem-${gid})`}
          stroke="#2EAE8C"
          strokeWidth="1"
        />
        <path d="M60 41 l3.4 4 -3.4 1.5z" fill="#fff" opacity="0.6" />
      </g>

      <Cheeks gid={gid} cx={60} cy={70} gap={26} r={6.8} />
      <BigEyes mood={mood} cx={60} cy={62} gap={15} rx={6.8} ry={8.8} />
      <Mouth mood={mood} cx={60} cy={76} open={mood === 'happy'} />

      {/* 별 장식 */}
      {mood === 'happy' ? (
        <g className="pm-creature__spark">
          <path d="M98 38 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFD66B" />
          <path
            d="M20 44 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"
            fill="#FFD66B"
          />
        </g>
      ) : null}
    </g>
  )
}
