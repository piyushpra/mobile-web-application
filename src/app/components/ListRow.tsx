import React from 'react';
import { Text, View } from 'react-native';

import styles from '../styles';
import type { Theme } from '../types';

type ListRowProps = {
  left: string;
  sub: string;
  right: string;
  rightColor: string;
  theme: Theme;
};

function ListRow({ left, sub, right, rightColor, theme }: ListRowProps) {
  return (
    <View style={[styles.rowCard, { backgroundColor: theme.panelSoft }]}> 
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemText, { color: theme.text }]}>{left}</Text>
        <Text style={[styles.small, { color: theme.subtext }]}>{sub}</Text>
      </View>
      <Text style={[styles.itemText, { color: rightColor }]}>{right}</Text>
    </View>
  );
}

export default React.memo(ListRow);
