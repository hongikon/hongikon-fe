/** 이 시간 안에 지도가 준비되지 않으면 다시 불러온다. 보통 3~5초 안에 뜬다. */
export const READY_TIMEOUT_MS = 12_000

/** 자동으로 다시 불러오는 횟수. 넘으면 "다시 시도" 버튼을 띄우고 멈춘다(무한 재시도로 배터리·데이터를 쓰지 않게). */
export const MAX_AUTO_RELOADS = 2

/**
 * WebView 프로세스가 죽어 다시 불러오는 횟수 상한(아래 시간 창 안에서). 준비 신호가 오면 위 자동 재시도
 * 횟수는 0 으로 돌아가서, 크래시는 따로 시간 기준으로 센다 — 안 그러면 "뜨자마자 죽음"이 끝없이 반복된다.
 */
export const MAX_CRASH_RELOADS = 3

export const CRASH_WINDOW_MS = 60_000

export const READY_MESSAGE = '__hongikonMapReady'

export const ALIVE_MESSAGE = '__hongikonMapAlive'

/** 앱이 앞으로 돌아온 뒤 지도 페이지가 이 시간 안에 대답하지 않으면 죽은 것으로 보고 다시 불러온다. */
export const ALIVE_TIMEOUT_MS = 2_500

/**
 * 앱이 앞으로 돌아왔을 때 지도가 아직 그려져 있는지 묻는 스크립트. WebView 프로세스가 죽었으면 실행되지 않아 대답이 없고,
 * 페이지는 살아 있는데 지도 칸이 비었으면(크기 0, 받아 둔 타일 그림 0장) ok: false 로 대답한다.
 */
export const ALIVE_PROBE_JS = `
(function () {
  try {
    var ok = false;
    var el = window.map && window.map.getElement && window.map.getElement();
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
      var imgs = el.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete && imgs[i].naturalWidth >= 64) { ok = true; break; }
      }
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${ALIVE_MESSAGE}', ok: ok }));
  } catch (e) {}
})();
true;
`
