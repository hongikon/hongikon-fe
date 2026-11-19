import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { getAskStatus, type AskStatus } from '../../apis/ask'

/** 처음 쓸 때 받는 동의(국외 이전·대화 기록). 문구가 바뀌면 판을 올려 다시 묻는다. */
const CONSENT_KEY = 'ask.consent.v1'

/** 물어보기 첫 사용 동의. null 이면 아직 읽는 중. accept 는 저장까지 한다(저장 실패는 무시 — 다음에 다시 묻는다). */
export function useAskConsent() {
  const [consented, setConsented] = useState<boolean | null>(null)
  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then((value) => setConsented(value === 'yes'))
      .catch(() => setConsented(false))
  }, [])
  const accept = () => {
    setConsented(true)
    AsyncStorage.setItem(CONSENT_KEY, 'yes').catch(() => {})
  }
  return { consented, accept }
}

/**
 * 물어보기 서버 스위치·오늘 한도(ask.public.enabled · soldOut). 탭에 들어올 때마다, 그리고 한 번 물은 뒤(refresh) 다시 받는다.
 * 앞 요청은 끊는다. 실패하면 앞 값을 그대로 둔다.
 */
export function useAskStatus(loggedIn: boolean, accessToken: string | null) {
  const [askStatus, setAskStatus] = useState<AskStatus | null>(null)
  const statusAbort = useRef<AbortController | null>(null)

  const refreshStatus = useCallback(() => {
    statusAbort.current?.abort()
    const abort = new AbortController()
    statusAbort.current = abort
    getAskStatus(loggedIn ? accessToken : null, abort.signal)
      .then((next) => {
        if (!abort.signal.aborted) setAskStatus(next)
      })
      .catch(() => {})
  }, [loggedIn, accessToken])

  useFocusEffect(
    useCallback(() => {
      refreshStatus()
      return () => statusAbort.current?.abort()
    }, [refreshStatus]),
  )

  return { askStatus, refreshStatus }
}
