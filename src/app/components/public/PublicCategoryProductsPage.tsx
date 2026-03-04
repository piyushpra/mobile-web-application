import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { LANDING_HERO_IMAGE } from '../../constants';
import styles from '../../styles';
import type { LandingCategory, PublicProduct, Theme } from '../../types';
import { getLandingProductModel, getLandingProductTitle } from '../../utils/publicCatalog';

export type CategoryBrowseCard = {
  id: string;
  brandLabel: string;
  title: string;
  brandKeys: string[];
  kindKeys: string[];
  target: LandingCategory;
  imageUri?: string;
};

type Props = {
  theme: Theme;
  card: CategoryBrowseCard;
  products: PublicProduct[];
  onBack: () => void;
  onOpenProduct: (id: string) => void;
};

function PublicCategoryProductsPage({ theme, card, products, onBack, onOpenProduct }: Props) {
  const [page, setPage] = React.useState(1);
  const perPage = 6;

  const normalize = React.useCallback((value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''), []);

  const matchesKey = React.useCallback(
    (value: string, key: string) => {
      const text = normalize(value);
      const needle = normalize(key);
      return Boolean(needle) && text.includes(needle);
    },
    [normalize],
  );

  const filteredProducts = React.useMemo(() => {
    return products.filter(product => {
      const brandText = String(product.brand || '');
      const merged = `${product.category || ''} ${product.model || ''} ${product.name || ''}`;
      const brandMatched = card.brandKeys.some(key => matchesKey(brandText, key));
      if (!brandMatched) return false;
      if (!card.kindKeys || card.kindKeys.length === 0) return true;
      return card.kindKeys.some(key => matchesKey(merged, key));
    });
  }, [card.brandKeys, card.kindKeys, matchesKey, products]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const safePage = Math.min(page, pageCount);

  React.useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const visibleProducts = React.useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filteredProducts.slice(start, start + perPage);
  }, [filteredProducts, safePage]);

  const pagerNumbers = React.useMemo(() => {
    const out: number[] = [];
    for (let n = 1; n <= Math.min(pageCount, 3); n += 1) out.push(n);
    return out;
  }, [pageCount]);

  const heroSubline = `Discover a range of ${card.brandLabel} batteries and UPS for reliable power backup`;

  return (
    <View style={[styles.categoryProductsPageWrap, { backgroundColor: theme.panel }]}>
      <View style={[styles.categoryProductsTopBar, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <Pressable style={styles.categoryProductsIconBtn} onPress={onBack}>
          <Text style={[styles.categoryProductsIcon, { color: theme.subtext }]}>←</Text>
        </Pressable>
        <View style={[styles.categoryProductsBrandPill, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
          <Text style={[styles.categoryProductsBrandPillText, { color: theme.accent }]}>{card.brandLabel}</Text>
        </View>
        <Pressable style={styles.categoryProductsIconBtn}>
          <Text style={[styles.categoryProductsIcon, { color: theme.subtext }]}>⌕</Text>
        </Pressable>
      </View>

      <Text style={[styles.categoryProductsBreadcrumb, { color: theme.subtext }]}>⌂ Home › {card.title}</Text>

      <View style={[styles.categoryProductsHero, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <View style={styles.categoryProductsHeroTextWrap}>
          <Text style={[styles.categoryProductsHeroBrand, { color: theme.accent }]}>{card.brandLabel}</Text>
          <Text style={[styles.categoryProductsHeroTitle, { color: theme.text }]}>{card.title}</Text>
          <Text style={[styles.categoryProductsHeroSubline, { color: theme.subtext }]}>{heroSubline}</Text>
          <Pressable style={[styles.categoryProductsHeroBtn, { backgroundColor: theme.accent }]}>
            <Text style={[styles.categoryProductsHeroBtnText, { color: theme.panel }]}>Contact Us</Text>
          </Pressable>
        </View>
        <Image
          source={card.imageUri ? { uri: card.imageUri } : LANDING_HERO_IMAGE}
          style={styles.categoryProductsHeroImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.rowBetween}>
        <Text style={[styles.categoryProductsSectionTitle, { color: theme.text }]}>{card.title}</Text>
        <View style={[styles.categoryProductsSortPill, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
          <Text style={[styles.categoryProductsSortLabel, { color: theme.subtext }]}>Sort by:</Text>
          <Text style={[styles.categoryProductsSortValue, { color: theme.text }]}>Popularity ▾</Text>
        </View>
      </View>

      <Pressable style={[styles.categoryProductsFilterBtn, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <Text style={[styles.categoryProductsFilterBtnText, { color: theme.text }]}>☰ Filters (3) ▾</Text>
      </Pressable>

      <View style={styles.categoryProductsGrid}>
        {visibleProducts.map(product => (
          <View key={product.id} style={[styles.categoryProductsCard, { borderBottomColor: theme.steel }]}>
            <Image source={{ uri: product.thumbnail }} style={styles.categoryProductsCardImage} resizeMode="contain" />
            <Text style={[styles.categoryProductsCardName, { color: theme.text }]} numberOfLines={2}>
              {getLandingProductTitle(product)}
            </Text>
            <Text style={[styles.categoryProductsCardModel, { color: theme.subtext }]} numberOfLines={1}>
              {getLandingProductModel(product)}
            </Text>
            <Pressable style={[styles.categoryProductsCardBtn, { backgroundColor: theme.accent }]} onPress={() => onOpenProduct(product.id)}>
              <Text style={[styles.categoryProductsCardBtnText, { color: theme.panel }]}>View Details</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {visibleProducts.length === 0 ? (
        <Text style={[styles.small, { color: theme.subtext }]}>No products found for this category.</Text>
      ) : null}

      <View style={styles.categoryProductsPagerRow}>
        <Pressable
          style={[
            styles.categoryProductsPagerBtn,
            { backgroundColor: theme.panelSoft, borderColor: theme.steel },
            safePage === 1 && styles.categoryProductsPagerBtnDisabled,
          ]}
          onPress={() => setPage(prev => Math.max(1, prev - 1))}
          disabled={safePage === 1}
        >
          <Text
            style={[
              styles.categoryProductsPagerBtnText,
              { color: theme.text },
              safePage === 1 && styles.categoryProductsPagerBtnTextDisabled,
              safePage === 1 && { color: theme.subtext },
            ]}
          >
            ‹
          </Text>
        </Pressable>
        {pagerNumbers.map(n => {
          const active = safePage === n;
          return (
            <Pressable
              key={`page_${n}`}
              style={[
                styles.categoryProductsPagerNum,
                { backgroundColor: theme.panelSoft, borderColor: theme.steel },
                active && styles.categoryProductsPagerNumActive,
                active && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
              onPress={() => setPage(n)}
            >
              <Text
                style={[
                  styles.categoryProductsPagerNumText,
                  { color: theme.subtext },
                  active && styles.categoryProductsPagerNumTextActive,
                  active && { color: theme.panel },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[
            styles.categoryProductsPagerBtn,
            { backgroundColor: theme.panelSoft, borderColor: theme.steel },
            safePage === pageCount && styles.categoryProductsPagerBtnDisabled,
          ]}
          onPress={() => setPage(prev => Math.min(pageCount, prev + 1))}
          disabled={safePage === pageCount}
        >
          <Text
            style={[
              styles.categoryProductsPagerBtnText,
              { color: theme.text },
              safePage === pageCount && styles.categoryProductsPagerBtnTextDisabled,
              safePage === pageCount && { color: theme.subtext },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(PublicCategoryProductsPage);
