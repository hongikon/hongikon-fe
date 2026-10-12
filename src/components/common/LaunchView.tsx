import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import LogotypeVertical from '../../../assets/brand/logotype-vertical.svg'

/**
 * 네이티브 스플래시(`app.json` expo-splash-screen: splash-icon.png 를 imageWidth 220 으로 가운데)와 같은 자리·크기의 세로형 로고.
 * splash-icon.png 는 로고를 캔버스의 80% 너비로 그려(`scripts/generate-app-icons.mjs` 의 side = 1.25배) 실제 로고 너비는 220 × 0.8 = 176.
 * 그래서 스플래시가 내려가고 이 화면이 그려져도 로고가 움직이지 않는다.
 */
const LOGO_WIDTH = 176
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 188) / 311)
const BAR_WIDTH = 168
const SEGMENT_WIDTH = 56

interface Props {
  /** 0~1 진행값. 넘기지 않으면 끝을 모르는 진행 막대(짧은 조각이 오가는 모양)를 보여 준다. */
  progress?: Animated.Value
  caption?: string
}

/** 앱을 켤 때·로그인 상태를 읽는 동안 보이는 화면. 가운데 로고, 아래에 안내 한 줄과 진행 막대. */
export default function LaunchView({ progress, caption = '캠퍼스 정보를 불러오는 중' }: Props) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const sweep = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (progress || reduceMotion) return
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress, reduceMotion, sweep])

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={caption}>
      <LogotypeVertical width={LOGO_WIDTH} height={LOGO_HEIGHT} />
      <View style={[styles.bottom, { bottom: insets.bottom + 56 }]}>
        <Text style={styles.caption}>{caption}</Text>
        <View style={styles.track}>
          {progress ? (
            <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]} />
          ) : (
            <Animated.View
              style={[
                styles.segment,
                reduceMotion
                  ? { left: (BAR_WIDTH - SEGMENT_WIDTH) / 2 }
                  : {
                      transform: [
                        { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-SEGMENT_WIDTH, BAR_WIDTH] }) },
                      ],
                    },
              ]}
            />
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 12 },
  caption: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  track: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primarySoft,
    overflow: 'hidden',
  },
  fill: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    transformOrigin: 'left',
  },
  segment: {
    position: 'absolute',
    top: 0,
    width: SEGMENT_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
})
