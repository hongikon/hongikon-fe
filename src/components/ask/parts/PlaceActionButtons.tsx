import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { firstSentence } from "../../../utils/ask/replyText";
import { placeName } from "../../../utils/ask/places";
import { newsSearchQuery } from "../../../utils/ask/askAppCommand";
import { askStyles } from "../askStyles";
import type { AskMessageEnv } from "../messages/types";

/** "지도에서 보기" 버튼(11-07). 누르면 지도 탭으로 옮겨 그 곳에 핀·시트, 위에 summary 카드. */
export function MapButton({
  action,
  env,
}: {
  action: { target: string; label?: string | null; summary?: string | null };
  env: AskMessageEnv;
}) {
  const { onShowOnMap } = env;
  if (!onShowOnMap) return null;
  const name = placeName(action.target, env.places);
  if (!name) return null;
  const title = action.label || name;
  return (
    <TouchableOpacity
      style={askStyles.mapButton}
      activeOpacity={0.7}
      onPress={() => onShowOnMap({ target: action.target, title, summary: action.summary ?? undefined })}
      accessibilityRole="button"
      accessibilityLabel={`${title} 지도에서 보기`}
    >
      <Ionicons name="map-outline" size={15} color={COLORS.white} />
      <Text style={askStyles.mapButtonText} numberOfLines={1}>지도에서 보기 · {title}</Text>
    </TouchableOpacity>
  );
}

/** 답의 지도 버튼 — 서버가 보낸 'map' 조작이 먼저, 없으면(옛 서버·앱 안내) 근거 안내의 위치. */
export function ReplyMapButton({ item, place, env }: { item: ChatMessageOf<"reply">; place: string | null; env: AskMessageEnv }) {
  const action = item.appActions.find((candidate) => candidate.type === "map");
  if (action) return <MapButton action={action} env={env} />;
  return place ? <MapButton action={{ target: `facility:${place}`, summary: firstSentence(item.text) }} env={env} /> : null;
}

/** "여기서 가는 길" 버튼(11-09) — 서버가 'route' 조작을 보냈을 때만(가는 길을 물은 질문). 건물·시설만. */
export function RouteButton({ item, env }: { item: ChatMessageOf<"reply">; env: AskMessageEnv }) {
  const { onRouteTo } = env;
  const action = item.appActions.find((candidate) => candidate.type === "route");
  if (!action || !onRouteTo || !/^(building|facility):./.test(action.target)) return null;
  const name = placeName(action.target, env.places);
  if (!name) return null;
  const title = action.label || name;
  // 출발 건물이 있으면(11-15 '제4공학관에서 홍문관') 그 건물에서, 없으면 내 위치에서.
  const from = action.from && /^building:./.test(action.from) ? action.from : undefined;
  const fromName = from ? placeName(from, env.places) : null;
  return (
    <TouchableOpacity
      style={askStyles.mapButton}
      activeOpacity={0.7}
      onPress={() => onRouteTo(fromName ? { target: action.target, from } : { target: action.target })}
      accessibilityRole="button"
      accessibilityLabel={fromName ? `${fromName}에서 ${title} 가는 길` : `내 위치에서 ${title} 가는 길`}
    >
      <Ionicons name="navigate-outline" size={15} color={COLORS.white} />
      <Text style={askStyles.mapButtonText} numberOfLines={1}>
        {fromName ? `길찾기 · ${fromName} → ${title}` : `여기서 가는 길 · ${title}`}
      </Text>
    </TouchableOpacity>
  );
}

/** '○○ 공지 찾아줘'(11-09)면 답 아래 "소식에서 검색" — 서버 답(공지 링크)에 더해 소식 탭에서 더 찾아볼 수 있게. */
export function NewsSearchButton({ item, env }: { item: ChatMessageOf<"reply">; env: AskMessageEnv }) {
  const { onSearchNews } = env;
  const query = onSearchNews ? newsSearchQuery(item.question) : null;
  if (!query || !onSearchNews) return null;
  return (
    <TouchableOpacity
      style={askStyles.mapButton}
      activeOpacity={0.7}
      onPress={() => onSearchNews(query)}
      accessibilityRole="button"
      accessibilityLabel={`소식에서 ${query} 검색`}
    >
      <Ionicons name="search-outline" size={15} color={COLORS.white} />
      <Text style={askStyles.mapButtonText} numberOfLines={1}>소식에서 검색 · {query}</Text>
    </TouchableOpacity>
  );
}
