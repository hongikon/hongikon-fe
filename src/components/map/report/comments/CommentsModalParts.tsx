import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../../../constants/colors'
import { SkeletonBlock, SkeletonGroup } from '../../../common/Skeleton'

/** 댓글 사이 얇은 선(아바타 폭만큼 들여 쓴다). */
export function Separator() {
  return <View style={styles.separator} />
}

/** 댓글을 처음 받는 동안의 자리 표시. */
export function CommentsSkeleton() {
  return (
    <SkeletonGroup style={styles.skeleton}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonBlock width={32} height={32} radius={16} />
          <View style={styles.skeletonText}>
            <SkeletonBlock width="35%" height={12} />
            <SkeletonBlock width={i % 2 ? '70%' : '90%'} height={14} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  )
}

/**
 * 키보드가 입력줄을 가리지 않게 화면 전체를 감싼다. 예전엔 머리줄 아래 목록 칸만 감싸, iOS 가 자기 위치를 화면 기준이 아니라
 * 부모 기준으로 재는 탓에 위쪽 안전 영역(노치)만큼 덜 올라가 입력줄이 키보드에 반쯤 가렸다. 화면 전체를 감싸면 키보드 높이만큼
 * 올리면 되고, 아래 안전 영역(홈 표시줄) 여백은 키보드 뒤로 들어가므로 그만큼 빼 입력줄이 키보드 바로 위에 붙는다.
 *
 * Android 도 padding(11-26 핫픽스): 예전엔 Android 모달 창이 키보드만큼 줄어든다고 보고 아무것도 안 했는데, edge-to-edge
 * (Expo 기본)에서는 모달 창도 줄지 않아 입력줄이 키보드에 가려졌다(물어보기 11-14 핫픽스와 같은 원인). KeyboardAvoidingView 는
 * 키보드와 실제로 겹친 만큼만 띄우므로 창이 줄어드는 기기에서는 0 이라 두 번 띄우지 않는다. 아래 내비게이션 바 여백도
 * 키보드 뒤로 들어가 iOS 와 같이 뺀다.
 */
export function KeyboardFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView
      style={styles.keyboardFrame}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'web' ? 0 : -insets.bottom}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  keyboardFrame: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginLeft: 42 },
  skeleton: { paddingTop: 12, gap: 20 },
  skeletonRow: { flexDirection: 'row', gap: 10 },
  skeletonText: { flex: 1, gap: 8 },
})
