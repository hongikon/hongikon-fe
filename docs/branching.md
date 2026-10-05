# 브랜치 전략 (2026-10-05 ~)

`main` 에 올리면 곧바로 운영(hongikon.com, Netlify 자동 배포)에 나가므로, 확인 전 작업은 `dev` 에 모은다.

```
feat/*, fix/*, chore/*  ──PR(또는 --no-ff 머지)──▶  dev  ──릴리스 PR(merge commit)──▶  main
                                                     │                                   │
                                     localhost 확인, preview OTA              hongikon.com 배포, production OTA
hotfix/*  ── main 에서 갈라 main 으로 ─────────────────────────────────────────────────────▶ main ──▶ dev 에도 머지
```

| 브랜치 | 용도 | 배포 |
|---|---|---|
| `main` | 운영. 사람이 확인한 것만 들어온다 | Netlify → hongikon.com, `pnpm update:production`(앱 OTA) |
| `dev` | 다음 릴리스 모음. 기능 브랜치를 여기에 합쳐 같이 확인한다 | 자동 배포 없음. 로컬(`pnpm web` → http://localhost:8081), 필요하면 `pnpm update:preview`(preview 빌드 앱) |
| `feat/…` `fix/…` `chore/…` `docs/…` | 작업 하나 | `dev` 에서 갈라 `dev` 로 |
| `hotfix/…` | 운영 긴급 수정 | `main` 에서 갈라 `main` 으로, 바로 `dev` 에도 머지 |

## 순서

1. `git switch dev && git pull` → `git switch -c feat/이름`
2. 작업·커밋 → `pnpm exec tsc --noEmit -p .` → `git push -u origin feat/이름`
3. `dev` 로 합친다(PR 권장, 혼자면 `git switch dev && git merge --no-ff feat/이름 && git push`).
4. `dev` 를 로컬에서 띄워 확인한다: `pnpm web` (port 8081). 앱 실기기는 `pnpm update:preview` 로 preview 채널 OTA.
5. 릴리스: GitHub 에서 `dev → main` PR 을 **Create a merge commit** 으로 머지 → Netlify 가 hongikon.com 배포 →
   `git switch main && git pull && pnpm update:production` (OTA 는 반드시 `main` 에서 낸다).

## 지킬 것

- `main` 에 직접 커밋·푸시하지 않는다(hotfix 도 브랜치 → PR).
- OTA production 은 `main` 의 커밋에서만 낸다 — 대시보드의 Commit 값으로 어떤 코드가 나갔는지 추적한다.
- 네이티브 변경(패키지·`app.config.ts`·권한)은 OTA 로 못 나간다. `dev` 에서 preview 빌드로 확인 후 스토어 빌드.
- 백엔드(`hongikon-be`)도 같은 이름 규칙을 쓴다. 배포는 SQL·환경변수 순서가 있어 `docs/deploy-runbook-*.md` 를 따른다.
- `src/utils/mapHtml.ts`(지도 페이지)를 고치면 `npx tsx --env-file=.env scripts/generate-map-html.ts` 로 `public/map.html` 을 다시 만들어
  함께 커밋한다. 웹은 번들에서 바로 그리지만 앱(WebView)은 배포된 `map.html` 을 불러와, 빠뜨리면 앱 지도에만 변경이 안 들어간다
  (10-03~10-05 수정이 이렇게 앱에서 빠져 있었다).
