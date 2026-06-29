import type { Building } from '../types'

export const BUILDINGS: Building[] = [
  { name: '체육관', lat: 37.55152, lng: 126.92278, cx: 36, cy: 46, color: '#0EA5E9', category: '편의', type: '체육·스포츠 시설', floors: 3, hours: '월~금 07:00-22:00\n토·일 09:00-17:00', anchorX: 75, anchorY: 95 },
  { name: '조형관', lat: 37.55138, lng: 126.92368, cx: 115, cy: 46, color: '#F59E0B', category: '식당', type: '예술·디자인 강의동', floors: 5, hours: '월~금 08:00-21:00\n토 08:00-17:00', anchorX: 153, anchorY: 95 },
  { name: '문헌관', lat: 37.55142, lng: 126.92458, cx: 192, cy: 46, color: '#10B981', category: '강의', type: '중앙 도서관', floors: 6, hours: '월~금 08:00-23:00\n토·일 09:00-21:00', anchorX: 232, anchorY: 95 },
  { name: '과학관', lat: 37.55092, lng: 126.92275, cx: 36, cy: 146, color: '#8B5CF6', category: '강의', type: '자연과학 강의동', floors: 4, hours: '월~금 08:00-22:00', anchorX: 75, anchorY: 195 },
  { name: '정보통신관', lat: 37.55095, lng: 126.92478, cx: 192, cy: 146, color: '#3B82F6', category: '강의', type: '공학·IT 강의동', floors: 7, hours: '월~금 08:00-22:00\n토 09:00-18:00', anchorX: 232, anchorY: 195 },
  { name: '학생회관', lat: 37.55042, lng: 126.92372, cx: 115, cy: 253, color: '#F59E0B', category: '식당', type: '학생 편의시설·식당', floors: 4, hours: '월~금 07:30-21:00\n토 08:00-16:00', anchorX: 153, anchorY: 310 },
  { name: '제2공학관(서)', lat: 37.55038, lng: 126.92285, cx: 36, cy: 253, color: '#6366F1', category: '강의', type: '공학 강의동 서측', floors: 8, hours: '월~금 08:00-22:00', anchorX: 75, anchorY: 310 },
  { name: '제2공학관(동)', lat: 37.55035, lng: 126.92482, cx: 275, cy: 253, color: '#6366F1', category: '강의', type: '공학 강의동 동측', floors: 8, hours: '월~금 08:00-22:00', anchorX: 232, anchorY: 310 },
  { name: '홍문관', lat: 37.54985, lng: 126.92368, cx: 36, cy: 346, color: '#64748B', category: '강의', type: '강의·행정 복합동', floors: 5, hours: '월~금 08:00-21:00', anchorX: 75, anchorY: 380 },
]
