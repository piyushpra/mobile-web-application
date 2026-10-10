import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../types';

type StartupProgressOverlayProps = {
  progress: number;
  statusText: string;
  theme: Theme;
  logo: ImageSourcePropType;
  onHidden: () => void;
};

function StartupProgressOverlay({ progress, statusText, theme, logo, onHidden }: StartupProgressOverlayProps) {
  const progressValue = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const isComplete = progress >= 1;

  useEffect(() => {
    const animation = Animated.timing(progressValue, {
      toValue: Math.max(0.08, Math.min(1, progress)),
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (!finished || !isComplete) {
        return;
      }
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 260,
        delay: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onHidden());
    });
    return () => animation.stop();
  }, [progress, isComplete, progressValue, overlayOpacity, onHidden]);

  const barWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents={isComplete ? 'none' : 'auto'}
      style={[overlayStyles.overlay, { backgroundColor: theme.bg, opacity: overlayOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel={statusText}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, progress) * 100) }}
    >
      <Image source={logo} style={overlayStyles.logo} resizeMode="contain" />
      <View style={[overlayStyles.track, { backgroundColor: theme.steel }]}>
        <Animated.View style={[overlayStyles.fill, { backgroundColor: theme.accent, width: barWidth }]} />
      </View>
      <Text style={[overlayStyles.status, { color: theme.subtext }]} numberOfLines={1}>
        {statusText}
      </Text>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  logo: {
    width: 200,
    height: 72,
    marginBottom: 28,
  },
  track: {
    width: '100%',
    maxWidth: 280,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  status: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default React.memo(StartupProgressOverlay);
