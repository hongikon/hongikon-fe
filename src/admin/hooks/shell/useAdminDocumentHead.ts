import { useEffect } from 'react'

/** 검색엔진에 잡히지 않게 하고 탭 제목을 바꾼다. 관리자 화면을 떠나면(전체 새로고침) 원래대로 돌아간다. */
export function useAdminDocumentHead() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = '홍익온 관리자'
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    meta.content = 'noindex, nofollow'
  }, [])
}
