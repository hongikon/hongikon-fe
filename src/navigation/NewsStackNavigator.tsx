import { createNativeStackNavigator } from '@react-navigation/native-stack'
import NewsScreen from '../screens/NewsScreen'
import DeptNewsScreen from '../screens/DeptNewsScreen'

/**
 * 소식 탭 안의 스택. 학과 소식은 탭 안에서 열어야 하단 탭바가 그대로 남는다
 * (루트 스택에 두면 탭 화면 전체를 덮어 탭바가 사라진다).
 * 소식 상세·검색은 기존처럼 루트 스택에서 전체 화면으로 연다.
 */
export type NewsStackParamList = {
  NewsHome: undefined
  DeptNews: { deptId: string; deptName: string }
}

const Stack = createNativeStackNavigator<NewsStackParamList>()

export default function NewsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NewsHome" component={NewsScreen} />
      <Stack.Screen
        name="DeptNews"
        component={DeptNewsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
