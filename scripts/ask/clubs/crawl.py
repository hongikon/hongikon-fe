"""홍익대 중앙동아리 66개 → 물어보기 search_clubs 데이터(data/clubs.json).

출처: 총학생회 사이트 중앙동아리 목록(https://hongikunion.com/clubs/central). 페이지는 Next.js 로 그려지고,
목록·상세(/clubs/central/{id}) 모두 같은 공개 JSON(GET /api/data?key=hn_clubs)을 읽는다.
요청은 2번(robots.txt + 그 JSON), 읽기만, 로그인 없음.

개인정보: 회장 이름(president)·로고·이미지는 쓰지 않는다. 전화번호·이메일·오픈채팅 꼴 문자열은 지우고,
링크의 공유 추적 꼬리표(igsh, si, utm_*)는 뗀다. 화면에 그대로 나가지 않게 이모지도 지운다.

사용: python3 -I scripts/ask/clubs/crawl.py
결과를 hongikon-be/src/main/resources/ask/clubs.json 으로 복사한다(BE AskClubs 가 읽는다).
"""
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://hongikunion.com"
LIST_URL = f"{BASE}/clubs/central"
DATA_URL = f"{BASE}/api/data?key=hn_clubs"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")
OUT = Path(__file__).resolve().parent.parent / "data" / "clubs.json"
TRACKING_PARAMS = {"igsh", "si", "utm_source", "utm_medium", "utm_campaign", "hl"}
PERSONAL_PAT = re.compile(
    r"01[016789][- .]?\d{3,4}[- .]?\d{4}"      # 휴대전화
    r"|[\w.+-]+@[\w-]+\.[\w.]+"                 # 이메일
    r"|open\.kakao\.com/o/|카톡\s*아이디|카카오톡\s*ID"
)
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]")
# 학교 홈페이지 옛 동아리 안내(ask sources.json clubs/p0~p6)에 적힌 다른 이름 — 학생이 그 이름으로 물을 수 있어 별칭에 더한다.
EXTRA_ALIASES = {
    "Winners(야구반)": ["위너스"],
    "COWBOYS (카우보이스)": ["미식축구반"],
    "팡팡": ["배드민턴반"],
    "사격반": ["사격부", "HISC"],
    "핸드볼반": ["핸드볼부", "HIH"],
    "헬스반": ["헬스부"],
    "HITC": ["테니스반"],
    "HITTC": ["탁구동아리", "탁구반"],
    "인액터스": ["ENACTUS"],
    "보에라(Voera)": ["VO-ERA"],
    "스놀": ["SNoL"],
    "오픈런": ["Open Run"],
    "홍익대학교 스키부": ["스키부"],
    "가톨릭 학생회 가듐": ["가듐"],
    "고전기타반 네페르": ["고전기타반", "네페르"],
    "한국기독학생회 IVF": ["IVF"],
    "와우풍물패 惡반": ["와우풍물패", "풍물패"],
    "모래알 사진반": ["모래알"],
    "AIESEC in HIU (아이섹 홍익대학교 지부)": ["아이섹"],
}

stats = Counter()


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def robots_ok():
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(get(f"{BASE}/robots.txt").splitlines())
    return rp.can_fetch(UA, LIST_URL) and rp.can_fetch(UA, DATA_URL)


def clean_url(u):
    u = u.strip()
    p = urllib.parse.urlsplit(u)
    q = urllib.parse.parse_qsl(p.query, keep_blank_values=True)
    kept = [(k, v) for k, v in q if k not in TRACKING_PARAMS]
    if len(kept) != len(q) or (p.query == "" and u.endswith("?")):
        stats["tracking_params_stripped"] += 1
    return urllib.parse.urlunsplit(
        (p.scheme, p.netloc, p.path, urllib.parse.urlencode(kept), ""))


def link_type(u):
    host = urllib.parse.urlsplit(u).netloc.lower()
    for key, name in [("instagram", "instagram"), ("youtube", "youtube"),
                      ("youtu.be", "youtube"), ("blog.naver", "naver_blog"),
                      ("cafe.naver", "naver_cafe"), ("tistory", "tistory"),
                      ("play.google", "google_play"), ("open.kakao", "kakao_openchat")]:
        if key in host:
            return name
    return "homepage"


def aliases(name):
    """'HIUC(합창반)' → ['HIUC', '합창반'] — 괄호 앞뒤 어느 쪽으로 물어도 찾게."""
    out = []
    m = re.match(r"^(.*?)\s*\((.+)\)\s*$", name)
    if m:
        base, inner = m.group(1).strip(), m.group(2).strip()
        if base:
            out.append(base)
        out += [s.strip() for s in inner.split(",") if s.strip()]
    for extra in EXTRA_ALIASES.get(name, []):
        if extra not in out:
            out.append(extra)
    return out or None


def clean(text):
    """개인정보 꼴 문자열·이모지를 지우고 공백을 정리한다."""
    if not text:
        return text
    new, n = PERSONAL_PAT.subn("", text)
    stats["personal_pattern_removed"] += n
    new, e = EMOJI.subn("", new)
    stats["emoji_removed"] += e
    return re.sub(r"[ \t]+", " ", new).strip()


def nz(v):
    v = (v or "").strip() if isinstance(v, str) else v
    return v or None


def main():
    if not robots_ok():
        raise SystemExit("robots.txt disallows /clubs or /api/data - stopping")
    time.sleep(1)
    raw = json.loads(get(DATA_URL))
    clubs_raw = json.loads(raw) if isinstance(raw, str) else raw

    clubs = []
    for c in clubs_raw:
        if (c.get("president") or "").strip():
            stats["president_values_dropped"] += 1
        links = []
        for u in ([c.get("website")] if c.get("website") else []) + list(c.get("websites") or []):
            if PERSONAL_PAT.search(u):
                stats["personal_links_dropped"] += 1
                continue
            cu = clean_url(u)
            if cu and cu not in [l["url"] for l in links]:
                links.append({"type": link_type(cu), "url": cu})
        clubs.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "aliases": aliases(c.get("name") or ""),
            "category": nz(c.get("category")),
            "one_line_intro": nz(clean(c.get("desc"))),
            "description": nz(clean(c.get("intro"))),
            "activities": [clean(a) for a in c.get("activities") or [] if a.strip()] or None,
            "targets": [clean(a) for a in c.get("targets") or [] if a.strip()] or None,
            "room": nz(c.get("room")),
            "recruiting": nz(clean(c.get("recruitPeriod"))),
            "meeting_schedule": nz(clean(c.get("meetingSchedule"))),
            "links": links or None,
            "detail_url": f"{LIST_URL}/{c.get('id')}",
        })

    unknown = [n for n in EXTRA_ALIASES if n not in {c["name"] for c in clubs}]
    if unknown:
        print("EXTRA_ALIASES names not in the new list (check spelling):", unknown)

    out = {
        "source": LIST_URL,
        "data_endpoint": DATA_URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(clubs),
        "clubs": clubs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(clubs)} clubs)")
    print("by category:", dict(Counter(c["category"] for c in clubs)))
    print("missing:", {k: sum(1 for c in clubs if c[k] is None)
                       for k in clubs[0] if k not in ("id", "name", "detail_url")})
    print("stats:", dict(stats))


if __name__ == "__main__":
    main()
