"""인권센터 홈페이지(help.hongik.ac.kr). 주요업무·신고안내·사이버신고·관련정보.
센터안내(0101·010102)는 부서 정보를 스크립트(/_custom, robots 금지)로 불러와 받지 않는다(같은 내용은 학교 홈페이지 부속기관 안내).
예방교육 시청(050101 …)은 로그인 페이지, 예방교육 FAQ(0402)는 글이 없다. 자료실(0403)은 바깥 지원기관 소개 글 3개 중
본문에 안내가 적힌 디지털성범죄피해자지원센터 글만 옮긴다(나머지 둘은 첨부 리플렛만).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import drop_sejong, site_postprocess  # noqa: E402

LABEL = '인권센터 홈페이지'
B = 'https://help.hongik.ac.kr/help'
PAGES = {
    'rights_duty': f'{B}/0102.do',           # 주요업무
    'rights_report': f'{B}/0201.do',         # 신고안내(이용시간·신청방법·신고절차)
    'rights_cyber': f'{B}/0202.do',          # 사이버신고센터(이메일)
    'rights_info': f'{B}/0301.do',           # 인권·인권침해·직장 내 괴롭힘
    'rights_sexual': f'{B}/board/dept-isu.do',  # 성희롱·성폭력이란
    'rights_response': f'{B}/board/0303.do',    # 성폭력의 대응
    'rights_myths': f'{B}/0304.do',             # 통념 점검하기(성폭력에 대한 잘못된 생각)
    'rights_digital': f'{B}/0403.do?mode=view&articleNo=125301',  # 자료실: 디지털성범죄피해자지원센터 안내(상시)
}
CONTENT = {'id': 'cms-content'}

postprocess = site_postprocess(PAGES, fix=lambda key, page: drop_sejong(page))
