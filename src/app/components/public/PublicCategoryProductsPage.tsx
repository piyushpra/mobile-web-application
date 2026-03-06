import React from 'react';
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { LANDING_HERO_IMAGE, darkTheme } from '../../constants';
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
  const isDarkMode = theme.bg === darkTheme.bg;
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchModalVisible, setIsSearchModalVisible] = React.useState(false);
  const searchInputRef = React.useRef<TextInput | null>(null);
  const [page, setPage] = React.useState(1);
  const perPage = 6;

  const normalize = React.useCallback((value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''), []);
  const sanitizeSearchLabel = React.useCallback(
    (value: string) => {
      const display = String(value || '').trim();
      if (!display) return '';
      return normalize(display) === 'general' ? '' : display;
    },
    [normalize],
  );

  const matchesKey = React.useCallback(
    (value: string, key: string) => {
      const text = normalize(value);
      const needle = normalize(key);
      return Boolean(needle) && text.includes(needle);
    },
    [normalize],
  );

  const filteredProducts = React.useMemo(() => {
    const queryTokens = String(searchQuery || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(token => normalize(token))
      .filter(Boolean);

    return products.filter(product => {
      const brandText = sanitizeSearchLabel(String(product.brand || ''));
      const categoryText = sanitizeSearchLabel(String(product.category || ''));
      const merged = `${categoryText} ${product.model || ''} ${product.name || ''}`;
      const brandMatched = card.brandKeys.some(key => matchesKey(brandText, key));
      const kindMatched = !card.kindKeys || card.kindKeys.length === 0 || card.kindKeys.some(key => matchesKey(merged, key));
      const scopeMatched = brandMatched && kindMatched;

      if (queryTokens.length === 0) {
        return scopeMatched;
      }

      const searchable = `${categoryText} ${product.model || ''} ${product.name || ''} ${brandText} ${product.shortDescription || ''} ${getLandingProductTitle(product)} ${getLandingProductModel(product)} ${card.title} ${card.brandLabel} ${card.target}`;
      const haystack = normalize(searchable);
      return queryTokens.every(token => haystack.includes(token));
    });
  }, [card.brandKeys, card.brandLabel, card.kindKeys, card.target, card.title, matchesKey, normalize, products, sanitizeSearchLabel, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const safePage = Math.min(page, pageCount);

  React.useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, card.id]);

  React.useEffect(() => {
    if (!isSearchModalVisible) {
      return;
    }
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [isSearchModalVisible]);

  const visibleProducts = React.useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filteredProducts.slice(start, start + perPage);
  }, [filteredProducts, safePage]);

  const searchBrands = React.useMemo(() => {
    const uniq = new Map<string, string>();
    for (const product of filteredProducts) {
      const display = sanitizeSearchLabel(String(product.brand || ''));
      if (!display) continue;
      const key = normalize(display);
      if (!key || uniq.has(key)) continue;
      uniq.set(key, display);
    }
    return Array.from(uniq.values());
  }, [filteredProducts, normalize, sanitizeSearchLabel]);

  const searchCategories = React.useMemo(() => {
    const uniq = new Map<string, string>();
    for (const product of filteredProducts) {
      const display = sanitizeSearchLabel(String(product.category || ''));
      if (!display) continue;
      const key = normalize(display);
      if (!key || uniq.has(key)) continue;
      uniq.set(key, display);
    }
    return Array.from(uniq.values());
  }, [filteredProducts, normalize, sanitizeSearchLabel]);

  const pagerNumbers = React.useMemo(() => {
    const out: number[] = [];
    for (let n = 1; n <= Math.min(pageCount, 3); n += 1) out.push(n);
    return out;
  }, [pageCount]);

  const trimmedSearchQuery = searchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;
  const searchBrandLabel = React.useMemo(() => {
    if (!isSearching || searchBrands.length === 0) return card.brandLabel;
    if (searchBrands.length === 1) return searchBrands[0];
    if (searchBrands.length === 2) return `${searchBrands[0]} + ${searchBrands[1]}`;
    return `${searchBrands[0]} + ${searchBrands[1]} + ${searchBrands.length - 2} more`;
  }, [card.brandLabel, isSearching, searchBrands]);
  const dynamicHeroTitle = React.useMemo(() => {
    if (!isSearching) return card.title;
    if (searchCategories.length === 1) return `${searchCategories[0]} Products`;
    if (searchCategories.length > 1) return 'Multiple Categories Products';
    return 'Products';
  }, [card.title, isSearching, searchCategories]);
  const heroSubline = isSearching
    ? filteredProducts.length > 0
      ? `Showing ${filteredProducts.length} ${filteredProducts.length === 1 ? 'result' : 'results'} for "${trimmedSearchQuery}" across ${searchBrands.length || 1} ${searchBrands.length === 1 ? 'brand' : 'brands'}`
      : `No products found for "${trimmedSearchQuery}"`
    : `Discover a range of ${card.brandLabel} batteries and UPS for reliable power backup`;

  return (
    <View style={[styles.categoryProductsPageWrap, { backgroundColor: theme.panel }]}>
      <View style={[styles.categoryProductsTopBar, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <Pressable style={styles.categoryProductsIconBtn} onPress={onBack}>
          <Text style={[styles.categoryProductsIcon, { color: theme.subtext }]}>←</Text>
        </Pressable>
        <View style={[styles.categoryProductsBrandPill, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
          <Text style={[styles.categoryProductsBrandPillText, { color: theme.accent }]}>{searchBrandLabel}</Text>
        </View>
        <Pressable style={styles.categoryProductsIconBtn} onPress={() => setIsSearchModalVisible(true)}>
          <Text style={[styles.categoryProductsIcon, { color: theme.subtext }]}>⌕</Text>
        </Pressable>
      </View>

      <Text style={[styles.categoryProductsBreadcrumb, { color: theme.subtext }]}>⌂ Home › {card.title}</Text>

      <View style={[styles.categoryProductsHero, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <View style={styles.categoryProductsHeroTextWrap}>
          <Text style={[styles.categoryProductsHeroBrand, { color: theme.accent }]}>{searchBrandLabel}</Text>
          <Text style={[styles.categoryProductsHeroTitle, { color: theme.text }]}>{dynamicHeroTitle}</Text>
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
        <Text style={[styles.categoryProductsSectionTitle, { color: theme.text }]}>
          {isSearching ? 'Search Results' : card.title}
        </Text>
        <View style={[styles.categoryProductsSortPill, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
          <Text style={[styles.categoryProductsSortLabel, { color: theme.subtext }]}>Sort by:</Text>
          <Text style={[styles.categoryProductsSortValue, { color: theme.text }]}>Popularity ▾</Text>
        </View>
      </View>

      <Pressable style={[styles.categoryProductsFilterBtn, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
        <Text style={[styles.categoryProductsFilterBtnText, { color: theme.text }]}>☰ Filters (3) ▾</Text>
      </Pressable>

      {searchQuery.trim().length > 0 ? (
        <View style={styles.categoryProductsSearchStatusRow}>
          <Text style={[styles.categoryProductsSearchStatusText, { color: theme.subtext }]} numberOfLines={1}>
            Search: {searchQuery.trim()}
          </Text>
          <Pressable onPress={() => setSearchQuery('')}>
            <Text style={[styles.categoryProductsSearchStatusClear, { color: theme.accent }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.categoryProductsGrid}>
        {visibleProducts.map(product => (
          <View key={product.id} style={[styles.categoryProductsCard, { borderBottomColor: theme.steel }]}>
            <Image
              source={{ uri: product.thumbnail }}
              style={[styles.categoryProductsCardImage, isDarkMode && styles.categoryProductsCardImageDark]}
              resizeMode="contain"
            />
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
        <Text style={[styles.small, { color: theme.subtext }]}>
          {searchQuery.trim().length > 0 ? 'No products found for this search.' : 'No products found for this category.'}
        </Text>
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

      <Modal
        visible={isSearchModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View style={styles.categoryProductsSearchModalBackdrop}>
          <View style={[styles.categoryProductsSearchModalCard, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
            <View style={styles.categoryProductsSearchModalHeader}>
              <Text style={[styles.categoryProductsSearchModalTitle, { color: theme.text }]}>Search {card.title}</Text>
              <Pressable onPress={() => setIsSearchModalVisible(false)}>
                <Text style={[styles.categoryProductsSearchModalDone, { color: theme.accent }]}>Done</Text>
              </Pressable>
            </View>
            <View style={[styles.categoryProductsSearchWrap, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
              <Text style={[styles.categoryProductsSearchIcon, { color: theme.subtext }]}>⌕</Text>
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search ${card.title}`}
                placeholderTextColor={theme.subtext}
                style={[styles.categoryProductsSearchInput, { color: theme.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.trim().length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Text style={[styles.categoryProductsSearchClear, { color: theme.subtext }]}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(PublicCategoryProductsPage);
