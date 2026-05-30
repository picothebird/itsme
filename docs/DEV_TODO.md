# 잇츠미(It's Me) MVP — 개발 TODO (AI 에이전트용 작업 명세)

본 문서는 [상세 기획서](../%5B%EC%83%81%EC%84%B8%20%EA%B8%B0%ED%9A%8D%EC%84%9C%5D%20%EC%B0%A8%EC%84%B8%EB%8C%80%20%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20%EC%9E%87%EC%B8%A0%EB%AF%B8.txt), [MVP 기능명세서](../%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20MVP_%EA%B8%B0%EB%8A%A5%EB%AA%85%EC%84%B8%EC%84%9C_2026-05-30.md), [유저플로우](../%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20MVP_%EC%9C%A0%EC%A0%80%ED%94%8C%EB%A1%9C%EC%9A%B0_2026-05-30.md.md) 기반.

## 사용 규칙 (AI 에이전트용)

- 한 번에 하나의 `[ ]` 항목만 in-progress로 표시하고, 완료 직후 `[x]`로 갱신.
- 항목 내부의 **출력물**은 모두 만들어야 완료 처리.
- **수용 기준**은 PR/커밋 메시지 본문에 그대로 인용해 자가 검증.
- 모든 작업 단위는 `lint`, `typecheck`, `test`, `build`가 깨지지 않아야 한다.
- 백엔드 코드는 `apps/backend/src`, 프론트(연구자 웹) 코드는 `apps/frontend/src`, 모바일(패널 앱)은 새 워크스페이스 `apps/mobile`(추후 추가).
- 디자인 시스템은 [DESIGN.md](../DESIGN.md)(Apple 톤, 연구자 웹) / [notion/DESIGN.md](../notion/DESIGN.md)(Notion 톤, 백오피스 일부) 기준.

---

## Phase 0. 공통 인프라 / 모노레포

### 0.1 워크스페이스 확장

- [ ] **0.1.1** `apps/mobile` 워크스페이스 추가 (Expo + React Native + TypeScript)
  - 출력물: `apps/mobile/package.json`, `app.json`, `babel.config.js`, `tsconfig.json`, `App.tsx`
  - 루트 `package.json` workspaces 배열에 `apps/mobile` 추가
  - 수용 기준: `npm run dev:mobile` 으로 Metro 번들러 실행 가능
- [ ] **0.1.2** `packages/shared` 공통 패키지 추가 (도메인 타입/검증 스키마/공용 유틸)
  - 출력물: `packages/shared/src/index.ts`, zod 스키마 export
  - 수용 기준: 백엔드/프론트/모바일에서 동일 타입 import 가능
- [ ] **0.1.3** `packages/ui` 공통 UI 토큰 패키지 (색상/타이포/스페이싱 토큰) — [DESIGN.md](../DESIGN.md) 추출
  - 출력물: `packages/ui/src/tokens.ts`
- [ ] **0.1.4** TS path alias 통일 (`@itsme/shared`, `@itsme/ui`) — tsconfig base 설정
- [ ] **0.1.5** Frontend ↔ Backend ↔ Mobile에서 공유 타입 import 검증용 더미 사용처 추가

### 0.2 DevOps / 품질

- [ ] **0.2.1** `.env.example` 항목 확장 (DB URL, JWT secret, 소셜 OAuth, AI provider key, S3, Redis)
- [ ] **0.2.2** Docker Compose: `postgres`, `redis`, `mailhog`, `localstack(s3)` 정의
  - 출력물: `infra/docker-compose.yml`, `infra/README.md`
- [ ] **0.2.3** GitHub Actions: 매트릭스로 `backend`, `frontend`, `mobile` 분리 실행
- [ ] **0.2.4** PR 템플릿/Issue 템플릿 추가 (`.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/*`)
- [ ] **0.2.5** Sentry, OpenTelemetry, pino 로깅 베이스 통합 (백엔드)
- [ ] **0.2.6** Storybook 추가 (`apps/frontend`) — 컴포넌트 단위 시각 검증

---

## Phase 1. 데이터 모델 / 백엔드 코어

### 1.1 데이터베이스 스키마 (Prisma)

- [ ] **1.1.1** Prisma 설치 및 초기화 (`apps/backend/prisma/schema.prisma`)
- [ ] **1.1.2** 모델 정의: `User`, `Identity(provider, providerId, userId)`, `Panelist(pid, userId)`, `Researcher`, `Workspace`, `WorkspaceMember(role)`
- [ ] **1.1.3** 모델 정의: `Survey`, `SurveyVersion`, `Question(type, order, payload jsonb, jumpLogic jsonb)`, `Choice`
- [ ] **1.1.4** 모델 정의: `SurveyDeployment(targeting jsonb, pointsPerUser, budget, startAt, endAt, status)`
- [ ] **1.1.5** 모델 정의: `Response(panelistId, surveyId, status, startedAt, completedAt)`, `Answer(questionId, value jsonb, latencyMs)`
- [ ] **1.1.6** 모델 정의: `AbuseEvent(panelistId, responseId, type, weight, occurredAt)`, `PanelistPenalty(until, reason)`
- [ ] **1.1.7** 모델 정의: `Pet(panelistId, level, expr, tagVector jsonb, evolutionStage, sick)`, `DataPiece(panelistId, surveyId, categoryTag, consumed)`
- [ ] **1.1.8** 모델 정의: `Wallet(panelistId, balance)`, `PointTransaction(type, amount, refId)`, `Reward(catalog item)`, `RewardOrder`
- [ ] **1.1.9** 모델 정의: `Streak(panelistId, current, longest, lastActiveDate)`
- [ ] **1.1.10** 마이그레이션 생성 및 시드 스크립트 (`prisma/seed.ts`) — 데모 리서처/패널/설문 1건
- [ ] **1.1.11** 백엔드 `db` 클라이언트 wrapper (`src/db/client.ts`) + 트랜잭션 헬퍼

### 1.2 백엔드 아키텍처 기반

- [ ] **1.2.1** 모듈 기반 폴더 구조 도입: `src/modules/{auth,survey,response,pet,wallet,abuse,ai,researcher}`
- [ ] **1.2.2** 공통 에러 클래스 (`AppError`, `ValidationError`, `AuthError`, `RateLimitError`) + Express 에러 미들웨어
- [ ] **1.2.3** 공통 응답 포맷터 (`{ ok, data | error }`) 및 zod 기반 요청 검증 미들웨어
- [ ] **1.2.4** 인증 미들웨어 (`requireUser`, `requirePanelist`, `requireResearcher`, `requireRole`)
- [ ] **1.2.5** rate limiter (Redis 기반) — 응답 제출/소셜 로그인 등 민감 엔드포인트 적용
- [ ] **1.2.6** OpenAPI 자동 생성 (`zod-to-openapi`) → `/docs` 라우트로 Swagger UI 제공
- [ ] **1.2.7** 잡 큐 (BullMQ + Redis) — 푸시 발송, 리워드 정산, 분석 집계

---

## Phase 2. 인증 / 계정 / PID

### 2.1 소셜 로그인 (모바일 + 웹)

- [ ] **2.1.1** 백엔드 OAuth 라우트: `POST /auth/social` (provider, idToken) — 검증 후 User/Identity upsert
- [ ] **2.1.2** Kakao OAuth 검증 구현
- [ ] **2.1.3** Apple Sign In 검증 구현 (JWT + Apple JWKS)
- [ ] **2.1.4** Google OAuth 검증 구현
- [ ] **2.1.5** Access/Refresh 토큰 발급 (`/auth/refresh`, `/auth/logout`)
- [ ] **2.1.6** 모바일 SDK 연동 (`expo-auth-session`, `@react-native-seoul/kakao-login`)
- [ ] **2.1.7** 로그인 실패/취소/네트워크 오류 처리 + 재시도 UX (모바일)
- [ ] **2.1.8** 동일 이메일 중복 가입 시 식별자 병합 정책 정의 + 테스트

### 2.2 PID(가상 식별자) 관리

- [ ] **2.2.1** 가입 시 PID 자동 발급 트리거 (`pid = ulid()` + HMAC salt)
- [ ] **2.2.2** PID/개인정보 분리 저장: `User`(이메일/소셜) vs `Panelist`(PID) — 다른 스키마 또는 다른 DB
- [ ] **2.2.3** 내부 조회 권한: `requireRole('admin')`에서만 PID↔User 매핑 조회 가능
- [ ] **2.2.4** PID 발급/조회 감사 로그(`AuditLog`)
- [ ] **2.2.5** 통합 테스트: 응답/리워드/지갑 모든 이벤트가 PID에만 연결되는지 검증

### 2.3 연구자 계정

- [ ] **2.3.1** 이메일+비밀번호 가입 (`/researcher/auth/signup`) + 이메일 인증 발송
- [ ] **2.3.2** 워크스페이스 생성 및 초대(`/workspace/invite` — Editor/Viewer)
- [ ] **2.3.3** 권한별 라우트 가드 (Editor: 편집/배포, Viewer: 조회만)

---

## Phase 3. B2C 패널 모바일 앱

> 모든 모바일 화면은 [유저플로우](../%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20MVP_%EC%9C%A0%EC%A0%80%ED%94%8C%EB%A1%9C%EC%9A%B0_2026-05-30.md.md) `s1~s4` 노드와 1:1 대응.

### 3.1 앱 셸 / 내비게이션

- [ ] **3.1.1** React Navigation 설치 + Bottom Tab(피드/허브/지갑) + Stack(설문 응답)
- [ ] **3.1.2** 글로벌 상태(Zustand or Jotai) + React Query 설정
- [ ] **3.1.3** API 클라이언트(`apps/mobile/src/api/client.ts`) — 토큰 자동 첨부/리프레시
- [ ] **3.1.4** 디자인 토큰 적용 (`@itsme/ui`) + 라이트/다크 테마
- [ ] **3.1.5** 햅틱 / 사운드 / Lottie 애니메이션 유틸 (`src/lib/feedback.ts`)
- [ ] **3.1.6** 에러 바운더리 + Toast/Snackbar 컴포넌트

### 3.2 Screen 1 — 스플래시 & 소셜 로그인

- [ ] **3.2.1** 스플래시 (로고 + 알 흔들림 Lottie)
- [ ] **3.2.2** 카카오/애플/구글 1탭 로그인 버튼 (이메일/비번 폼 없음)
- [ ] **3.2.3** 백그라운드 PID 발급 호출 + 토큰 저장(`SecureStore`)
- [ ] **3.2.4** 페이드아웃 전환 애니메이션

### 3.3 Screen 2 — 알 부화 온보딩

- [ ] **3.3.1** 거대한 알 그래픽 + 안내 카피
- [ ] **3.3.2** 알 터치 시 모달: 출생연도 Wheel Picker
- [ ] **3.3.3** 성별 탭 (남/여/선택안함)
- [ ] **3.3.4** 관심사 해시태그 다중선택 칩 (`#테크 #뷰티 #금융 #게임 ...`)
- [ ] **3.3.5** 3문항 완료 → 알 깨짐 + 폭죽 이펙트 + 정령 등장 애니메이션
- [ ] **3.3.6** 백엔드 `PATCH /panelist/me/profile` 호출
- [ ] **3.3.7** 최초 보상 500P 지급 + 토스트
- [ ] **3.3.8** 수용 기준: PID 발급 + 정령 생성 + 지갑 500P 충전이 한 트랜잭션으로 처리

### 3.4 Screen 3 — 메인 피드 (Swipe Deck)

- [ ] **3.4.1** GNB: 보유 포인트 + 정령 썸네일/레벨
- [ ] **3.4.2** 카드 스택 컴포넌트 (`react-native-deck-swiper` 또는 자체 구현)
- [ ] **3.4.3** 카드 정보: 제목, 카테고리 아이콘, 예상 소요 시간, 획득 포인트
- [ ] **3.4.4** 우측 스와이프 = 참여, 좌측 스와이프 = 패스, 하단 ❌/♥ 버튼 병행
- [ ] **3.4.5** 카드 플라이아웃 애니메이션 + 햅틱
- [ ] **3.4.6** 추천 API: `GET /panel/feed?cursor=...` (타겟 적합도/마감 임박 정렬)
- [ ] **3.4.7** Empty State (정령 수면 일러스트 + 카피)
- [ ] **3.4.8** Pull-to-refresh + 무한 스크롤(prefetch)
- [ ] **3.4.9** 분석 이벤트 송신: `feed_view`, `card_swipe_left`, `card_swipe_right`

### 3.5 Screen 4 — 설문 응답 + 어뷰징 엔진

- [ ] **3.5.1** 프로그레스 바 (n/total) + 닫기(X) → 이탈 확인 다이얼로그
- [ ] **3.5.2** 1화면 1문항 카드 뷰 (큰 텍스트 + 큰 세로 선택지)
- [ ] **3.5.3** 선택 즉시 자동 다음 카드 슬라이드 (다음 버튼 없음)
- [ ] **3.5.4** 응답 시 `POST /response/answer` (questionId, value, latencyMs, clientTimestamp)
- [ ] **3.5.5** 스피딩 감지: `minDwellMs = textLen / readingSpeed` 위반 시 Strike+1
- [ ] **3.5.6** 스트레이트라이닝 감지: 연속 4회 동일 인덱스 → Strike+1
- [ ] **3.5.7** Strike 1~2: Soft Red Glow 테두리 + 햅틱 + 토스트
- [ ] **3.5.8** Strike 3: 모달 "10분간 응답 제한" + 강제 홈 이동 + `PanelistPenalty` 기록
- [ ] **3.5.9** 오프라인 캐싱: `AsyncStorage`에 응답 저장, 재연결 시 자동 sync
- [ ] **3.5.10** 재진입 시 "이어서 하시겠습니까?" 다이얼로그
- [ ] **3.5.11** 설문 완료 화면 → 데이터 조각 생성 트리거 → 허브로 이동 CTA
- [ ] **3.5.12** 백엔드 수용 기준: 클라 latency를 서버에서도 재검증해야 함 (서버 timestamp 비교)

### 3.6 Screen 5 — 마이 데이터 허브 (Nexi Room)

- [ ] **3.6.1** 카테고리 비중에 따라 동적 배경 테마 (IT/뷰티/금융/게임)
- [ ] **3.6.2** 정령 캐릭터 컴포넌트 (Lottie or Skia) — 레벨/진화 단계별 에셋
- [ ] **3.6.3** EXP 바 + 다음 진화까지 % 표시
- [ ] **3.6.4** 데이터 조각 보관함(하단 그리드)
- [ ] **3.6.5** 드래그 앤 드롭 급식 (`react-native-reanimated` + `gesture-handler`)
- [ ] **3.6.6** 급식 인터랙션: 스냅 → 냠냠 사운드 → EXP 증가 → 하트 이펙트
- [ ] **3.6.7** 진화 연출(레벨 10 도달 시) — 풀스크린 컷씬 + 새 외형 저장
- [ ] **3.6.8** 스트릭 효과: 3일 이상 아우라, 결석 시 거미줄
- [ ] **3.6.9** 정령 질병 상태(Strike 누적) 표시 + 회복 가이드 안내
- [ ] **3.6.10** 정령 터치 시 카테고리별 대사 말풍선
- [ ] **3.6.11** 페르소나 카드 SNS 공유 (캡처 + 딥링크)

### 3.7 Screen 6 — 지갑 / 정산

- [ ] **3.7.1** 총 보유 포인트 (롤링 카운터 애니메이션)
- [ ] **3.7.2** 탭: [포인트 내역] / [스토어]
- [ ] **3.7.3** 포인트 내역 무한 스크롤 (`GET /wallet/transactions`)
- [ ] **3.7.4** 스토어 카탈로그 (네이버페이/스타벅스 등) (`GET /rewards/catalog`)
- [ ] **3.7.5** 교환 플로우: 잔액 검증 → 차감 → 쿠폰 발급 → 쿠폰함 이동
- [ ] **3.7.6** 멱등성 보장 — 클라 generated `idempotencyKey` 전송
- [ ] **3.7.7** 쿠폰함 화면 (바코드/QR 표시)

### 3.8 모바일 공통 — 푸시 / 분석

- [ ] **3.8.1** Expo Push Notifications 통합 + 디바이스 토큰 서버 등록
- [ ] **3.8.2** 정령 톤 푸시 템플릿 (신규/마감/스트릭) — 백엔드 cron + BullMQ
- [ ] **3.8.3** Amplitude 또는 PostHog 이벤트 트래킹
- [ ] **3.8.4** Crashlytics / Sentry RN

---

## Phase 4. B2B 연구자 웹 백오피스

> 화면 단위는 [상세 기획서](../%5B%EC%83%81%EC%84%B8%20%EA%B8%B0%ED%9A%8D%EC%84%9C%5D%20%EC%B0%A8%EC%84%B8%EB%8C%80%20%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20%EC%9E%87%EC%B8%A0%EB%AF%B8.txt) §3 / 유저플로우 `s5` 와 1:1 대응.

### 4.1 웹 셸

- [ ] **4.1.1** React Router 도입 + 보호 라우트(연구자 인증)
- [ ] **4.1.2** TanStack Query + axios 클라이언트 + 401 시 자동 리프레시
- [ ] **4.1.3** 디자인 시스템 적용: Notion 톤 LNB + Apple 톤 콘텐츠 카드 (DESIGN.md 토큰)
- [ ] **4.1.4** LNB: 대시보드 / 내 설문 / 팀 워크스페이스 / 포인트 정산 / 세팅
- [ ] **4.1.5** 글로벌 토스트 + 모달 시스템

### 4.2 Screen B1 — 통합 리서치 대시보드

- [ ] **4.2.1** 상단 KPI 위젯: 이번 달 응답 수 / 활성 패널 수 / 잔여 예산
  - API: `GET /researcher/dashboard/summary`
- [ ] **4.2.2** 칸반 보드 (Draft / Live / Done) — `dnd-kit`
- [ ] **4.2.3** 설문 카드: Avatar(초대자), 진행률, 퀵 액션(일시정지/복제)
- [ ] **4.2.4** `+ 새 설문 만들기` 버튼 → 빌더 이동

### 4.3 Screen B2 — 듀얼 플로우 빌더 (3단 레이아웃)

- [ ] **4.3.1** 레이아웃: 좌 15% (Palette) | 중앙 60% (Canvas) | 우 25% (Preview/AI)
- [ ] **4.3.2** 좌측 Palette: 단일/다중/리커트/주관식 4종 (드래그 시작점)
- [ ] **4.3.3** 중앙 Canvas: 문항 블록 컴포넌트
  - 블록 좌측 핸들(`⋮⋮`) 드래그 정렬 — `dnd-kit`
  - 인라인 편집: 텍스트, 선택지 추가/삭제, 필수 여부 토글
- [ ] **4.3.4** 조건부 점프 로직 UI ("문항 1에서 보기 A → 문항 3으로 점프")
- [ ] **4.3.5** 우측 Tab 1 — **모바일 프리뷰**
  - iPhone mockup 프레임 + 실제 카드 스와이프 UI 렌더링
  - 중앙 편집 → 0.1초 이내 디바운스 반영
  - 글자 수 초과/버튼 잘림 경고 배지
- [ ] **4.3.6** 우측 Tab 2 — **AI 검수**
  - `POST /ai/survey/review` → 유도성/논리 모순/이중부정 지적
  - 각 지적마다 [적용] 버튼 → 본문 직접 패치
- [ ] **4.3.7** **AI 프롬프트 생성** (Flow B)
  - 프롬프트 입력창 → `POST /ai/survey/generate` → 기본 10문항 초안
  - 생성 결과 캔버스에 일괄 삽입 + Undo 지원
- [ ] **4.3.8** 자동 저장 (debounce 1s) + 충돌 방지 (version 토큰)
- [ ] **4.3.9** 단축키: Cmd+S 수동 저장, Cmd+Z/Shift+Z 실행취소

### 4.4 Screen B3 — 배포 모달

- [ ] **4.4.1** 타겟팅 필터: 연령 Range Slider, 성별 체크, 관심사 칩
- [ ] **4.4.2** 예상 도달 모수 실시간 계산: `POST /deployment/estimate`
- [ ] **4.4.3** 1인당 포인트 + 목표 인원 → 총 예산 자동 계산
- [ ] **4.4.4** 모수 부족(<50명)이면 배포 버튼 비활성화 + 경고 모달
- [ ] **4.4.5** 즉시 배포 / 예약 배포 (`startAt`, `endAt`)
- [ ] **4.4.6** 배포 후 구조 수정 제한: 백엔드에서 `SurveyVersion.locked = true`
  - 텍스트만 수정 허용, 문항 추가/삭제는 "복제 후 재배포" 강제
- [ ] **4.4.7** 배포 성공 → 칸반 Live 컬럼으로 자동 이동

### 4.5 Screen B4 — 실시간 애널리틱스

- [ ] **4.5.1** 상단 라이브 배너 (🟢 깜빡임 + 현재 접속자)
- [ ] **4.5.2** WebSocket(`/ws/analytics/:deploymentId`) — 응답 들어올 때마다 푸시
- [ ] **4.5.3** KPI: 응답 완료 수, 평균 소요 시간, 이탈률 (롤링 카운터)
- [ ] **4.5.4** 문항별 차트: 객관식 도넛 (호버 시 수치/비율), 리커트 누적 막대
- [ ] **4.5.5** 이탈 퍼널: 문항 단계별 % + 큰 이탈 문항 붉은색 하이라이트
- [ ] **4.5.6** 어뷰징 필터된 응답 비율 표시
- [ ] **4.5.7** CSV 내보내기: `GET /deployment/:id/export.csv` (스트리밍)
- [ ] **4.5.8** PDF 리포트 생성: `POST /deployment/:id/report` (서버사이드 puppeteer)

### 4.6 팀 워크스페이스 / 세팅

- [ ] **4.6.1** 멤버 초대 모달 (이메일 + 권한)
- [ ] **4.6.2** 권한 변경/제거
- [ ] **4.6.3** 결제/포인트 정산 화면 (스텁)
- [ ] **4.6.4** API 키 발급 (스텁)

---

## Phase 5. 핵심 메커니즘 (백엔드 도메인)

### 5.1 어뷰징 엔진

- [ ] **5.1.1** `AbuseService.evaluateAnswer(answer)` — 스피딩 판정
- [ ] **5.1.2** `AbuseService.evaluatePattern(response)` — 스트레이트라이닝 판정 (롤링 윈도우)
- [ ] **5.1.3** Strike 누적 → `AbuseEvent` 기록 + WebSocket으로 클라 통보
- [ ] **5.1.4** 3 Strike → `PanelistPenalty(until = now+10m)` + 진행 중 설문 강제 종료
- [ ] **5.1.5** 정령 질병 상태 동기화 (`Pet.sick = true`, 회복은 1일 정상 응답 시)
- [ ] **5.1.6** 어뷰징 차단된 응답은 분석에서 제외 + 대시보드에 차단률 노출
- [ ] **5.1.7** 유닛 테스트: 보더라인 케이스(정확히 minDwellMs, 3회/4회 연속)

### 5.2 정령(Pet) 진화

- [ ] **5.2.1** EXP 적립 함수: `exp = clamp(questionCount * difficultyFactor, 10, 50)`
- [ ] **5.2.2** 태그 벡터 누적: 응답 카테고리 카운트
- [ ] **5.2.3** 레벨업 임계값 테이블 (`config/petLevels.ts`)
- [ ] **5.2.4** 레벨 10 도달 시 `evolutionStage = argmax(tagVector)`
- [ ] **5.2.5** 진화 분기 에셋 매핑 테이블 (모바일과 공유)
- [ ] **5.2.6** 정령 상태 조회 API `GET /pet/me`
- [ ] **5.2.7** 통합 테스트: 응답 → 데이터 조각 → 급식 → EXP → 레벨업 → 진화 시나리오

### 5.3 리워드/지갑

- [ ] **5.3.1** 포인트 적립 트랜잭션 (멱등 키 기반)
- [ ] **5.3.2** 잔액 차감 + 쿠폰 발급 (외부 vendor 어댑터 인터페이스)
- [ ] **5.3.3** 더미 vendor 어댑터 (개발용) — 실제 네이버페이/기프티콘 API는 추후
- [ ] **5.3.4** 환불/롤백 정책 (vendor 실패 시 자동 환급)
- [ ] **5.3.5** 일/월 한도 정책 (어뷰징 패널 추가 차단)

### 5.4 추천 피드

- [ ] **5.4.1** 타겟팅 매칭 쿼리 (`Survey.deployment.targeting` ↔ `Panelist.profile`)
- [ ] **5.4.2** 우선순위 점수: 타겟 적합도 + 마감 임박 + 신규성
- [ ] **5.4.3** 이미 참여/패스한 설문 제외
- [ ] **5.4.4** 페이지네이션(cursor) + 캐싱(Redis 60s)

### 5.5 AI 어시스턴트 (서버)

- [ ] **5.5.1** AI provider 추상화 (`src/modules/ai/provider.ts`) — OpenAI 우선
- [ ] **5.5.2** `POST /ai/survey/generate` — 프롬프트 → 10문항 JSON 스키마 강제(zod)
- [ ] **5.5.3** `POST /ai/survey/review` — 문항 배열 → 유도성/모순/이중부정 지적 리스트
- [ ] **5.5.4** `POST /ai/survey/translate` — 다국어 변환 (ko↔en↔ja)
- [ ] **5.5.5** 토큰 사용량 로깅 + 워크스페이스 단위 쿼터
- [ ] **5.5.6** 프롬프트 인젝션 가드 (입력 정규화)

---

## Phase 6. 운영 / 보안 / 품질

### 6.1 보안

- [ ] **6.1.1** OWASP Top 10 점검 (Injection, BAC, IDOR)
- [ ] **6.1.2** 개인정보 암호화 (필드 레벨, AES-256-GCM)
- [ ] **6.1.3** PII 감사 로그 (열람 기록)
- [ ] **6.1.4** Refresh 토큰 회전 + 디바이스 바인딩
- [ ] **6.1.5** CSRF/CORS 도메인 화이트리스트 운영 분리
- [ ] **6.1.6** 비밀키 관리 (env → Doppler/SSM)

### 6.2 테스트

- [ ] **6.2.1** 단위 테스트 커버리지 70% 이상 (vitest)
- [ ] **6.2.2** API 통합 테스트 (supertest + 테스트 DB)
- [ ] **6.2.3** E2E 테스트 (Playwright — 연구자 웹)
- [ ] **6.2.4** Detox 또는 Maestro — 모바일 핵심 플로우
- [ ] **6.2.5** 부하 테스트 (k6) — 응답 제출 1000 RPS

### 6.3 관측성

- [ ] **6.3.1** 구조화 로깅 (요청 ID 전파)
- [ ] **6.3.2** APM 대시보드 (응답 시간 p50/p95/p99)
- [ ] **6.3.3** 알람 규칙 (5xx 비율, 어뷰징 폭증, 결제 실패)

### 6.4 배포

- [ ] **6.4.1** 백엔드 컨테이너화 (Dockerfile) + 헬스체크
- [ ] **6.4.2** 프론트 정적 배포 (Vercel or Cloudflare Pages)
- [ ] **6.4.3** 모바일 EAS Build 파이프라인 (Preview/Production)
- [ ] **6.4.4** 무중단 마이그레이션 (`prisma migrate deploy`) 절차 문서화
- [ ] **6.4.5** 롤백 플랜 (이전 이미지/마이그레이션 다운)

### 6.5 문서

- [ ] **6.5.1** API 레퍼런스 (`/docs` Swagger 자동 + README 링크)
- [ ] **6.5.2** 아키텍처 다이어그램 (Mermaid) — `docs/ARCHITECTURE.md`
- [ ] **6.5.3** 데이터 모델 ERD — `docs/ERD.md`
- [ ] **6.5.4** 운영 런북 — `docs/RUNBOOK.md`

---

## Phase 7. 엣지 케이스 / 회귀 방지 체크

- [ ] **7.1** 설문 도중 네트워크 끊김 → 로컬 캐시 후 재접속 이어하기 (`E2E` 시나리오)
- [ ] **7.2** 배포 후 문항 구조 수정 시도 → 422 + 안내 (`API 테스트`)
- [ ] **7.3** 타겟 모수 50명 미만 → 배포 버튼 비활성화 (`UI 테스트`)
- [ ] **7.4** 어뷰징 오탐 항의 케이스 → 어드민에서 Strike 수동 차감
- [ ] **7.5** 리워드 vendor 일시 장애 → 큐에 적재 후 재시도 + 사용자 안내
- [ ] **7.6** 정령 진화 분기 동률 시 → 결정적 tie-breaker(가나다순)
- [ ] **7.7** 동시 응답 다중 디바이스 → 마지막 디바이스만 유효, 나머지 강제 종료
- [ ] **7.8** 데이터 조각 미급식 누적 → 24h 후 자동 소비 처리 + 알림
- [ ] **7.9** AI 생성 결과가 zod 스키마 검증 실패 → 재시도 1회 후 사용자에게 수정 요청
- [ ] **7.10** 회원 탈퇴 시 PID/응답 데이터 익명화(이메일/소셜 ID만 삭제) 처리

---

## 우선순위 가이드 (MVP 컷)

**P0 (출시 필수):** 0.1, 0.2.1–0.2.3, 1.1, 1.2.1–1.2.5, 2.1, 2.2, 2.3.1, 3.1–3.7, 4.1–4.5, 5.1, 5.2, 5.3.1–5.3.2, 5.4, 5.5.2, 6.1.1–6.1.4, 6.2.1–6.2.3, 7.1–7.3

**P1 (출시 1개월 내):** 0.2.4–0.2.6, 2.3.2–2.3.3, 3.8, 4.6, 5.5.3, 5.5.5–5.5.6, 6.3, 6.4, 7.4–7.7

**P2 (이후):** 5.5.4(다국어), 6.5, 7.8–7.10
