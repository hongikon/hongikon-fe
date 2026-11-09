#!/bin/zsh
# 물어보기 설정 비교 한 번에 돌리기(11-09, docs/ask-reasoning-eval.md 8절).
# 설정마다 로컬 서버(jar)를 띄우고 → reason·place 시험지를 묻고 → 무료 채점(check.mjs) 표를 낸다.
#
# 키는 이 터미널 환경 변수로만 받는다(파일·명령 인자·채팅에 남기지 않는다 — 서버가 환경 변수를 그대로 읽는다):
#   export ANTHROPIC_API_KEY=...      # 필수
#   export ASK_EMBED_KEY=...          # 있으면 RAG(임베딩) 켜서 운영과 같게, 없으면 카탈로그 고르기
# 사용:
#   BE_JAR=…/hongmap-backend-0.0.1-SNAPSHOT.jar BE_LOCAL=…/application-local.properties ./matrix.sh [runs=1] [설정 이름…]
#   설정 이름을 안 주면 아래 MATRIX 전부. 결과: out-<날짜>/answers-<설정>-<시험지>[-rN].json, summary.md
set -euo pipefail
cd "${0:A:h}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY 를 이 터미널에서 export 해 주세요}"
: "${BE_JAR:?BE_JAR(서버 jar 경로)}"
: "${BE_LOCAL:?BE_LOCAL(application-local.properties 경로 — DB 접속용)}"
RUNS=${1:-1}; (( $# > 0 )) && shift
PORT=8181
DEVKEY=$(openssl rand -hex 24)
DEVSHA=$(printf %s "$DEVKEY" | shasum -a 256 | cut -d' ' -f1)
EXTRA_V2="${0:A:h}/reason-extra-v2.txt"
OUT="out-$(date +%m%d-%H%M)"; mkdir -p "$OUT"

# 이름 → 서버 설정. 모델은 고르기·답 쓰기 모두 같은 모델.
typeset -A MATRIX
MATRIX[haiku-base]="--ask.graph.enabled=false"
MATRIX[haiku-graph]="--ask.graph.enabled=true"
MATRIX[haiku-graph-medium]="--ask.graph.enabled=true --ask.llm.answer-effort=medium --ask.llm.answer-max-tokens=12000 --ask.llm.answer-extra-file=$EXTRA_V2"
MATRIX[haiku-graph-reason]="--ask.graph.enabled=true --ask.llm.answer-effort=high --ask.llm.answer-max-tokens=16000 --ask.llm.answer-extra-file=$EXTRA_V2"
MATRIX[sonnet-graph-reason]="--ask.llm.model=claude-sonnet-5-5 --ask.graph.enabled=true --ask.llm.answer-effort=high --ask.llm.answer-max-tokens=16000 --ask.llm.answer-extra-file=$EXTRA_V2"
NAMES=(${@:-haiku-base haiku-graph haiku-graph-medium haiku-graph-reason sonnet-graph-reason})

RAG=false; [[ -n "${ASK_EMBED_KEY:-}" ]] && RAG=true

for name in $NAMES; do
  echo "== $name"
  pkill -f "hongmap-backend.*--server.port=$PORT" 2>/dev/null || true; sleep 2
  # 서버는 결과 폴더 안에서 띄운다 — 서버가 남기는 대화 기록(logs/ask-transcript.txt)도 git 밖 결과 폴더에 남게.
  (cd "$OUT" && exec java -jar "${BE_JAR:A}" --spring.profiles.active=local --spring.config.additional-location="file:${BE_LOCAL:A}" \
    --server.port=$PORT --ask.dev-key-sha256=$DEVSHA --ask.rag.enabled=$RAG --ask.llm.warm.enabled=false \
    ${=MATRIX[$name]} > "server-$name.log" 2>&1) &
  for i in {1..90}; do grep -q "Started " "$OUT/server-$name.log" && break; sleep 2; done
  if grep -q "LLM(/ask/route)이 꺼져" "$OUT/server-$name.log"; then echo "LLM 꺼짐 — ANTHROPIC_API_KEY 확인"; exit 1; fi
  for set in reason place; do
    ASK_DEV_KEY=$DEVKEY node run.mjs "$name-$set" "http://localhost:$PORT" --cases $set --runs $RUNS
  done
  mv answers-$name-*.json "$OUT/"
done
pkill -f "hongmap-backend.*--server.port=$PORT" 2>/dev/null || true

{
  echo "# 물어보기 설정 비교 $(date '+%Y-%m-%d %H:%M') · runs=$RUNS · RAG=$RAG"
  for set in reason place; do
    echo "\n## $set"
    node check.mjs $set "$OUT"/answers-*-$set*.json | sed -n '/^| 파일/,$p'
  done
} | tee "$OUT/summary.md"
echo "\n문항별: node check.mjs reason $OUT/answers-<설정>-reason*.json"
echo "LLM 채점(유료, reason 만): node judge.mjs … (docs/ask-reasoning-eval.md 7절)"
