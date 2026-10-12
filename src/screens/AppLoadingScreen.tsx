import LaunchView from '../components/common/LaunchView'

/**
 * AuthContext가 저장된 로그인 상태(토큰/게스트 여부)를 읽어오는 동안 보여준다(온보딩·학과 고르기 판단 중에도).
 * 이 확인은 기기 저장소 접근이라 순간적이지만, 그 사이 빈 화면이 뜨면 앱이 멈춘 것처럼 보여서
 * 시작 화면(`LaunchOverlay`)과 같은 로고·자리에 끝을 모르는 진행 막대를 보여 준다. 그래서 시작 화면이 걷혀도 화면이 튀지 않는다.
 */
export default function AppLoadingScreen() {
  return <LaunchView caption="불러오는 중" />
}
