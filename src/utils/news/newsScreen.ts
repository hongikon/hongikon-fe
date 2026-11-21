import { type CompositeNavigationProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../navigation/RootNavigator'
import type { NewsStackParamList } from '../../navigation/NewsStackNavigator'

// 소식 탭 스택(학과 소식) 안에 있으면서 루트 스택(상세·검색)으로도 이동한다.
export type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<NewsStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>
