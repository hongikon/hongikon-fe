import type { Dispatch, SetStateAction } from 'react'
import SubscriptionManagerModal from '../SubscriptionManagerModal'
import BoardAlertsModal from '../BoardAlertsModal'
import NoticeListModal from '../NoticeListModal'
import PartnerSourcesModal from '../PartnerSourcesModal'
import TermsModal from '../TermsModal'
import LicensesModal from '../LicensesModal'
import SupportModal from '../SupportModal'
import WithdrawConfirmDialog from '../WithdrawConfirmDialog'
import PrivacyModal from '../PrivacyModal'
import FeedbackModal from '../FeedbackModal'
import OfficialRequestModal from '../OfficialRequestModal'
import InfoSuggestModal from '../InfoSuggestModal'
import AppPermissionsModal from '../AppPermissionsModal'
import KeywordAlertsModal from '../KeywordAlertsModal'
import NicknameModal from '../NicknameModal'
import HiddenUsersModal from '../HiddenUsersModal'
import MyReportsModal from '../MyReportsModal'
import type { MyProfile } from '../../../apis/users'
import type { useAppNotices } from '../../../lib/appNotices'
import { requestMapIntent } from '../../../lib/mapIntents'
import type { SettingsModalType } from '../../../hooks/settings/types'

interface Props {
  activeModal: SettingsModalType
  setActiveModal: Dispatch<SetStateAction<SettingsModalType>>
  appNotices: ReturnType<typeof useAppNotices>
  isGuest: boolean
  /** 반려 알림으로 들어왔을 때 내역에서 강조할 제보 */
  highlightReportId: number | null
  /** 내 제보를 고치거나 지운 뒤 개수(승인 대기 배지)를 다시 부른다. */
  onMyReportsChanged: () => void
  /** 설정은 하단 탭 안의 화면이라 탭 이름(Map)으로 이동하면 부모 탭 내비게이터가 처리한다. */
  navigateToMap: () => void
  memberNumber: string | null
  profile: MyProfile | undefined
  onProfileSaved: (profile: MyProfile) => void
  withdrawVisible: boolean
  setWithdrawVisible: Dispatch<SetStateAction<boolean>>
  onWithdraw: () => Promise<void>
  boardAlertsVisible: boolean
  setBoardAlertsVisible: Dispatch<SetStateAction<boolean>>
  subManagerVisible: boolean
  setSubManagerVisible: Dispatch<SetStateAction<boolean>>
  subscribedDepts: string[]
  onToggleDept: (id: string) => void
}

/** 설정 화면에서 띄우는 창 모음. 한 번에 하나만 뜨는 창은 activeModal 로, 게시판 알림·구독 관리·탈퇴 확인은 따로 연다. */
export default function SettingsModals({
  activeModal,
  setActiveModal,
  appNotices,
  isGuest,
  highlightReportId,
  onMyReportsChanged,
  navigateToMap,
  memberNumber,
  profile,
  onProfileSaved,
  withdrawVisible,
  setWithdrawVisible,
  onWithdraw,
  boardAlertsVisible,
  setBoardAlertsVisible,
  subManagerVisible,
  setSubManagerVisible,
  subscribedDepts,
  onToggleDept,
}: Props) {
  const goToMap = (afterClose: () => void) => {
    setActiveModal(null)
    afterClose()
    navigateToMap()
  }

  return (
    <>
      <NoticeListModal
        visible={activeModal === 'notices'}
        notices={appNotices}
        onClose={() => setActiveModal(null)}
      />

      <PartnerSourcesModal
        visible={activeModal === 'sources'}
        onClose={() => setActiveModal(null)}
      />

      <TermsModal visible={activeModal === 'terms'} onClose={() => setActiveModal(null)} />
      <LicensesModal visible={activeModal === 'licenses'} onClose={() => setActiveModal(null)} />

      <PrivacyModal visible={activeModal === 'privacy'} onClose={() => setActiveModal(null)} />

      <HiddenUsersModal visible={activeModal === 'hiddenUsers'} onClose={() => setActiveModal(null)} />

      {!isGuest && (
        <MyReportsModal
          visible={activeModal === 'myReports'}
          onClose={() => setActiveModal(null)}
          highlightReportId={highlightReportId}
          onChanged={onMyReportsChanged}
          onShowOnMap={(reportId) => goToMap(() => requestMapIntent({ type: 'focusReport', reportId }))}
          onStartReport={() => goToMap(() => requestMapIntent({ type: 'startReport' }))}
        />
      )}

      <InfoSuggestModal
        visible={activeModal === 'infoSuggest'}
        onClose={() => setActiveModal(null)}
        // 창을 닫고 지도 탭으로 옮겨 핀을 고르게 한다. 지도 화면이 요청을 받아 같은 제보 창을 다시 연다.
        onPickOnMap={() => goToMap(() => requestMapIntent({ type: 'pickPartnerLocation' }))}
      />

      <FeedbackModal visible={activeModal === 'feedback'} onClose={() => setActiveModal(null)} />
      <OfficialRequestModal
        visible={activeModal === 'official'}
        onClose={() => setActiveModal(null)}
        memberNumber={memberNumber}
        currentName={profile?.displayName ?? null}
      />
      {/* 고객 지원 › 앱에서 문의 보내기는 이 창을 닫고 문의하기 창을 연다(공지 목록 › 상세와 같은 방식). */}
      <SupportModal
        visible={activeModal === 'support'}
        onClose={() => setActiveModal(null)}
        onOpenFeedback={() => setActiveModal('feedback')}
        isMember={!isGuest}
        onWithdraw={onWithdraw}
      />
      <WithdrawConfirmDialog
        visible={withdrawVisible && activeModal !== 'support'}
        onCancel={() => setWithdrawVisible(false)}
        onConfirm={onWithdraw}
      />

      <AppPermissionsModal visible={activeModal === 'permissions'} onClose={() => setActiveModal(null)} />

      <KeywordAlertsModal visible={activeModal === 'keywords'} onClose={() => setActiveModal(null)} />

      {profile && (
        <NicknameModal
          visible={activeModal === 'nickname'}
          profile={profile}
          onClose={() => setActiveModal(null)}
          onSaved={onProfileSaved}
          onRequestOfficial={() => {
            // 네이티브 Modal 은 앞 창이 닫히는 중에 다음 창을 띄우면(iOS) 무시될 수 있어 닫힌 뒤에 연다.
            setActiveModal(null)
            setTimeout(() => setActiveModal('official'), 400)
          }}
        />
      )}

      <BoardAlertsModal
        visible={boardAlertsVisible}
        onClose={() => setBoardAlertsVisible(false)}
        onOpenSubscriptions={() => {
          // 네이티브 Modal 은 앞 창이 닫히는 중에 다음 창을 띄우면(iOS) 무시될 수 있어 닫힌 뒤에 연다.
          setBoardAlertsVisible(false)
          setTimeout(() => setSubManagerVisible(true), 400)
        }}
      />

      <SubscriptionManagerModal
        visible={subManagerVisible}
        onClose={() => setSubManagerVisible(false)}
        subscribedDepts={subscribedDepts}
        onToggleDept={onToggleDept}
      />
    </>
  )
}
