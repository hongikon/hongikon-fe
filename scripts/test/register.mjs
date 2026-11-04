// `pnpm test` 용 로더. 앱 코드는 확장자 없이 import 하므로(Metro 방식) Node 가 `.ts` 를 찾게 해 준다.
// Node 23.6+ 는 .ts 의 타입을 지우고 바로 실행하므로 따로 빌드하거나 패키지를 깔 필요가 없다.
// 순수 함수(src/lib/nearbyPartners/rules.ts 등)만 테스트한다 — react-native 를 import 하는 파일은 여기서 못 돈다.
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const CANDIDATES = ['.ts', '.tsx', '/index.ts']

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
      for (const suffix of CANDIDATES) {
        const url = new URL(specifier + suffix, context.parentURL)
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
