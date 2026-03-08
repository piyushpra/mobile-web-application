import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { LANDING_HERO_IMAGE, darkTheme } from '../../constants';
import styles from '../../styles';
import type { CartItem, LandingCategory, PublicProduct, PublicView, Theme } from '../../types';
import { getDetailPrice, getLandingProductModel, getLandingProductTitle, getOfferLabel } from '../../utils/publicCatalog';
import ProductDiscountStrip from './ProductDiscountStrip';
import PublicCategoryProductsPage, { type CategoryBrowseCard } from './PublicCategoryProductsPage';

type CategoryCard = {
  key: LandingCategory;
  label: string;
  icon: string;
  thumb?: string;
};

type Props = {
  theme: Theme;
  publicView: PublicView;
  setPublicView: (view: PublicView) => void;
  openViewMoreModal: (context: 'category' | 'featured' | 'all') => void;
  categoryCards: CategoryCard[];
  landingCategory: LandingCategory;
  setLandingCategory: (category: LandingCategory) => void;
  landingSectionProducts: PublicProduct[];
  cartQtyByProductId: Record<string, number>;
  openProductDetail: (id: string) => void;
  publicProducts: PublicProduct[];
  featuredSectionProducts: PublicProduct[];
  searchedPublicProducts: PublicProduct[];
  isPublicLoading: boolean;
  cartItems: CartItem[];
  changeCartQty: (id: string, nextQty: number) => void;
  removeCartItem: (id: string) => void;
  cartSummary: { subtotal: number; discount: number; delivery: number; total: number };
  continueCheckout: () => void;
  error: string | null;
};

function PublicCatalogSections({
  theme,
  publicView,
  setPublicView,
  openViewMoreModal,
  categoryCards,
  landingCategory,
  setLandingCategory,
  landingSectionProducts,
  cartQtyByProductId,
  openProductDetail,
  publicProducts,
  featuredSectionProducts,
  searchedPublicProducts,
  isPublicLoading,
  cartItems,
  changeCartQty,
  removeCartItem,
  cartSummary,
  continueCheckout,
  error,
}: Props) {
  const isDarkMode = theme.bg === darkTheme.bg;
  const browseCategoryBlueprints = React.useMemo(
    () => [
      { id: 'exide_products', brandLabel: 'EXIDE', title: 'Exide Products', brandKeys: ['exide'], kindKeys: ['battery'], target: 'batteries' as LandingCategory },
      { id: 'luminous_batteries', brandLabel: 'LUMINOUS', title: 'Luminous Batteries', brandKeys: ['luminous', 'lumious'], kindKeys: ['battery'], target: 'batteries' as LandingCategory },
      { id: 'luminous_ups', brandLabel: 'LUMINOUS', title: 'Luminous UPS', brandKeys: ['luminous', 'lumious'], kindKeys: ['ups', 'inverter'], target: 'inverters' as LandingCategory },
      { id: 'microtek_products', brandLabel: 'MICROTEK', title: 'Microtek Products', brandKeys: ['microtek'], kindKeys: [], target: 'inverters' as LandingCategory },
      { id: 'okaya_products', brandLabel: 'OKAYA', title: 'Okaya Products', brandKeys: ['okaya'], kindKeys: [], target: 'batteries' as LandingCategory },
      { id: 'addo_products', brandLabel: 'ADDO', title: 'ADDO Products', brandKeys: ['addo'], kindKeys: [], target: 'batteries' as LandingCategory },
      { id: 'livguard_products', brandLabel: 'Livguard', title: 'Livguard Products', brandKeys: ['livguard'], kindKeys: [], target: 'batteries' as LandingCategory },
      { id: 'sf_products', brandLabel: 'SF', title: 'SF Products', brandKeys: ['sf'], kindKeys: [], target: 'batteries' as LandingCategory },
      { id: 'sukam_products', brandLabel: 'Su-Kam', title: 'Sukam Products', brandKeys: ['sukam', 'su-kam'], kindKeys: [], target: 'inverters' as LandingCategory },
    ],
    [],
  );

  const browseCategoryCards = React.useMemo<CategoryBrowseCard[]>(() => {
    const normalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const includesKey = (value: string, key: string) => {
      const text = normalize(value);
      const needle = normalize(key);
      return Boolean(needle) && text.includes(needle);
    };

    const pickProduct = (brandKeys: string[], kindKeys: string[]) => {
      return publicProducts.find(product => {
        const brandText = String(product.brand || '');
        const categoryText = String(product.category || '');
        const modelText = String(product.model || '');
        const nameText = String(product.name || '');
        const merged = `${categoryText} ${modelText} ${nameText}`;
        const brandMatched = brandKeys.some(key => includesKey(brandText, key));
        if (!brandMatched) return false;
        if (!kindKeys || kindKeys.length === 0) return true;
        return kindKeys.some(key => includesKey(merged, key));
      });
    };

    return browseCategoryBlueprints.map(card => {
      const matched = pickProduct(card.brandKeys, card.kindKeys);
      return {
        ...card,
        imageUri: matched?.thumbnail || '',
      };
    });
  }, [browseCategoryBlueprints, publicProducts]);

  const [activeBrowseCategory, setActiveBrowseCategory] = React.useState<CategoryBrowseCard | null>(null);
  const goToLanding = React.useCallback(() => {
    setActiveBrowseCategory(null);
    setPublicView('landing');
  }, [setPublicView]);

  React.useEffect(() => {
    if (publicView === 'landing') {
      setActiveBrowseCategory(prev => (prev ? null : prev));
    }
  }, [publicView]);

  const landingPreviewProducts = React.useMemo(
    () => landingSectionProducts.slice(0, 3),
    [landingSectionProducts],
  );
  const featuredPreviewProducts = React.useMemo(
    () => featuredSectionProducts.slice(0, 4),
    [featuredSectionProducts],
  );

  const listItemSeparator = React.useCallback(() => <View style={styles.listItemSeparator} />, []);

  const renderAllProductRow = React.useCallback(
    ({ item }: { item: PublicProduct }) => {
      const productCartQty = cartQtyByProductId[item.id] || 0;
      const productDiscountPct = getDetailPrice(item).discountPct;
      return (
        <Pressable onPress={() => openProductDetail(item.id)} style={[styles.productListRow, { backgroundColor: theme.panelSoft }]}>
          <ProductDiscountStrip discountPct={productDiscountPct} isDarkMode={isDarkMode} />
          <Image
            source={{ uri: item.thumbnail }}
            style={[styles.productListImage, isDarkMode && styles.productListImageDark]}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
              {getLandingProductTitle(item)}
            </Text>
            <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
              Model: {getLandingProductModel(item)}
            </Text>
            {String(item.brand || '').trim() ? (
              <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                Brand: {item.brand}
              </Text>
            ) : null}
            {productCartQty > 0 ? <Text style={styles.productCartHint}>In cart: {productCartQty}</Text> : null}
          </View>
          <Text style={[styles.small, { color: theme.primary }]}>Open</Text>
        </Pressable>
      );
    },
    [cartQtyByProductId, isDarkMode, openProductDetail, theme],
  );

  const renderCartRow = React.useCallback(
    ({ item }: { item: CartItem }) => (
      <View style={[styles.cartItemRow, { backgroundColor: theme.panelSoft }]}>
        <Image source={{ uri: item.thumbnail }} style={styles.cartItemImage} resizeMode="cover" />
        <View style={styles.cartItemInfo}>
          <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
            {item.model} • {item.capacity}
          </Text>
          <Text style={styles.cartItemPrice}>₹{item.unitPrice.toLocaleString()}</Text>
          <View style={styles.cartQtyRow}>
            <Pressable style={styles.cartQtyBtn} onPress={() => changeCartQty(item.id, item.qty - 1)}>
              <Text style={styles.cartQtyBtnText}>-</Text>
            </Pressable>
            <Text style={styles.cartQtyValue}>{item.qty}</Text>
            <Pressable style={styles.cartQtyBtn} onPress={() => changeCartQty(item.id, item.qty + 1)}>
              <Text style={styles.cartQtyBtnText}>+</Text>
            </Pressable>
            <Pressable onPress={() => removeCartItem(item.id)}>
              <Text style={styles.cartRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [changeCartQty, removeCartItem, theme],
  );

  const cartFooter = React.useMemo(
    () => (
      <>
        <View style={styles.cartSummaryBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.cartSummaryLabel}>Subtotal</Text>
            <Text style={styles.cartSummaryValue}>₹{cartSummary.subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.cartSummaryLabel}>Discount</Text>
            <Text style={styles.cartSummaryValue}>- ₹{cartSummary.discount.toLocaleString()}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.cartSummaryLabel}>Delivery</Text>
            <Text style={styles.cartSummaryValue}>
              {cartSummary.delivery === 0 ? 'Free' : `₹${cartSummary.delivery.toLocaleString()}`}
            </Text>
          </View>
          <View style={styles.cartSummaryDivider} />
          <View style={styles.rowBetween}>
            <Text style={styles.cartSummaryTotalLabel}>Total</Text>
            <Text style={styles.cartSummaryTotalValue}>₹{cartSummary.total.toLocaleString()}</Text>
          </View>
        </View>
        <Pressable style={styles.checkoutMainBtn} onPress={continueCheckout}>
          <Text style={styles.checkoutMainBtnText}>Continue to Checkout</Text>
        </Pressable>
      </>
    ),
    [cartSummary, continueCheckout],
  );

  if (publicView === 'categoryProducts') {
    const selectedCard =
      activeBrowseCategory ||
      browseCategoryCards.find(card => card.target === landingCategory) ||
      browseCategoryCards[0] ||
      null;

    if (!selectedCard) {
      return (
        <View style={[styles.card, { backgroundColor: theme.panel }]}>
          <Text style={[styles.small, { color: theme.subtext }]}>No category selected.</Text>
        </View>
      );
    }

    return (
      <PublicCategoryProductsPage
        theme={theme}
        card={selectedCard}
        products={publicProducts}
        onBack={goToLanding}
        onOpenProduct={openProductDetail}
      />
    );
  }

  if (publicView === 'categories') {
    return (
      <>
        <View style={[styles.card, { backgroundColor: theme.panel }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: theme.text }]}>Categories</Text>
            <Pressable onPress={goToLanding}>
              <Text style={[styles.small, { color: theme.primary }]}>Back</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.browseCategoriesWrap, { backgroundColor: theme.panel }]}>
          <Text style={[styles.browseCategoriesTitle, { color: theme.text }]}>Browse Categories</Text>
          <View style={[styles.browseCategoriesDivider, { backgroundColor: theme.steel }]} />
          <View style={styles.browseCategoriesGrid}>
            {browseCategoryCards.map(card => (
              <View key={card.id} style={[styles.browseCategoryCard, { backgroundColor: theme.panelSoft, borderColor: theme.steel }]}>
                <Text style={[styles.browseCategoryBrand, { color: '#1D4F9A' }]} numberOfLines={1}>
                  {card.brandLabel}
                </Text>
                <Image
                  source={card.imageUri ? { uri: card.imageUri } : LANDING_HERO_IMAGE}
                  style={styles.browseCategoryImage}
                  resizeMode="contain"
                />
                <Text style={[styles.browseCategoryName, { color: theme.text }]} numberOfLines={1}>
                  {card.title}
                </Text>
                <Pressable
                  style={styles.browseCategoryExploreBtn}
                  onPress={() => {
                    setLandingCategory(card.target);
                    setActiveBrowseCategory(card);
                    setPublicView('categoryProducts');
                  }}
                >
                  <Text style={styles.browseCategoryExploreText}>Explore</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
        {error ? <Text style={[styles.small, { color: theme.danger }]}>{error}</Text> : null}
      </>
    );
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.panel }]}> 
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: theme.text }]}>Shop by Category</Text>
          <Pressable onPress={goToLanding}>
            <Text style={[styles.small, { color: theme.accent, fontWeight: '900' }]}>View All</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categoryCards.map(card => (
              <Pressable
                key={card.key}
                style={[
                  styles.categoryCardNew,
                  isDarkMode && styles.categoryCardNewDark,
                  landingCategory === card.key &&
                    (isDarkMode
                      ? styles.categoryCardNewDarkActive
                      : { borderColor: theme.accent, borderWidth: 2 }),
                ]}
                onPress={() => {
                  setLandingCategory(card.key);
                  setPublicView('landing');
                }}
              >
                <Image
                  source={card.thumb ? { uri: card.thumb } : LANDING_HERO_IMAGE}
                  style={[styles.categoryThumb, isDarkMode && styles.categoryThumbDark]}
                  resizeMode="cover"
                />
                <Text style={[styles.categoryIconSmall, isDarkMode && styles.categoryIconSmallDark]}>{card.icon}</Text>
                <Text style={[styles.categoryLabel, { marginTop: 6, color: theme.text }]}>{card.label}</Text>
              </Pressable>
            ))}
        </ScrollView>
      </View>

      {publicView === 'landing' ? (
        <>
          <View style={[styles.card, { backgroundColor: theme.panel }]}> 
            <View style={styles.rowBetween}>
              <Text style={[styles.title, { color: theme.text }]}>
                {landingCategory === 'inverters'
                  ? 'Inverter Products'
                  : landingCategory === 'batteries'
                    ? 'Battery Products'
                    : 'Accessories Products'}
              </Text>
              <Pressable onPress={() => openViewMoreModal('category')}>
                <Text style={[styles.small, { color: theme.primary }]}>View More</Text>
              </Pressable>
            </View>
            {landingSectionProducts.length === 0 ? (
              <Text style={[styles.small, { color: theme.subtext }]}>No items available.</Text>
            ) : (
              landingPreviewProducts.map(product => {
                const productCartQty = cartQtyByProductId[product.id] || 0;
                const productDiscountPct = getDetailPrice(product).discountPct;
                return (
                  <Pressable
                    key={`cat_${product.id}`}
                    onPress={() => openProductDetail(product.id)}
                    style={[styles.productListRow, { backgroundColor: theme.panelSoft }]}
                  >
                    <ProductDiscountStrip discountPct={productDiscountPct} isDarkMode={isDarkMode} />
                    <Image
                      source={{ uri: product.thumbnail }}
                      style={[styles.productListImage, isDarkMode && styles.productListImageDark]}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={2}>
                        {getLandingProductTitle(product)}
                      </Text>
                      <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                        Model: {getLandingProductModel(product)}
                      </Text>
                      {String(product.brand || '').trim() ? (
                        <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                          Brand: {product.brand}
                        </Text>
                      ) : null}
                      {productCartQty > 0 ? <Text style={styles.productCartHint}>In cart: {productCartQty}</Text> : null}
                    </View>
                    <Text style={[styles.small, { color: theme.primary }]}>Open</Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.panel }]}> 
            <View style={styles.rowBetween}>
              <Text style={[styles.title, { color: theme.text }]}>Featured Products</Text>
              <Pressable onPress={() => openViewMoreModal('featured')}>
                <Text style={[styles.small, { color: theme.primary }]}>View More</Text>
              </Pressable>
            </View>
            {isPublicLoading ? <ActivityIndicator color={theme.primary} /> : null}
            <View style={styles.featuredProductsGrid}>
              {featuredPreviewProducts.map(product => {
                const offerLabel = getOfferLabel(product);
                const productCartQty = cartQtyByProductId[product.id] || 0;
                const productDiscountPct = getDetailPrice(product).discountPct;
                return (
                  <View key={product.id} style={[styles.productTile, styles.featuredProductTile, { backgroundColor: theme.panelSoft }]}> 
                    <ProductDiscountStrip discountPct={productDiscountPct} isDarkMode={isDarkMode} />
                    {productDiscountPct <= 0 && offerLabel ? (
                      <View style={[styles.dealBadge, { backgroundColor: '#F59E0B' }]}>
                        <Text style={styles.dealBadgeText}>{offerLabel}</Text>
                      </View>
                    ) : null}
                    <Image
                      source={{ uri: product.thumbnail }}
                      style={[styles.productImage, isDarkMode && styles.productImageDark]}
                      resizeMode="cover"
                    />
                    <Text style={[styles.itemText, styles.productTileName, { color: theme.text }]} numberOfLines={2}>
                      {getLandingProductTitle(product)}
                    </Text>
                    {productCartQty > 0 ? (
                      <View style={styles.productInCartBadge}>
                        <Text style={styles.productInCartBadgeText}>In Cart: {productCartQty}</Text>
                      </View>
                    ) : null}
                    <Pressable style={styles.shopTileBtn} onPress={() => openProductDetail(product.id)}>
                      <Text style={styles.shopTileBtnText}>Shop Now</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {publicView === 'list' ? (
      <View style={[styles.card, { backgroundColor: theme.panel }]}> 
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: theme.text }]}>All Products</Text>
          <Pressable onPress={goToLanding}>
            <Text style={[styles.small, { color: theme.primary }]}>Back</Text>
          </Pressable>
        </View>
          <FlatList
            data={searchedPublicProducts}
            keyExtractor={item => item.id}
            renderItem={renderAllProductRow}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            ItemSeparatorComponent={listItemSeparator}
            ListEmptyComponent={<Text style={[styles.small, { color: theme.subtext }]}>No products found.</Text>}
          />
        </View>
      ) : null}

      {publicView === 'cart' ? (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: theme.text }]}>My Cart</Text>
            <Pressable onPress={goToLanding}>
              <Text style={[styles.small, { color: theme.primary }]}>Continue Shopping</Text>
            </Pressable>
          </View>
          {cartItems.length === 0 ? (
            <Text style={[styles.small, { color: theme.subtext }]}>Your cart is empty. Add products to continue.</Text>
          ) : (
            <FlatList
              data={cartItems}
              keyExtractor={item => item.id}
              renderItem={renderCartRow}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={50}
              windowSize={4}
              ItemSeparatorComponent={listItemSeparator}
              ListFooterComponent={cartFooter}
            />
          )}
        </View>
      ) : null}

      {error ? <Text style={[styles.small, { color: theme.danger }]}>{error}</Text> : null}
    </>
  );
}

export default React.memo(PublicCatalogSections);
