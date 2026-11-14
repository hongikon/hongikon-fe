import type { ConfigContext, ExpoConfig } from 'expo/config'
import { withInfoPlist, type ConfigPlugin } from 'expo/config-plugins'

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

/**
 * 근처 제휴 알림(백그라운드 지오펜스) 빌드. 켜면 iOS "항상" 위치·UIBackgroundModes location, Android 백그라운드 위치 권한이
 * 들어가고 앱이 기능을 연다(`extra.nearbyAlerts`). 스토어 심사(Play 백그라운드 위치 신고서, App Store 2.5.4)와
 * 위치정보법 확인이 끝나기 전에는 운영 빌드에 켜지 않는다 — `docs/nearby-partner-alert-impl-plan.md`.
 * (iOS 의 expo-location 지오펜싱은 UIBackgroundModes 에 location 이 없으면 시작을 거부한다.)
 */
const NEARBY_ALERTS_BUILD = process.env.NEARBY_ALERTS_BUILD === '1'

/**
 * 근처 알림 실기기 현장 테스트 빌드(TestFlight 내부 테스트용, `eas.json` nearby-testflight). 근처 알림 빌드 위에서만 뜻이 있다:
 * 서버의 업체별 대상 표시·긴급 스위치·동의 저장 없이도 돌도록(혜택 있는 업체 전부 대상, 동의는 기기에만) 하고,
 * 운영 변형(production)이어도 개발용 도구(시계·반경 링크, 상태 줄, 지도 영역 보기)를 연다. 외부 배포·심사 빌드에는 켜지 않는다.
 */
const NEARBY_FIELD_TEST = NEARBY_ALERTS_BUILD && process.env.NEARBY_FIELD_TEST === '1'

/**
 * 로컬 서버(http://)로 붙는 테스트 빌드용 Android 평문 통신 허용. 운영 빌드에서는 무시한다.
 */
const ALLOW_CLEARTEXT_API = process.env.ALLOW_CLEARTEXT_API === '1' && VARIANT !== 'production'

type PluginEntry = string | [string, Record<string, unknown>]

function withPluginOptions(plugins: PluginEntry[] | undefined, name: string, extra: Record<string, unknown>): PluginEntry[] {
  return (plugins ?? []).map((entry) => {
    if (entry === name) return [name, extra]
    if (Array.isArray(entry) && entry[0] === name) return [name, { ...entry[1], ...extra }]
    return entry
  })
}

/** 플러그인 설정에서 옵션 값을 꺼낸다(없으면 undefined). */
function pluginOption(plugins: PluginEntry[] | undefined, name: string, key: string): string | undefined {
  const entry = (plugins ?? []).find((item) => Array.isArray(item) && item[0] === name)
  const value = Array.isArray(entry) ? entry[1][key] : undefined
  return typeof value === 'string' ? value : undefined
}

/**
 * iOS 권한 창을 한국어로(11-01). Info.plist 에 CFBundleDevelopmentRegion ko 만 있고 앱 안에 ko.lproj 가 없으면, iOS 는 권한 창의
 * 버튼("Allow While Using App" 등)을 영어로 띄운다. Expo `locales` 로 ko.lproj/InfoPlist.strings 를 만들고, 문구는 플러그인에
 * 넣은 값을 그대로 옮겨 Info.plist 와 어긋나지 않게 한다.
 */
function koreanInfoPlistStrings(plugins: PluginEntry[] | undefined, displayName: string): Record<string, string> {
  const strings: Record<string, string | undefined> = {
    CFBundleDisplayName: displayName,
    NSCameraUsageDescription: pluginOption(plugins, 'expo-image-picker', 'cameraPermission'),
    NSPhotoLibraryUsageDescription: pluginOption(plugins, 'expo-image-picker', 'photosPermission'),
    NSLocationWhenInUseUsageDescription: pluginOption(plugins, 'expo-location', 'locationWhenInUsePermission'),
    NSLocationAlwaysAndWhenInUseUsageDescription: pluginOption(plugins, 'expo-location', 'locationAlwaysAndWhenInUsePermission'),
    NSLocationAlwaysUsageDescription: pluginOption(plugins, 'expo-location', 'locationAlwaysPermission'),
  }
  // InfoPlist.strings 는 "키" = "값"; 형식이라 값 안의 따옴표·역슬래시를 이스케이프한다(플러그인은 그대로 쓴다).
  return Object.fromEntries(
    Object.entries(strings)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')]),
  )
}

/**
 * expo-task-manager 의 설정 플러그인은 모든 빌드에 iOS 백그라운드 모드 'fetch' 를 넣는다. 근처 알림(지오펜싱)은 fetch 를 쓰지
 * 않고, 쓰지 않는 백그라운드 모드는 App Store 심사(2.5.4)에서 질문을 받을 수 있어 뺀다.
 */
const withoutBackgroundFetch: ConfigPlugin = (config) =>
  withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes
    if (Array.isArray(modes)) {
      const rest = modes.filter((mode) => mode !== 'fetch')
      if (rest.length > 0) mod.modResults.UIBackgroundModes = rest
      else delete mod.modResults.UIBackgroundModes
    }
    return mod
  })

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseId = config.ios?.bundleIdentifier ?? 'com.hongikon.app'
  const id = `${baseId}${ID_SUFFIX[VARIANT]}`

  let plugins = config.plugins as PluginEntry[] | undefined
  if (NEARBY_ALERTS_BUILD) {
    plugins = withPluginOptions(plugins, 'expo-location', {
      // 기본(app.json) 문구는 "위치를 한 번 사용해요"라 근처 알림 빌드에서는 맞지 않는다(10-31).
      locationWhenInUsePermission:
        '지도에서 내 위치와 길을 보여 주고, 가까운 제휴 가게와 거리를 보여 주고, 제휴 가게에 머물 때 혜택을 알려 드릴 때 위치를 사용해요. 위치는 휴대폰 안에서만 쓰고 서버로 보내거나 저장하지 않아요.',
      locationAlwaysAndWhenInUsePermission:
        '제휴 가게에 머물 때 받을 수 있는 혜택을 알려 드리려고 앱을 쓰지 않는 동안에도 위치를 사용해요. 위치는 휴대폰 안에서만 쓰고 서버로 보내거나 저장하지 않아요.',
      locationAlwaysPermission:
        '제휴 가게에 머물 때 받을 수 있는 혜택을 알려 드리려고 앱을 쓰지 않는 동안에도 위치를 사용해요. 위치는 휴대폰 안에서만 쓰고 서버로 보내거나 저장하지 않아요.',
      isIosBackgroundLocationEnabled: true,
      isAndroidBackgroundLocationEnabled: true,
      // 가게 근처(깨우는 원 안)에 있을 때만 GPS 로 20m 를 재는 동안 Android 는 포그라운드 서비스(상단 알림)가 필요하다(10-31).
      // 없으면 위치 갱신을 못 켜 100m 지오펜스로만 판단했다.
      isAndroidForegroundServiceEnabled: true,
    })
  }
  if (ALLOW_CLEARTEXT_API) {
    const buildProps = (plugins ?? []).find((entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties')
    const android = (Array.isArray(buildProps) ? (buildProps[1].android as Record<string, unknown>) : undefined) ?? {}
    plugins = withPluginOptions(plugins, 'expo-build-properties', { android: { ...android, usesCleartextTraffic: true } })
  }

  return withoutBackgroundFetch({
    ...config,
    // 버전을 따로 줄 때만 쓴다(예: 1.0.0 사용자용 OTA `update:production:1.0.0`).
    // 현장 테스트 TestFlight(nearby-testflight)는 11-14 부터 1.1.1(eas.json 프로필 env): 1.1.0 이 App Store 승인되면 Apple 이
    // 1.1.0 기차를 닫아 같은 버전 TestFlight 업로드가 처리 실패한다(ITMS-90186·90062, 빌드 34·35). 런타임도 1.1.1 이 되고,
    // `update:testflight` 가 같은 프로필 env 를 넣어 테스트 OTA 도 1.1.1 로 간다. 운영(1.1.0)과는 채널·런타임 모두 따로다.
    version: process.env.APP_VERSION_OVERRIDE || config.version,
    plugins,
    name: `${config.name ?? '홍익온'}${NAME_SUFFIX[VARIANT]}`,
    locales: { ...config.locales, ko: { ios: koreanInfoPlistStrings(plugins, `${config.name ?? '홍익온'}${NAME_SUFFIX[VARIANT]}`) } },
    slug: config.slug ?? 'hongik-alimi',
    ios: {
      ...config.ios,
      bundleIdentifier: id,
      // 운영 빌드에서는 로컬 네트워크 예외(NSAllowsLocalNetworking — 개발 서버·로컬 API 용)를 뺀다(심사 2.5 권장).
      infoPlist:
        VARIANT === 'production'
          ? {
              ...config.ios?.infoPlist,
              NSAppTransportSecurity: { NSAllowsArbitraryLoads: false },
            }
          : config.ios?.infoPlist,
    },
    android: {
      ...config.android,
      package: id,
      // Android 푸시(FCM)에 필요한 Firebase 설정 파일. 시크릿은 아니지만 패키지 id 마다 달라서
      // EAS 파일 환경 변수(GOOGLE_SERVICES_JSON)로 넣는다 — docs/release-build.md 참고.
      // 값이 없으면(로컬·웹) 지금처럼 FCM 없이 빌드된다.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    },
    extra: {
      ...config.extra,
      /** 앱 상태 화면에 무엇으로 빌드된 앱인지 보여 주려고 남긴다. */
      appVariant: VARIANT,
      /** 근처 제휴 알림 빌드인지(`lib/nearbyPartners/background.ts`). */
      nearbyAlerts: NEARBY_ALERTS_BUILD,
      /** 근처 알림 현장 테스트 빌드인지(`lib/nearbyPartners/debug.ts`). */
      nearbyFieldTest: NEARBY_FIELD_TEST,
    },
  })
}
