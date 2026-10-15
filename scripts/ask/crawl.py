"""학교 홈페이지 안내 페이지를 받아 cache/ 에 HTML 그대로 둔다. 사용: python3 -I scripts/ask/crawl.py
받은 뒤 extract.py 로 data/pages.json·data/faq.json 을 만든다. 대상은 sources.py.
"""
import hashlib, html, json, os, re, sys, time, urllib.parse, urllib.request
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, 'cache')
UA = 'Mozilla/5.0 (compatible; hongikon-ask-crawler; +https://hongikon.com)'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    raw = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    time.sleep(sources.DELAY_SECONDS)
    return raw


def save(sub, name, raw):
    os.makedirs(os.path.join(CACHE, sub), exist_ok=True)
    with open(os.path.join(CACHE, sub, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(raw)


def title_of(raw):
    m = re.search(r'<title>(.*?)</title>', raw, re.S)
    return html.unescape(m.group(1).strip()) if m else ''


def crawl_menu(meta):
    seen, queue = set(), list(sources.SEEDS)
    while queue and len(seen) < sources.MAX_PAGES:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            raw = fetch(url)
        except Exception as e:  # 401(로그인 필요) 같은 페이지는 건너뛴다
            print('ERR', url, e, flush=True)
            continue
        key = sources.key_of(url)
        if key:
            save('html', key, raw)
            meta[key] = {'url': url, 'title': title_of(raw), 'sha': hashlib.sha1(raw.encode()).hexdigest()[:12]}
        for h in re.findall(r'href="([^"#]+)"', raw):
            u = urllib.parse.urljoin(url, html.unescape(h)).split('#')[0]
            if '?' in u or u in seen:
                continue
            if any(a.match(u) for a in sources.ALLOW) and not sources.DENY.search(u):
                queue.append(u)
        print(len(seen), len(queue), url, flush=True)


def crawl_faq(meta):
    for board, pattern in sources.FAQ_BOARDS.items():
        offset, last = 0, None
        while offset < 500:
            raw = fetch(pattern.format(offset=offset))
            # 쪽이 넘어갔는지는 질문 제목으로 본다(articleNo 는 옆 메뉴 링크라 쪽마다 같다).
            ids = re.findall(r'b-m-cate">.*?</span>\s*(.*?)</a>', raw, re.S)
            count = len(ids)
            if count == 0 or ids == last:
                break
            save('faq', f'{board}-{offset:03d}', raw)
            meta[f'faq:{board}-{offset:03d}'] = {'url': pattern.format(offset=offset), 'title': title_of(raw)}
            print('faq', board, offset, count, flush=True)
            last, offset = ids, offset + 10


def crawl_articles(meta):
    for key, url in sources.ARTICLES.items():
        try:
            raw = fetch(url)
        except Exception as e:
            print('ERR', url, e, flush=True)
            continue
        save('html', key, raw)
        meta[key] = {'url': url, 'title': title_of(raw), 'sha': hashlib.sha1(raw.encode()).hexdigest()[:12]}


if __name__ == '__main__':
    meta = {}
    crawl_menu(meta)
    crawl_faq(meta)
    crawl_articles(meta)
    meta['_crawledAt'] = date.today().isoformat()
    with open(os.path.join(CACHE, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('done', len(meta) - 1)
