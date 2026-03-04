import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

import { LANDING_HERO_IMAGE } from '../../constants';
import Picker from '../Picker';
import styles from '../../styles';
import type { FeedbackOrderItem, Theme } from '../../types';

type Props = {
  theme: Theme;
  rating: number;
  setRating: (value: number) => void;
  message: string;
  setMessage: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  feedbackOrderItems: FeedbackOrderItem[];
  selectedFeedbackOrderItemId: string;
  setSelectedFeedbackOrderItemId: (value: string) => void;
  isFeedbackOrderItemsLoading: boolean;
};

const STAR_VALUES = [1, 2, 3, 4, 5];

function PublicFeedbackPage({
  theme,
  rating,
  setRating,
  message,
  setMessage,
  onSubmit,
  onBack,
  feedbackOrderItems,
  selectedFeedbackOrderItemId,
  setSelectedFeedbackOrderItemId,
  isFeedbackOrderItemsLoading,
}: Props) {
  const orderItemOptions = React.useMemo(
    () =>
      feedbackOrderItems.map(item => ({
        id: item.orderItemId,
        label: `${item.productName}${item.capacity ? ` (${item.capacity})` : ''} • ${item.orderNumber}`,
      })),
    [feedbackOrderItems],
  );
  const canSubmit = !isFeedbackOrderItemsLoading && feedbackOrderItems.length > 0 && Boolean(selectedFeedbackOrderItemId);

  return (
    <View style={[styles.card, { backgroundColor: theme.panel }]}>
      <View style={styles.feedbackHeaderRow}>
        <Pressable style={[styles.chip, { backgroundColor: theme.panelSoft }]} onPress={onBack}>
          <Text style={[styles.chipText, { color: theme.text }]}>← Back</Text>
        </Pressable>
      </View>

      <Text style={[styles.feedbackTitle, { color: theme.text }]}>Feedback</Text>

      <View style={styles.feedbackBanner}>
        <Image source={LANDING_HERO_IMAGE} style={styles.feedbackBannerImage} resizeMode="cover" />
        <View style={styles.feedbackBannerOverlay} />
        <View style={styles.feedbackBannerContent}>
          <Text style={styles.feedbackBannerHeading}>We&apos;d love to hear your thoughts!</Text>
          <View style={styles.feedbackStarsRow}>
            {STAR_VALUES.map(star => (
              <Pressable key={star} style={styles.feedbackStarBtn} onPress={() => setRating(star)}>
                <Text style={[styles.feedbackStar, star <= rating ? styles.feedbackStarActive : styles.feedbackStarInactive]}>
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={[styles.feedbackPrompt, { color: theme.text }]}>Select the order item for this feedback.</Text>
      {isFeedbackOrderItemsLoading ? (
        <View style={{ paddingVertical: 10 }}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : feedbackOrderItems.length === 0 ? (
        <Text style={[styles.small, { color: theme.warning }]}>No order items found. Please place an order first.</Text>
      ) : (
        <Picker
          label="Order Item"
          selectedId={selectedFeedbackOrderItemId}
          options={orderItemOptions}
          onSelect={setSelectedFeedbackOrderItemId}
          theme={theme}
        />
      )}

      <Text style={[styles.feedbackPrompt, { color: theme.text }]}>Please rate your experience with us.</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Type your message here..."
        placeholderTextColor={theme.subtext}
        multiline
        textAlignVertical="top"
        style={[styles.feedbackInput, { color: theme.text, borderColor: theme.steel, backgroundColor: theme.panelSoft }]}
      />

      <Pressable style={[styles.feedbackSubmitBtn, !canSubmit && { opacity: 0.65 }]} onPress={onSubmit} disabled={!canSubmit}>
        <Text style={styles.feedbackSubmitText}>Submit Feedback</Text>
      </Pressable>

      <Text style={[styles.feedbackCaption, { color: theme.subtext }]}>
        Please share your feedback. It&apos;ll help us improve our services!
      </Text>

      <View style={[styles.feedbackBenefitStrip, { backgroundColor: theme.panelSoft }]}>
        <View style={styles.feedbackBenefitItem}>
          <Text style={styles.feedbackBenefitIcon}>🛠</Text>
          <Text style={[styles.feedbackBenefitText, { color: theme.text }]}>Free Installation</Text>
        </View>
        <View style={[styles.feedbackBenefitDivider, { backgroundColor: theme.steel }]} />
        <View style={styles.feedbackBenefitItem}>
          <Text style={styles.feedbackBenefitIcon}>💳</Text>
          <Text style={[styles.feedbackBenefitText, { color: theme.text }]}>Cash on Delivery</Text>
        </View>
        <View style={[styles.feedbackBenefitDivider, { backgroundColor: theme.steel }]} />
        <View style={styles.feedbackBenefitItem}>
          <Text style={styles.feedbackBenefitIcon}>✅</Text>
          <Text style={[styles.feedbackBenefitText, { color: theme.text }]}>2 Years Warranty</Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(PublicFeedbackPage);
