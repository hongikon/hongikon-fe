import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'

/** 지도 위 안내 줄들이 같이 쓰는 반투명 흰 알약 모양. */
export const noticeStyles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: RADIUS.floating,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  text: { fontSize: 12, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  pressed: { opacity: 0.6 },
  /** 줄 끝 밑줄 글자 버튼('다시 시도', '보기'). */
  action: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.bold, textDecorationLine: 'underline' },
  /** 카드 안 글 묶음(아이콘과 닫기 사이). */
  textWrap: { flex: 1 },
})
