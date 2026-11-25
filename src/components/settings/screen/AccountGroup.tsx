import { View } from 'react-native'
import ListRow from '../../common/ListRow'
import type { LoginProvider } from '../../../utils/auth/authContext'
import { loginProviderLabel, loginProviderName, pendingBadge } from '../../../utils/settings/account'
import GroupHeader from './GroupHeader'
import { settingsStyles as s } from './styles'

interface Props {
  loginProvider: LoginProvider | null
  expanded: boolean
  onToggle: () => void
  /** 토큰 안의 회원 번호. 토큰이 이상하면 null(회원 번호 줄을 숨긴다). */
  memberId: number | null
  /** 보일 회원 번호(공개 번호 또는 #id). 아직 없으면 null. */
  memberNumber: string | null
  memberCodeLoading: boolean
  /** 계정 정보를 받아 왔고 서버에 내 제보 API 가 있을 때만 '내 제보 내역' 줄을 보인다. */
  showMyReports: boolean
  myReportPending: number
  onOpenMyReports: () => void
  onLogout: () => void
  onDeleteAccount: () => void
}

/** 설정 > 계정 묶음(로그인한 사람에게만). 게스트는 맨 위 프로필 줄이 '로그인하기' 를 맡는다. */
export default function AccountGroup({
  loginProvider,
  expanded,
  onToggle,
  memberId,
  memberNumber,
  memberCodeLoading,
  showMyReports,
  myReportPending,
  onOpenMyReports,
  onLogout,
  onDeleteAccount,
}: Props) {
  return (
    <View style={s.section}>
      <GroupHeader
        icon="person-outline"
        label="계정"
        value={loginProviderName(loginProvider)}
        badge={pendingBadge(myReportPending)}
        expanded={expanded}
        onPress={onToggle}
      />
      {expanded && (
        <View style={s.groupBody}>
          <ListRow icon="person-circle-outline" label={loginProviderLabel(loginProvider)} />
          {/* 닉네임은 첫 화면 맨 위 프로필 줄에서 바꾼다. */}
          {memberId !== null && (
            <ListRow
              icon="id-card-outline"
              label="회원 번호"
              value={memberNumber ?? (memberCodeLoading ? '불러오는 중' : '불러오지 못함')}
              accessibilityLabel={memberNumber ? `회원 번호 ${memberNumber.replace(/^#/, '')}` : '회원 번호'}
            />
          )}
          {/* 공식 계정(학생회 등)의 이름·신청은 닉네임 창 안에 있다(NicknameModal). */}
          {showMyReports && (
            <ListRow
              icon="megaphone-outline"
              label="내 제보 내역"
              badge={pendingBadge(myReportPending)}
              onPress={onOpenMyReports}
              accessibilityLabel={myReportPending > 0 ? `내 제보 내역, 승인 대기 ${myReportPending}건` : '내 제보 내역'}
            />
          )}
          <ListRow icon="log-out-outline" label="로그아웃" danger onPress={onLogout} />
          {/* 누르면 WithdrawConfirmDialog 가 뜬다. */}
          <ListRow icon="person-remove-outline" label="회원 탈퇴" danger last onPress={onDeleteAccount} />
        </View>
      )}
    </View>
  )
}
