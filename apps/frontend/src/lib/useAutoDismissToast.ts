import { useEffect, useRef } from 'react'

/**
 * 토스트 메시지를 일정 시간 후 자동으로 닫는다.
 * 모바일에서 수동 닫기(×)만 있으면 알림이 화면에 계속 남아 인지부하를 키우므로,
 * 접근성을 위해 충분한 노출 시간(기본 3.2s) 후 자동 소멸시킨다.
 * `clear`는 ref로 보관해 인라인 콜백을 넘겨도 타이머가 매 렌더마다 리셋되지 않는다.
 */
export function useAutoDismissToast(
  toast: string | null,
  clear: () => void,
  durationMs = 3200,
): void {
  const clearRef = useRef(clear)
  useEffect(() => {
    clearRef.current = clear
  }, [clear])
  useEffect(() => {
    if (toast == null) return
    const timer = window.setTimeout(() => clearRef.current(), durationMs)
    return () => window.clearTimeout(timer)
  }, [toast, durationMs])
}
