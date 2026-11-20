/** 설정 묶음(10-31·11-01). 누르면 그 자리에서 아래로 펼친다(여러 개를 함께 펼칠 수 있다). */
export type SettingsGroup = 'account' | 'alerts' | 'general' | 'support' | 'policies'

/** 설정 화면에서 한 번에 하나만 뜨는 창. */
export type SettingsModalType =
  | 'notices'
  | 'sources'
  | 'terms'
  | 'licenses'
  | 'support'
  | 'privacy'
  | 'feedback'
  | 'infoSuggest'
  | 'permissions'
  | 'keywords'
  | 'nickname'
  | 'hiddenUsers'
  | 'myReports'
  | 'official'
  | null
