# Material Design 3 · Apple Liquid Glass 디자인 조사

> 작성 목적: 잇츠미 패널리스트 모바일 앱(`apps/frontend/src/features/PanelistMobile.tsx`)을
> "화이트=화사한 글래스모피즘 / 다크=세련된 애플 다크"로 대개편하기 위한 근거 정리.
> 본 문서는 외부 디자인 시스템의 **원칙**을 정리하고, 잇츠미에 어떤 부분을 취사선택할지 판단한다.

---

## 1. 두 디자인 언어의 핵심 차이

| 축        | Google **Material Design 3 (Expressive)**                           | Apple **Liquid Glass / iOS HIG**                  |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 표면 은유 | 종이(paper)·잉크. 면이 z축으로 쌓이며 그림자로 고도(elevation) 표현 | 유리(glass). 뒤 콘텐츠가 비치고, 빛이 굴절·반사   |
| 깊이 표현 | **Elevation = 그림자 + tonal surface(색조 상승)**                   | **Blur + 반투명 + 미세한 테두리 하이라이트**      |
| 색        | Dynamic Color(시드 컬러 → tonal palette 자동 생성)                  | 시스템 그레이 위계 + vibrancy(배경 채도 끌어올림) |
| 모서리    | 12~28dp, 컴포넌트별 shape scale                                     | 연속 곡률(continuous corner, "squircle"), 큰 반경 |
| 모션      | Emphasized easing, spatial(공간 이동) 강조                          | Fluid spring, 제스처 추종·관성                    |
| 정보 위계 | 색·굵기·면적 대비                                                   | 투명도·블러 강도·계층(layer)                      |

**결론:** 잇츠미는 "유리 질감"을 메인 무드로 가져가되(Apple),
가독성·접근성 검증과 토큰화된 elevation 사고방식(Material)을 결합한다.

---

## 2. Apple — Glassmorphism / Liquid Glass 원칙

애플이 공식적으로 권장하는 머티리얼(`.regularMaterial`, `.thinMaterial` 등)과
2025년 Liquid Glass 언어에서 일관되게 나타나는 규칙:

1. **반투명 + 배경 블러(backdrop-filter)가 한 세트다.**
   - 유리는 "반투명한 색"만으로 완성되지 않는다. 반드시 뒤를 흐리게 해야(blur)
     떠 있는 판처럼 보인다. CSS로는 `background: rgba(...)` + `backdrop-filter: blur() saturate()`.
   - 채도 상승(`saturate(140~180%)`)이 핵심: 뒤 색을 살짝 끌어올려 "생기 있는 유리"가 된다.

2. **테두리 하이라이트(rim light)로 가장자리를 빛낸다.**
   - 1px의 밝은 inset border(`box-shadow: inset 0 1px 0 rgba(255,255,255,.5)`)가
     유리 윗면에 빛이 닿은 느낌을 만든다. 다크 모드에서 특히 중요.

3. **그림자는 멀리·부드럽게.** 짧고 진한 그림자는 종이 느낌(머티리얼).
   유리는 `0 8px 30px rgba(0,0,0,.12)`처럼 크고 흐린 그림자로 "공중에 뜬" 느낌.

4. **계층(Layer) 규칙**: 유리 위에 유리를 겹치지 않는다.
   배경(콘텐츠) → 유리 표면(1겹) → 불투명 콘트롤. 유리를 2~3겹 겹치면 탁해진다.

5. **vibrancy(생동 텍스트)**: 유리 위 텍스트/아이콘은 배경과 블렌딩되어
   살짝 비치되 가독성은 유지. 잇츠미에선 텍스트는 불투명 유지(접근성 우선),
   구분선·아이콘 배경에만 vibrancy 톤 적용.

6. **다크 모드의 유리**는 흰 반투명이 아니라 **어두운 반투명 + 밝은 rim**:
   `background: rgba(28,30,38,.6)` + `border: 1px solid rgba(255,255,255,.08)`.

### 라이트 vs 다크 유리 레시피 (본 프로젝트 채택값)

```
/* LIGHT — 화사한 글래스 */
--pm-glass-bg:      rgba(255, 255, 255, 0.62);
--pm-glass-blur:    saturate(180%) blur(20px);
--pm-glass-border:  rgba(255, 255, 255, 0.7);   /* 밝은 rim */
--pm-glass-shadow:  0 8px 30px rgba(31, 28, 56, 0.10);
--pm-glass-hi:      inset 0 1px 0 rgba(255, 255, 255, 0.65);

/* DARK — 세련된 애플 다크 */
--pm-glass-bg:      rgba(28, 31, 38, 0.58);
--pm-glass-blur:    saturate(150%) blur(22px);
--pm-glass-border:  rgba(255, 255, 255, 0.10);  /* 미세 rim */
--pm-glass-shadow:  0 10px 36px rgba(0, 0, 0, 0.45);
--pm-glass-hi:      inset 0 1px 0 rgba(255, 255, 255, 0.08);
```

---

## 3. Material Design 3 — 가져올 것

유리 무드를 쓰되, 머티리얼에서 **검증된 시스템적 사고**는 그대로 채택한다.

1. **토큰 위계(Reference → System → Component)**: 색을 컴포넌트에 직접 박지 않고
   의미 토큰(`--pm-glass-bg`, `--color-primary`)을 거친다. 이미 잇츠미 토큰 구조가 이 방향.

2. **State layer(상태 레이어)**: hover/press/selected를 별도 반투명 오버레이로 표현.
   유리 카드 위 선택 상태 = `primary`를 8~14% 섞은 틴트. (현 `--color-primary-soft` 재사용)

3. **Elevation 단계화**: 유리도 단계가 필요하다.
   - Level 0: 배경(canvas)
   - Level 1: 떠 있는 카드(설문 보기 카드, 알림 토스트)
   - Level 2: 시트·모달(bottom sheet)
     각 단계는 blur 강도와 그림자 크기로 구분.

4. **접근성 대비 기준(WCAG)**: 유리 위 본문 텍스트는 대비 4.5:1 이상 유지.
   → 텍스트는 반투명에 두지 않고 불투명 잉크색 사용, 유리는 "면·테두리"에만.

5. **터치 타깃 최소 48×48dp**: 설문 보기·리커트 버튼 최소 높이 보증.

---

## 4. 잇츠미 적용 판단 (요약)

| 요소                                | 채택 | 비고                                  |
| ----------------------------------- | ---- | ------------------------------------- |
| backdrop-filter 유리 표면           | ✅   | 카드/시트/탑바/바텀내비/설문 보기     |
| 밝은 rim border + 큰 흐린 그림자    | ✅   | 라이트/다크 각각 토큰화               |
| 유리 2겹 겹침                       | ❌   | 탁해짐. 한 겹 원칙                    |
| 텍스트 vibrancy(반투명 본문)        | ❌   | 접근성 우선, 본문은 불투명            |
| Dynamic Color 자동 팔레트           | ❌   | 잇츠미 브랜드 컬러 고정(보라 #5645d4) |
| 토큰 위계 / state layer             | ✅   | 기존 토큰 시스템 확장                 |
| 연속 곡률 큰 모서리                 | ✅   | 18~26px 라운드                        |
| `prefers-reduced-transparency` 폴백 | ✅   | 블러 미지원·민감 사용자에 불투명 폴백 |

다음 문서: [`글래스모피즘_토큰_및_모바일적용_설계.md`](./글래스모피즘_토큰_및_모바일적용_설계.md)
