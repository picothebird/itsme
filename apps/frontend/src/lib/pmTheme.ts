export type PmTheme = 'light' | 'dark'

const STORAGE_KEY = 'pm-theme'

/** 저장된 패널리스트 앱 테마를 읽는다. 기본값은 라이트. */
export const readPmTheme = (): PmTheme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** 테마를 <html> data 속성에 반영한다. */
export const applyPmTheme = (theme: PmTheme): void => {
  if (typeof document === 'undefined') return
  if (theme === 'dark') document.documentElement.dataset.pmTheme = 'dark'
  else delete document.documentElement.dataset.pmTheme
}

/** 테마를 저장하고 즉시 반영한다. */
export const setPmTheme = (theme: PmTheme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 저장 실패는 무시 (적용만 수행)
  }
  applyPmTheme(theme)
}
