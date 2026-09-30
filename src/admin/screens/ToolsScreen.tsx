import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ApiError, getErrorMessage } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { backfillNewsLocation, isGatewayTimeout, triggerCrawler } from '../api'
import { formatNumber } from '../format'
import { ADMIN_COLORS, Button, Card, ConfirmBar, InlineError, ScreenHeader } from '../ui'

/**
 * 서버 작업을 손으로 돌리는 곳. 둘 다 오래 걸리고 멱등이 아니라서
 * 확인 단계를 거치고, 도는 동안에는 다시 누를 수 없게 한다(자동 재시도도 없다).
 */
export default function ToolsScreen({ onChanged }: { onChanged: () => void }) {
  return (
    <View>
      <ScreenHeader title="운영 도구" subtitle="서버 작업을 즉시 실행합니다. 끝날 때까지 이 화면을 닫지 마세요." />
      <View style={styles.list}>
        <ToolCard
          title="소식 크롤링 지금 실행"
          description="정기 크롤링을 기다리지 않고 학과·학교 공지를 바로 가져옵니다. 1~2분 걸릴 수 있습니다."
          confirmMessage="크롤링을 지금 실행할까요? 이미 도는 중이면 거절됩니다."
          actionLabel="크롤링 실행"
          run={async () => {
            const { savedCount } = await triggerCrawler()
            return `완료 — 새 소식 ${formatNumber(savedCount)}건을 저장했습니다.`
          }}
          errorMessage={(error) =>
            error instanceof ApiError && error.status === 409
              ? '이미 크롤링 중입니다. 끝난 뒤 대시보드에서 결과를 확인하세요.'
              : null
          }
          onFinished={onChanged}
        />
        <ToolCard
          title="소식 학과·건물 다시 매칭"
          description="학과·건물이 비어 있는 기존 소식을 출처 주소와 본문으로 다시 매칭해 채웁니다. 이미 채워진 값은 건드리지 않습니다. 데이터가 많으면 오래 걸립니다."
          confirmMessage="학과·건물이 비어 있는 소식 전체를 다시 매칭할까요?"
          actionLabel="매칭 실행"
          run={async () => {
            const { updatedCount } = await backfillNewsLocation()
            return `완료 — 소식 ${formatNumber(updatedCount)}건을 갱신했습니다.`
          }}
          onFinished={onChanged}
        />
      </View>
    </View>
  )
}

function ToolCard({
  title,
  description,
  confirmMessage,
  actionLabel,
  run,
  errorMessage,
  onFinished,
}: {
  title: string
  description: string
  confirmMessage: string
  actionLabel: string
  /** 성공 시 보여줄 문구를 돌려준다. */
  run: () => Promise<string>
  /** 작업별로 따로 풀어 쓸 오류 문구. null 이면 공통 처리. */
  errorMessage?: (error: unknown) => string | null
  onFinished: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  const execute = () => {
    setConfirming(false)
    setRunning(true)
    setElapsed(0)
    setResult(null)
    setError(null)
    startedAt.current = Date.now()
    run()
      .then(setResult)
      .catch((err: unknown) => {
        const custom = errorMessage?.(err)
        if (custom) setError(custom)
        else if (isGatewayTimeout(err)) {
          // 응답만 못 받았을 뿐 서버에서는 계속 돌고 있을 수 있다. 다시 누르기 전에 상태부터 본다.
          setError('응답을 기다리다 연결이 끊겼습니다. 서버에서는 작업이 계속 진행 중일 수 있으니 잠시 뒤 대시보드에서 결과를 확인하세요.')
        } else setError(getErrorMessage(err, '작업을 실행하지 못했습니다.'))
      })
      .finally(() => {
        setRunning(false)
        onFinished()
      })
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {confirming ? (
        <ConfirmBar message={confirmMessage} confirmLabel={actionLabel} onConfirm={execute} onCancel={() => setConfirming(false)} />
      ) : (
        <View style={styles.actions}>
          {running ? <Text style={styles.elapsed}>실행 중… {elapsed}초</Text> : null}
          <Button label={actionLabel} icon="play" variant="primary" onPress={() => setConfirming(true)} loading={running} small />
        </View>
      )}
      {result ? <Text style={styles.result}>{result}</Text> : null}
      {error ? <InlineError message={error} /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { gap: 10 },
  title: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  description: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  elapsed: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  result: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: ADMIN_COLORS.success,
    backgroundColor: ADMIN_COLORS.successBg,
    padding: 10,
    borderRadius: 8,
  },
})
