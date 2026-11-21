import { useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/common/Toast'
import * as haptics from '../../../lib/haptics'
import { communityErrorMessage, isCommunityApiMissing, setReportFire, setReportFollow } from '../../../apis/community'
import { promptLogin } from '../../../utils/map/report/reports'
import { shareReport } from '../../../utils/map/report/shareReport'
import { useMapData } from '../../../lib/mapData'
import { useMutation } from '../../query/useMutation'
import { createLatestGate } from '../../../utils/query/latestGate'
import type { ReportActionRowProps } from '../../../components/map/report/ReportActionRow'

/** ReportActionRow 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportActionRow({ report, onPatch }: Pick<ReportActionRowProps, 'report' | 'onPatch'>) {
  // 장소 문구(가까운 건물)는 지도 데이터의 건물로 찾는다. 아직 없으면 좌표 대신 학교 이름이 나온다.
  const { buildings } = useMapData()
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<'fire' | 'follow' | null>(null)
  const [missing, setMissing] = useState(false)

  const hasFire = typeof report.fireCount === 'number' && !missing
  const hasFollow = typeof report.followedByMe === 'boolean' && !report.isMine && !missing
  const hasViews = typeof report.viewCount === 'number'
  const fired = !!report.firedByMe
  const followed = !!report.followedByMe

  // 연타 중 늦게 온 응답이 최신 상태를 덮지 않게 마지막 요청만 반영한다.
  const fireGate = useRef(createLatestGate()).current
  /** 공감. 낙관적으로 먼저 바꾸고, 실패하면 되돌린다. */
  const fireMutation = useMutation(
    ({ reportId, next, token }: { reportId: number; next: boolean; token: string }) => setReportFire(reportId, next, token),
    {
      onMutate: ({ next }) => {
        const before = { firedByMe: fired, fireCount: report.fireCount ?? 0 }
        onPatch({ firedByMe: next, fireCount: Math.max(0, before.fireCount + (next ? 1 : -1)) })
        const seq = fireGate.begin()
        setBusy('fire')
        return { before, seq }
      },
      onSuccess: (result, _vars, snapshot) => {
        if (!snapshot || !fireGate.isCurrent(snapshot.seq)) return
        onPatch({
          firedByMe: result.fired,
          fireCount: result.fireCount,
          ...(typeof result.recentFireCount === 'number' ? { recentFireCount: result.recentFireCount } : {}),
          ...(typeof result.hot === 'boolean' ? { hot: result.hot } : {}),
        })
      },
      onError: (error, _vars, snapshot) => {
        if (!snapshot || !fireGate.isCurrent(snapshot.seq)) return
        onPatch(snapshot.before)
        if (isCommunityApiMissing(error, true)) {
          setMissing(true)
          return
        }
        toast.show({ message: communityErrorMessage(error, '공감하지 못했어요. 잠시 뒤 다시 해 주세요.'), tone: 'warning' })
      },
      onSettled: (_vars, snapshot) => {
        if (snapshot && fireGate.isCurrent(snapshot.seq)) setBusy(null)
      },
    },
  )

  const handleFire = () => {
    if (report.isMine) {
      toast.show({ message: '내 제보에는 공감할 수 없어요', tone: 'info' })
      return
    }
    if (!accessToken) {
      promptLogin('공감하려면 로그인해 주세요.', logout)
      return
    }
    const next = !fired
    if (next) haptics.switchOn()
    else haptics.tapLight()
    void fireMutation.mutate({ reportId: report.id, next, token: accessToken })
  }

  /** 관심 제보. 낙관적으로 먼저 바꾸고, 실패하면 되돌린다. */
  const followMutation = useMutation(
    ({ reportId, next, token }: { reportId: number; next: boolean; token: string }) => setReportFollow(reportId, next, token),
    {
      onMutate: ({ next }) => {
        onPatch({ followedByMe: next })
        setBusy('follow')
      },
      onSuccess: (result) => {
        onPatch({ followedByMe: result.followed })
        toast.show({
          message: result.followed
            ? '관심 제보로 등록했어요. 시작할 때, 끝나기 30분 전, 새 댓글이 달리면 알려 드려요'
            : '관심 제보에서 뺐어요',
        })
      },
      onError: (error, { next }) => {
        onPatch({ followedByMe: !next })
        if (isCommunityApiMissing(error, true)) {
          setMissing(true)
          return
        }
        toast.show({ message: communityErrorMessage(error, '관심 제보를 바꾸지 못했어요.'), tone: 'warning' })
      },
      onSettled: () => setBusy(null),
    },
  )

  const handleFollow = () => {
    if (!accessToken) {
      promptLogin('관심 제보로 등록하려면 로그인해 주세요.', logout)
      return
    }
    const next = !followed
    if (next) haptics.switchOn()
    else haptics.tapLight()
    void followMutation.mutate({ reportId: report.id, next, token: accessToken })
  }

  const handleShare = async () => {
    haptics.tapLight()
    const result = await shareReport(report, buildings)
    if (result === 'copied') toast.show({ message: '링크를 복사했어요' })
    else if (result === 'failed') toast.show({ message: '공유하지 못했어요', tone: 'warning' })
  }

  const fireCount = report.fireCount ?? 0
  return {
    busy,
    hasFire,
    hasFollow,
    hasViews,
    fired,
    followed,
    handleFire,
    handleFollow,
    handleShare,
    fireCount,
  }
}
