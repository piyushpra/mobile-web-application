import React from 'react';
import { Pressable, Text, View } from 'react-native';

import styles from '../../styles';
import type { PublicView, Theme } from '../../types';

type Props = {
  theme: Theme;
  publicView: PublicView;
  setPublicView: (view: PublicView) => void;
  continueCheckout: () => void;
  cartItemCount: number;
  isCheckoutSheetVisible: boolean;
};

function PublicFooter({ theme, publicView, setPublicView, continueCheckout, cartItemCount, isCheckoutSheetVisible }: Props) {
  return (
    <View style={[styles.landingFooter, { backgroundColor: theme.panel }]}> 
      <Pressable style={styles.footerItem} onPress={() => setPublicView('landing')}>
        <Text style={[styles.footerIcon, { color: theme.text }]}>⌂</Text>
        <Text style={[styles.small, { color: publicView === 'landing' ? theme.text : theme.subtext }]}>Home</Text>
      </Pressable>
      <Pressable style={styles.footerItem} onPress={() => setPublicView('categories')}>
        <Text style={[styles.footerIcon, { color: theme.text }]}>▦</Text>
        <Text style={[styles.small, { color: publicView === 'categories' ? theme.text : theme.subtext }]}>Categories</Text>
      </Pressable>
      <Pressable style={[styles.footerCenter, { backgroundColor: theme.accent }]} onPress={() => setPublicView('list')}>
        <Text style={[styles.footerCenterText, { color: '#052E16' }]}>+</Text>
      </Pressable>
      <Pressable style={styles.footerItem} onPress={() => setPublicView('landing')}>
        <Text style={[styles.footerIcon, { color: theme.text }]}>🏷</Text>
        <Text style={[styles.small, { color: theme.subtext }]}>Offers</Text>
      </Pressable>
      <Pressable style={styles.footerItem} onPress={continueCheckout}>
        <View style={styles.footerCartWrap}>
          <Text style={[styles.footerIcon, { color: theme.text }]}>🛒</Text>
          {cartItemCount > 0 ? (
            <View style={styles.footerCartBadge}>
              <Text style={styles.footerCartBadgeText}>{cartItemCount > 99 ? '99+' : String(cartItemCount)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.small, { color: isCheckoutSheetVisible ? theme.text : theme.subtext }]}>Cart</Text>
      </Pressable>
    </View>
  );
}

export default PublicFooter;
