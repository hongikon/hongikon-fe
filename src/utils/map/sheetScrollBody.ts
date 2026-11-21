/** 이만큼 세로로 끌어야 시트 끌기로 넘긴다(가로 사진 넘기기·탭과 헷갈리지 않게). */
export const HANDOFF_SLOP_PX = 8

/** 누른 뒤 이만큼 넘게 움직였으면 스크롤로 보고, 손을 뗄 때 줄 누르기로 치지 않는다. */
export const PRESS_SLOP_PX = 8

/** 스크롤이 멈춘 직후 이 시간(ms) 안의 누르기는 스크롤을 멈추려던 손동작으로 본다. */
export const SCROLL_SETTLE_MS = 120
