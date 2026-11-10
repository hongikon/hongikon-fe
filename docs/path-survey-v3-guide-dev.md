# 경로망 조사 v3 - 개발 담당 사용 가이드

조사 담당이 내보낸 파일을 길찾기와 서버에 어떻게 쓰는지 정리한 문서입니다.
필드 정의는 `docs/path-survey-v3.md` 1장을 기준으로 하고, 여기서는 **쓰는 방법**을 다룹니다.

---

## 1. 파일을 받으면 먼저 할 일

1. `format === "hongikon.pathSurvey"` 이고 `version === 3` 인지 확인한다.
2. **`complete` 를 확인한다.**
   - `true`: 점검 오류 0건. 제외 목록이 모두 비어 있다. 최종본으로 써도 된다.
   - `false`: 미완성. 개발 중 임시로 쓰는 용도이고, 파일 이름에 `incomplete` 가 붙는다.
3. `check.errorCount`, `check.warningCount`, `excluded` 를 보고 이번 파일이 얼마나 완성됐는지 파악한다.
4. 길찾기에는 `graph` 만 읽는다. `nodes`, `edges` 는 조사 원본이다.

파일 이름: `path-survey-v3-graph-YYYYMMDD-HHMM.json`

---

## 2. 그래프로 읽기

### 2.1 구조 요약

- 점: `graph.vertices` (`id`, `node`, `building`, `floor`, `lat`, `lng`, `type`)
- 간선: `graph.edges` (`a`, `b`, `kind`, `meters`), **모두 양방향**
- 외부 점 id 는 `n12`, 내부 점 id 는 `n12@hongik_k:-1` (점id@건물코드:층)
- 여러 층에 걸친 점은 층마다 정점이 하나씩 있다.
- 간선 양 끝은 항상 `graph.vertices` 안에 있다.

### 2.2 간선 종류별 비용

| `kind` | 의미 | 비용 |
|---|---|---|
| `normal` | 평면 걷기 | `meters` |
| `stairs` | 조사자가 계단으로 표시한 평면 구간 | `meters` (높이 차는 빠져 있어 실제보다 짧음) |
| `stairs_vertical` | 같은 계단 점의 인접한 층 사이 | `meters` 없음. **정해야 함** |
| `elevator_vertical` | 같은 엘리베이터 점의 모든 두 층 사이 | `meters` 없음. **정해야 함** |
| `tie` | 건물이 달라도 높이가 같은 두 층(같은 자리) | `0` |

### 2.3 인접 리스트 만들기 (예시)

```js
const file = JSON.parse(text);
if (file.format !== 'hongikon.pathSurvey' || file.version !== 3) {
  throw new Error('unsupported file');
}

// 수직 이동 비용은 길찾기 쪽에서 정한다(아래 값은 자리표시자).
const COST = {
  stairs_vertical: STAIRS_FLOOR_COST,   // 인접 층 한 칸
  elevator_vertical: ELEVATOR_COST,     // 두 층 사이 이동 한 번
  tie: 0,
};

function weightOf(edge) {
  if (edge.kind === 'normal') return edge.meters;
  if (edge.kind === 'stairs') return edge.meters * STAIRS_FLAT_FACTOR;
  return COST[edge.kind];
}

const adj = new Map();
function add(from, to, w) {
  if (!adj.has(from)) adj.set(from, []);
  adj.get(from).push({ to, w });
}
for (const e of file.graph.edges) {
  const w = weightOf(e);
  add(e.a, e.b, w);
  add(e.b, e.a, w);
}
```

이 뒤는 일반 Dijkstra 이다.

### 2.4 수직 이동 가중치 (정해야 하는 값)

| 상수 | 뜻 | 결정할 것 |
|---|---|---|
| `STAIRS_FLAT_FACTOR` | 계단 평면 간선의 가중 배수 | 계단이 평지보다 얼마나 힘든지 |
| `STAIRS_FLOOR_COST` | 계단으로 한 층 오르내리는 비용 | 미터 환산 또는 초 환산 |
| `ELEVATOR_COST` | 엘리베이터 한 번 이용 비용 | 대기 시간 포함 여부 |

수직 이동에는 `meters` 가 없으므로 길찾기 쪽에서 상수로 정해야 한다. 걸어서 가는 거리와 같은 단위(미터 환산 또는 초)로 맞춘다.

---

## 3. 출발지와 도착지 연결

- **건물 입구:** `type === "entrance"` 인 정점에 `building`, `floor` 가 있다. 출입구 라벨(`entranceLabel`)은 그래프 정점에 복사되어 있지 않으므로, `vertex.node` 로 `file.nodes` 의 원본 점을 찾아 읽는다.
- **서버 건물과 맞추기:** `building` 은 서버 `/map/data` 의 `buildings[].code`(예: `hongik_r`)와 같은 값이다.
- **서버에 없는 출입구:** `report.labelsNotOnServer` 에 나온다. 서버 `buildings.entrances` 에 추가할 후보이다.
- **층:** 파일 안에서는 숫자(`-1` = B1, `0` = L, `1.5` = 중간층)이고, 화면에서만 B로 바꿔 보인다.

---

## 4. 미완성 파일을 쓸 때 주의

- 그래프의 모든 간선은 양 끝이 있으므로 그대로 읽어도 깨지지 않는다.
- 다만 **끊어진 곳이 있을 수 있다.** 경로를 못 찾았다고 실제로 길이 없다는 뜻은 아니다.
- 오류가 있어도 펼칠 수 있는 것은 그래프에 남는다. 라벨 없는 출입구가 그 예다. 이런 점을 쓰지 않으려면 `check.errors` 의 `nodeId` 로 걸러낸다.
- `excluded` 는 "왜 그래프에 없는지" 알려 준다. 길이 안 이어질 때 먼저 확인한다.
- 건물 사이를 잇는 층 짝이 없는 엘리베이터(`ties_missing`)는 그래프에서 건물 사이가 끊긴 채 남는다.

**권장:** 개발 중에는 미완성 파일로 길찾기 로직을 만들고, 배포용 데이터는 `complete: true` 파일로 교체한다.

---

## 5. 파일 검증 체크리스트

파일을 받을 때 간단히 확인할 것:

- [ ] `complete` 값과 `check` 건수
- [ ] `excluded` 의 네 배열(nodes, levels, edges, ties) 건수
- [ ] 그래프의 연결 덩어리 수(점검 `components` 참고). 캠퍼스가 하나로 이어져야 하는 구간이 여러 덩어리로 나뉘면 끊긴 곳이 있다는 뜻
- [ ] `report.labelsNotOnServer` 에 나온 라벨 수
- [ ] 샘플과 비교: `scripts/path-survey/fixtures/path-survey-v3-export-complete.json`, `path-survey-v3-export-incomplete.json`

---

## 6. 서버에 반영할 때 확인할 것

아래는 현재까지 확인한 상태이고, 작업 전에 최신 코드를 다시 확인한다. 백엔드 저장소(hongikon-be)의 경로는 2026-11-07 에 `main`, `dev` 브랜치에서 확인했다.

1. **v3 파일을 그대로 넣을 수 있는 가져오기는 아직 없다.** 기존 가져오기는 두 가지이고, 읽는 형식이 서로 다르다.
   - (11-09) v2 가져오기(`scripts/path/import-survey.mjs` → `surveyPaths.ts`)는 지웠다. v3 는 `scripts/path/import-survey-v3.mjs` 가 서버 길찾기 파일(hongikon-be `src/main/resources/walkroute/survey-graph-v3.json`)을 만든다.
   - 백엔드 저장소(hongikon-be)의 `POST /admin/map/path-network/import`: `format: 1` 의 점, 간선, 출입구 참조 JSON 을 읽는다. 조사 파일 형식이 아니다. 코드는 `src/main/java/com/hongmap/hongmapbackend/mapdata/` 의 `AdminMapPathController.java`, `PathNetworkImportService.java`, `dto/PathImportRequest.java` 이다.
2. **서버 점 종류:** `WAYPOINT`, `ENTRANCE`. v3 의 `basic`, `stairs`, `elevator`, `entrance` 와 층 정보를 어떻게 매핑할지 정해야 한다.
3. **출입구 좌표:** 서버는 출입구 좌표를 `buildings.entrances` 에서 읽는다. v3 파일의 출입구와 서버 `entrances` 를 라벨로 대조한다. 서버에 없는 라벨(`labelsNotOnServer`)은 백엔드 저장소(hongikon-be)의 건물 정보 동기화 SQL(`db/sync_map_data_*.sql`)로 먼저 추가한다. 건물 정보 변경은 관리자 API가 아니라 SQL 반영이다.
4. **층:** 서버 건물의 `floors` 는 현재 비어 있다. v3 의 층(숫자)이 서버 표기와 맞는지 정한다.
5. **현재 서버의 경로망은 비어 있다.** 처음 반영하는 것이므로 기존 데이터 충돌은 없지만, 백엔드 저장소(hongikon-be)의 운영 배포 런북(`docs/deploy-runbook-path-network.md`)을 따른다.

---

## 7. 기존 앱 길찾기와의 관계

- (11-09) 길찾기는 서버가 v3 그래프로 계산한다(hongikon-be `walkroute`: `GET /map/routes`, 내 위치 출발은 `GET /map/routes/approach`). 앱에는 경로망·계산 코드가 없다. 아래는 그 전에 적은 선택지다.
- v3 그래프를 앱에 쓰려면 다음 중 하나를 정한다.
  - A. 앱에 v3 그래프를 내려받아 새 길찾기에 쓴다.
  - B. v3 를 기존 `pathNodes` 형식으로 변환하는 스크립트를 만든다.
- 이 선택은 서버 형식 결정(6장)과 함께 정한다.

---

## 8. 아직 결정해야 하는 것

| 항목 | 질문 | 결정 주체 |
|---|---|---|
| 전달 방식 | 파일을 앱에 직접 넣을지, 서버 DB를 통해 내려 줄지 | 개발 담당 전체 |
| 서버 형식 | 서버를 v3 펼친 그래프에 맞출지, v3 를 기존 서버 형식으로 변환할지 | 개발 담당 전체 |
| 수직 이동 비용 | 계단, 엘리베이터 비용(2.4) | 길찾기 담당 |
| 출입구 라벨 | 서버에 없는 라벨의 추가 시점과 방법 | 서버 담당 |
| 미완성 파일 사용 | 어느 시점까지 임시 파일로 개발하고 언제 최종본으로 교체할지 | 개발 담당 전체 |

---

## 9. 자주 묻는 것

**Q. `graph` 와 `nodes`, `edges` 중 무엇을 읽나요?**
길찾기는 `graph`. `nodes`, `edges` 는 조사 원본이라 조사 담당이 다시 불러올 때 쓴다.

**Q. 간선 방향이 있나요?**
모두 양방향이다. 한 번만 들어 있으니 인접 리스트를 만들 때 양쪽에 넣는다.

**Q. 같은 건물 다른 층은 어떻게 이어지나요?**
계단 점은 `stairs_vertical`(인접 층), 엘리베이터 점은 `elevator_vertical`(모든 두 층)로 이어진다.

**Q. 건물 사이 통로는요?**
외부 길로 이어지거나, 같은 높이 층끼리 `tie`(비용 0)로 이어진다. 층이 하나씩인 두 건물을 일반 간선으로 직접 이은 것은 경고(`different_building_direct`)로 표시된다.

**Q. 파일을 코드로 검증하고 싶어요.**
`node --test scripts/path-survey/test-*.mjs` 를 돌리면 샘플과 코드가 일치하는지 확인한다.
