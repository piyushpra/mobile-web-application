import React from 'react';
import { Text, View } from 'react-native';

import styles from '../../styles';

type Props = {
  discountPct: number;
  isDarkMode: boolean;
};

function ProductDiscountStrip({ discountPct, isDarkMode }: Props) {
  if (!(discountPct > 0)) {
    return null;
  }

  return (
    <View style={[styles.cardDiscountStrip, isDarkMode ? styles.cardDiscountStripDark : styles.cardDiscountStripLight]}>
      <Text style={[styles.cardDiscountStripText, isDarkMode ? styles.cardDiscountStripTextDark : styles.cardDiscountStripTextLight]}>
        {discountPct}% OFF
      </Text>
    </View>
  );
}

export default ProductDiscountStrip;
