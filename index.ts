// 근처 제휴 알림의 백그라운드 작업 정의. 앱이 꺼진 채 지오펜스 신호로 깨어날 때도 작업이 있어야 해서 가장 먼저 불러온다.
// 근처 알림 빌드·네이티브 모듈이 없으면 아무것도 하지 않는다(src/lib/nearbyPartners/background.ts).
import './src/lib/nearbyPartners/background';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
