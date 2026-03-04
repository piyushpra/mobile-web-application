import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import styles from '../styles';
import type { Theme } from '../types';

type PickerProps = {
  label: string;
  selectedId: string;
  options: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
  theme: Theme;
  selectedStyle?: 'filled' | 'outlined';
};

function Picker({
  label,
  selectedId,
  options,
  onSelect,
  theme,
  selectedStyle = 'outlined',
}: PickerProps) {
  if (options.length === 0) {
    return <Text style={[styles.small, { color: theme.warning }]}>{label}: no records found</Text>;
  }

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
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              style={[
                styles.chip,
                styles.navSliderChip,
                selectedStyle === 'outlined'
                  ? selected
                    ? styles.pickerChipSelectedOutlined
                    : styles.pickerChipUnselectedOutlined
                  : { backgroundColor: selected ? theme.primary : theme.steel },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected
                    ? selectedStyle === 'outlined'
                      ? styles.pickerChipTextSelectedOutlined
                      : { color: '#0B1220' }
                    : { color: theme.subtext },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(Picker);
