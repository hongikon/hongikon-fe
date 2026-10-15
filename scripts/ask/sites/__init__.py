"""학교 부속 사이트(도서관·기숙사·국제협력본부 …). 사이트 하나에 파일 하나.

파일(sites/<이름>.py)에 두는 것:
  LABEL    답 아래 출처 링크에 붙는 이름(예: '중앙도서관 홈페이지')
  PAGES    {키: URL} — 답으로 옮길 상시 안내 페이지만. 키는 '<이름>_…' 로 시작한다(학교 홈페이지 키와 겹치지 않게)
  CONTENT  본문 상자 고르기 {'id': …} / {'class': …} / {'tag': …}(함께 쓰면 모두 맞아야 함). 없으면 id="cms-content"
  postprocess(key, page, raw) (선택) 본문이 표준 구조가 아닐 때 page['sections'] 를 고쳐 돌려준다

사용: python3 -I scripts/ask/crawl.py --site 이름 → python3 -I scripts/ask/extract.py --site 이름 → gen.py
"""
