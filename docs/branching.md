# 브랜치 전략 (2026-10-06 정리)

`main` ← `dev` ← 작업 브랜치. **모든 작업 브랜치는 `dev` 에서 갈라 `dev` 로 합치고, `main` 은 `dev` 를 합칠 때만 바뀐다.**
`main` 에 올리면 곧바로 운영(hongikon.com, Netlify 자동 배포)에 나가므로, 확인 전 작업은 `dev` 에 모은다.

```
feat/* · fix/* · ui/* · hotfix/* · chore/* · docs/*  ──merge(--no-ff)──▶  dev  ──릴리스 merge(--no-ff)──▶  main
                                                                           │                                │
                                                     localhost 확인, preview OTA·빌드          hongikon.com 배포, production OTA·스토어 빌드
```

| 접두사 | 쓰는 때 | 예 |
|---|---|---|
| `feat/` | 새 기능 | `feat/official-accounts` |
| `fix/` | 버그 수정 | `fix/hot-list-toggle` |
| `ui/` | 화면·문구·색·아이콘 등 보이는 것만 바꿀 때 | `ui/logotype-app-icon` |
| `hotfix/` | 운영에 나간 급한 버그. 역시 `dev` 에서 갈라 `dev` 로 합친 뒤 바로 `main` 으로 올린다 | `hotfix/login-crash` |
| `chore/` | 설정·빌드·의존성 | `chore/enable-web-apple` |
| `docs/` | 문서만 | `docs/branch-strategy` |

## 순서

1. `git switch dev && git pull` → `git switch -c feat/이름`
2. 작업·커밋 → `pnpm exec tsc --noEmit -p .` → `git push -u origin feat/이름`
3. `dev` 로 합친다: `git switch dev && git merge --no-ff feat/이름 && git push` (팀원 검토가 필요하면 PR → dev)
4. `dev` 를 로컬에서 확인한다: `pnpm web` (port 8081). 앱 실기기는 `pnpm update:preview` 또는 preview 빌드.
5. 릴리스: `git switch main && git pull && git merge --no-ff dev` → 타입 검사·`pnpm build:web` 확인 → `git push`
   → `pnpm update:production`(앱 OTA). 네이티브 변경(아이콘·권한·패키지)이 있으면 스토어 빌드도.
6. 릴리스 뒤 `dev` 를 `main` 과 맞춘다: `git switch dev && git merge --ff-only main && git push`.

## 지킬 것

- `main` 에 직접 커밋하지 않는다. 운영에서만 바꿔야 하는 설정(예: 서버 배포 전 기능 끄기)도 브랜치 → dev → main.
- OTA production 은 `main` 의 커밋에서만 낸다 — 대시보드의 Commit 값으로 어떤 코드가 나갔는지 추적한다.
- 네이티브 변경(패키지·`app.json`·권한·아이콘)은 OTA 로 못 나간다. `dev` 에서 preview 빌드로 확인 후 스토어 빌드.
- 서버가 먼저 배포돼야 하는 기능은 서버 배포를 확인한 뒤 `main` 에 올린다(그 전엔 dev 에 두거나 설정으로 꺼 둔다).
- 백엔드(`hongikon-be`)도 같은 규칙(`main` ← `dev` ← 작업 브랜치). 배포는 SQL·환경변수 순서가 있어 `docs/deploy-runbook-*.md` 를 따른다.
- `src/utils/mapHtml.ts`(지도 페이지)를 고치면 `npx tsx --env-file=.env scripts/generate-map-html.ts` 로 `public/map.html` 을 다시 만들어
  함께 커밋한다. 웹은 번들에서 바로 그리지만 앱(WebView)은 배포된 `map.html` 을 불러와, 빠뜨리면 앱 지도에만 변경이 안 들어간다
  (10-03~10-05 수정이 이렇게 앱에서 빠져 있었다).
