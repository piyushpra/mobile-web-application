import React from 'react';
import { Text, View } from 'react-native';

import styles from '../styles';
import type { Theme } from '../types';

type StatProps = {
  label: string;
  value: string;
  theme: Theme;
};

function Stat({ label, value, theme }: StatProps) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.panelSoft }]}> 
      <Text style={[styles.itemText, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.small, { color: theme.subtext }]}>{label}</Text>
    </View>
  );
}

export default React.memo(Stat);
