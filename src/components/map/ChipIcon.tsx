import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import type { FacilityIconName } from "../../constants/facilityKinds";

interface ChipIconProps {
  name: FacilityIconName;
  color: string;
  active: boolean;
}

/**
 * 시설·업종 아이콘 하나. Ionicons 에 소파가 없어 라운지('sofa')만 MaterialCommunityIcons 로 그린다 —
 * 지도 핀(mapHtml.ts 의 소파 SVG)과 칩·시트·검색 결과의 라운지 아이콘을 같은 모양으로 맞춘다(10-07 요청).
 */
export function KindIcon({ name, size, color }: { name: FacilityIconName; size: number; color: string }) {
  if (name === "sofa") return <MaterialCommunityIcons name="sofa" size={size + 1} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
}

/**
 * 필터 칩 아이콘. 칩 배경 위에 색 아이콘을 바로 얹는다(원형 배지 없이) —
 * 선택됐을 때는 칩 전체가 이미 그 색으로 채워지므로 흰 아이콘으로 뒤집는다.
 */
export default function ChipIcon({ name, color, active }: ChipIconProps) {
  return <KindIcon name={name} size={13} color={active ? COLORS.white : color} />;
}
