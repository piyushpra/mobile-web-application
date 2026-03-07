import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { darkTheme } from '../constants';
import styles from '../styles';
import type { Theme } from '../types';

type PickerProps = {
  label: string;
  selectedId: string;
  options: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
  theme: Theme;
  selectedStyle?: 'filled' | 'outlined';
  allowDeselect?: boolean;
};

function Picker({
  label,
  selectedId,
  options,
  onSelect,
  theme,
  selectedStyle = 'outlined',
  allowDeselect = false,
}: PickerProps) {
  if (options.length === 0) {
    return <Text style={[styles.small, { color: theme.warning }]}>{label}: no records found</Text>;
  }

  const isDarkMode = theme.bg === darkTheme.bg;

  return (
    <View>
      <Text style={[styles.small, styles.pickerLabel, { color: theme.subtext }]}>{label}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navSliderRow}
      >
        {options.map(o => {
          const selected = o.id === selectedId;
          const outlinedChipStyle =
            selectedStyle === 'outlined'
              ? selected
                ? isDarkMode
                  ? { borderWidth: 1, borderColor: theme.primary, backgroundColor: theme.primary }
                  : styles.pickerChipSelectedOutlined
                : isDarkMode
                  ? { borderWidth: 1, borderColor: theme.steel, backgroundColor: theme.steel }
                  : styles.pickerChipUnselectedOutlined
              : { backgroundColor: selected ? theme.primary : theme.steel };
          const chipTextStyle = selected
            ? selectedStyle === 'outlined'
              ? isDarkMode
                ? { color: '#FFFFFF' }
                : styles.pickerChipTextSelectedOutlined
              : { color: '#0B1220' }
            : isDarkMode
              ? { color: theme.text, fontWeight: '700' }
              : { color: theme.subtext };
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(allowDeselect && selected ? '' : o.id)}
              style={[
                styles.chip,
                styles.navSliderChip,
                outlinedChipStyle,
              ]}
            >
              <Text style={[styles.chipText, chipTextStyle]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(Picker);
