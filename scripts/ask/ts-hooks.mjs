// 앱 소스(.ts)를 Node 로 바로 읽게 확장자 없는 import 를 .ts / index.ts 로 잇는다(Node 24 타입 지우기 사용).
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.startsWith('file:')) {
    for (const suffix of ['.ts', '.tsx', '/index.ts']) {
      const url = new URL(specifier + suffix, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
  }
  return next(specifier, context)
}
