import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * 실행 환경(개발/테스트/운영)별로 앱 이름과 패키지 id 를 갈라준다.
 *
 * 고정값은 `app.json` 에 그대로 두고, 여기서는 환경에 따라 달라지는 값만 덮어쓴다
 * (`config` 인자가 app.json 을 읽어 온 결과다).
 *
 * `APP_VARIANT` 는 `eas.json` 의 빌드 프로필 env 가 넣어 준다. 로컬에서
 * `expo start` 로 띄울 땐 값이 없어 자동으로 개발(development)로 본다.
 *
 * 패키지 id 가 달라 한 기기에 개발·테스트·운영 빌드를 나란히 깔 수 있다. 다만
 * `scheme`(hongikon://)은 백엔드가 카카오 로그인 후 돌려보내는 주소라 셋 다 같다 —
 * 두 개 이상 깔면 로그인 복귀 때 어느 앱으로 갈지 OS 가 고르므로, 로그인 흐름을
 * 검증할 땐 한 번에 하나만 설치해 둔다.
 */

type AppVariant = 'development' | 'preview' | 'production'

const VARIANT: AppVariant =
  process.env.APP_VARIANT === 'production' || process.env.APP_VARIANT === 'preview'
    ? process.env.APP_VARIANT
    : 'development'

const NAME_SUFFIX: Record<AppVariant, string> = {
  development: ' (개발)',
  preview: ' (테스트)',
  production: '',
}

const ID_SUFFIX: Record<AppVariant, string> = {
  development: '.dev',
  preview: '.preview',
  production: '',
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseId = config.ios?.bundleIdentifier ?? 'com.hongmap.alimi'
  const id = `${baseId}${ID_SUFFIX[VARIANT]}`

  return {
    ...config,
    name: `${config.name ?? '홍익온'}${NAME_SUFFIX[VARIANT]}`,
    slug: config.slug ?? 'hongik-alimi',
    ios: { ...config.ios, bundleIdentifier: id },
    android: { ...config.android, package: id },
    extra: {
      ...config.extra,
      /** 앱 상태 화면에 무엇으로 빌드된 앱인지 보여 주려고 남긴다. */
      appVariant: VARIANT,
    },
  }
}
