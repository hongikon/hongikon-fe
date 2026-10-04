import AsyncStorage from '@react-native-async-storage/async-storage'
import { TERMS_VERSION } from '../constants/legalText'

/**
 * 로그인(가입) 전 이용약관 동의 기록. 기기에만 저장한다(웹은 localStorage).
 *
 * 저장값: `{ version, agreedAt }` — 동의한 약관 판(TERMS_VERSION)과 동의 시각(ISO).
 * 판이 지금 TERMS_VERSION 과 다르면(약관 개정) 다음 로그인 때 동의 시트를 다시 띄운다.
 * 로그아웃·탈퇴·로그인 만료로 로그인 상태가 끝나면 지운다(`clearTermsConsent`, `AuthContext` 가 부른다) — 기기 단위
 * 기록이라 남겨 두면 같은 기기에서 다른 사람이 새로 가입할 때 동의를 묻지 않고 지나간다. 같은 사람이 다시 로그인해도
 * 한 번 더 묻는 셈이지만, 동의는 로그인할 때마다 받는 편이 맞다. 둘러보기(게스트)는 약관 동의를 묻지 않아 영향이 없다.
 *
 * 서버 기록(terms_version, terms_agreed_at)은 백엔드가 받을 수 있게 되면 로그인 요청에 함께 보낸다
 * (store-submission-kit B1). 지금은 기기 기록만 남는다.
 */
const STORAGE_KEY = '@hongikon_terms_consent'

export interface TermsConsent {
  version: string
  agreedAt: string
}

export async function getTermsConsent(): Promise<TermsConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { version, agreedAt } = parsed as Partial<TermsConsent>
    if (typeof version !== 'string' || typeof agreedAt !== 'string') return null
    return { version, agreedAt }
  } catch {
    return null
  }
}

/** 지금 판의 약관에 이 기기에서 동의한 적이 있는지. 읽지 못하면 false(다시 묻는다). */
export async function hasCurrentTermsConsent(): Promise<boolean> {
  const consent = await getTermsConsent()
  return consent?.version === TERMS_VERSION
}

/** 지금 판의 약관 동의를 기록한다. 저장에 실패해도 로그인은 진행한다(다음에 다시 물을 뿐이다). */
export async function saveTermsConsent(): Promise<void> {
  const consent: TermsConsent = { version: TERMS_VERSION, agreedAt: new Date().toISOString() }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  } catch (error) {
    if (__DEV__) console.warn('약관 동의 기록을 저장하지 못했어요:', error)
  }
}

/**
 * 기기의 약관 동의 기록을 지운다(로그아웃·탈퇴·로그인 만료). 다음 로그인 때 동의 시트를 다시 띄운다.
 * 실패해도 로그아웃은 막지 않는다 — 남은 기록은 "동의한 판" 하나뿐이고 다음 로그아웃 때 다시 지운다.
 */
export async function clearTermsConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    if (__DEV__) console.warn('약관 동의 기록을 지우지 못했어요:', error)
  }
}
