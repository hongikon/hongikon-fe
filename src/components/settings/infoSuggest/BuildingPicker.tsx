import { ScrollView, Text, View } from 'react-native'
import Chip from '../../common/Chip'
import TextField from '../../common/TextField'
import { infoStyles as styles } from './styles'
import { useBuildingPicker } from '../../../hooks/settings/infoSuggest/useBuildingPicker'

/** 건물 고르기. 이름 일부로 거르고 가로로 넘기는 칩에서 고른다. 다시 누르면 고른 걸 푼다. */
export default function BuildingPicker({
  value,
  onChange,
  invalid,
}: {
  value: string | null
  onChange: (name: string | null) => void
  invalid?: boolean
}) {
  const { query, setQuery, data, names } = useBuildingPicker({ value })

  return (
    <View style={styles.pickerBlock}>
      <TextField
        style={[styles.searchField, invalid && styles.fieldInvalid]}
        placeholder="건물 이름 검색 (예: 홍문관, R동)"
        value={query}
        onChangeText={setQuery}
        maxLength={30}
        accessibilityLabel="건물 이름 검색"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.buildingRow}
      >
        {names.length === 0 ? (
          <Text style={styles.emptyText}>{data ? '맞는 건물이 없어요' : '건물 목록을 불러오는 중이에요'}</Text>
        ) : (
          names.map((name) => {
            const active = value === name
            return (
              <Chip
                key={name}
                label={name}
                selected={active}
                role="radio"
                onPress={() => onChange(active ? null : name)}
              />
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
