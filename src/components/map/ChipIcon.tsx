import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";

interface ChipIconProps {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  active: boolean;
}

/**
 * 필터 칩 아이콘. 칩 배경 위에 색 아이콘을 바로 얹는다(원형 배지 없이) —
 * 선택됐을 때는 칩 전체가 이미 그 색으로 채워지므로 흰 아이콘으로 뒤집는다.
 */
export default function ChipIcon({ name, color, active }: ChipIconProps) {
  return <Ionicons name={name} size={13} color={active ? COLORS.white : color} />;
}
