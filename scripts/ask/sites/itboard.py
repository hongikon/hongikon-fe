"""정보전산원 Email / Google 게시판(it.hongik.ac.kr/it/board/0102.do)의 상시 안내 글. 학교 Gmail 을 쓰는 학생이 묻는 것만 둔다.
메일이 안 오거나 안 보내질 때(134137·134164)는 손으로 쓴 'school-mail' 흐름(학교 메일 FAQ 공지)이 이미 맡아서 여기 두지 않는다.

글 본문은 '첨부파일 참고'뿐이고 실제 순서는 첨부 PDF 에 있다. 첨부는 게시판 ?mode=download 로 받는데(robots.txt 가 막지 않음)
crawl.py 는 PDF 를 글자로 읽지 못하므로, 첨부 PDF 의 글을 그대로 옮긴 ATTACH 를 붙인다.
글이 그 첨부(attachNo)를 더는 걸고 있지 않으면 옮긴 글을 붙이지 않는다(학교가 파일을 바꾼 것).
"""
import re
from sites import _adminkit as kit

LABEL = '정보전산원 홈페이지'
VIEW = 'https://it.hongik.ac.kr/it/board/0102.do?mode=view&articleNo={}'
PAGES = {
    'itboard_mail-backup': VIEW.format(125196),   # 구글 메일 백업 방법 안내
    'itboard_storage': VIEW.format(96797),        # 구글 저장 공간 확보 방법 안내
    'itboard_contacts': VIEW.format(134165),      # 메일 발송 시 수신자 정보 오류(퇴직자·이름 불일치) 해결 방법 안내
    'itboard_chrome': VIEW.format(156281),        # 구글 크롬 브라우저 로그인 방법(2026.09.03)
}
CONTENT = {'class': 'fr-view'}

# 키 → [(attachNo, 첨부 파일 이름, [첨부 PDF 의 글(원문)])]
ATTACH = {
    'itboard_mail-backup': [
        (74330, '구글에서 메일 백업 받는 방법', [
            '① 계정 좌측의 아이콘 클릭',
            '② Google 계정 클릭',
            '③ 데이터 및 맞춤설정 관리 클릭',
            '④ 데이터 다운로드 클릭',
            '⑤ 모두 선택해제 클릭',
            '⑥ 메일의 체크 클릭 (추가정보 안내) [MBOX형식] : 백업파일 확장자명, [라벨 7개 선택됨] : 구글메일 라벨선택 다운로드 가능',
            '⑦ 다음단계 클릭',
            '⑧ 내보내기 유형 : 이메일을 통해 다운로드 링크 전송, 일회성 보관 파일, 파일 형식 : .zip, 보관파일 크기는 기존 메일 용량에 따라 설정 (설정된 크기를 초과하는 보관 파일은 여러개의 파일로 분할됩니다.)',
            '⑨ 보관파일 만들기 클릭',
            '⑩ 백업이 완료되면 구글메일로 해당 파일이 수신됨. 다운로드 진행 -> 다운로드된 압축파일 압축풀기 진행',
            '※ 백업 받은 메일 데이터는 그룹웨어에서 열람이 불가합니다. 따라서 별도의 프로그램을 통해 열람해주셔야 합니다. ex) thunderbird',
        ]),
        (74331, 'MBOX로 백업된 메일 파일 열람 방법 (thunderbird 설치 및 실행)', [
            '※ thunderbird 프로그램을 다운로드 링크 : https://www.thunderbird.net/ko/',
            '① thunderbird 프로그램을 다운로드.',
            '② 실행 화면에서 개인폴더 우클릭 / 설정 클릭',
            '③ 로컬디렉터리에서 찾아보기 클릭 후 백업 받은 파일을 설정',
            '④ 받은편지함, 보관편지함, 보낸편지함이 생성이 되며 백업받은 메일을 확인 가능',
        ]),
    ],
    'itboard_storage': [
        (83158, '구글 저장 공간 확보 방법', [
            '스토리지 사용량 조회하기 : https://drive.google.com/settings/storage 에 접속하여 Drive, Gmail 사용량을 확인 할 수 있습니다.',
            '빠른 정리를 위한 내 PC 로 스토리지 다운받기 : [구글 스토리지 백업하기]파일 참고하여 내 PC 나 다른 저장매체(외장하드 or One Drive 등)에 다운로드 받을 수 있습니다.',
            'Google Drive 용량 순으로 보기 : https://drive.google.com/drive/quota 에 접속하여 Drive 용량 순으로 정렬하여 삭제 할 수 있습니다.',
            '공유 드라이브로 이동하기 : https://drive.google.com/drive/shared-drives 에 접속하여 공유된 드라이브 목록을 확인하고 삭제할 수 있습니다.',
            '대용량 첨부파일 확인 방법 : https://mail.google.com 에 접속하여 상단 모든 대화 검색창에 “has:attachment larger:10M” 을 입력하고 Enter 를 누릅니다. '
            '※ 첨부물의 크기가 10MB 보다 큰 메일을 찾는 방법입니다. 10M 대신 다른 숫자를 넣으면 다른 크기의 파일을 확인할 수 있습니다. 필요하지 않은 이메일을 선택한 다음 삭제를 클릭합니다.',
            '휴지통 비우기 : 삭제가 완료되면 메일함 휴지통과 드라이브 휴지통을 확인하여 반드시 휴지통 비우기를 선택합니다. 휴지통 비우지 않으면 저장용량에 휴지통 용량까지 포함됩니다.',
        ]),
    ],
}


def postprocess(key, page, raw):
    m = re.search(r'<span class="b-title">(.*?)</span>', raw, re.S)
    if m:
        page['title'] = '정보전산원 | ' + re.sub(r'\s+', ' ', m.group(1)).strip()
    secs = kit.notice_sections(kit.box_lines(raw), first_title='안내', drop=('이상입니다',))
    for no, name, lines in ATTACH.get(key, []):
        if f'attachNo={no}' in raw:
            secs.append({'title': f'첨부 · {name}', 'items': lines, 'ordered': False})
    page['sections'] = secs
    return page
