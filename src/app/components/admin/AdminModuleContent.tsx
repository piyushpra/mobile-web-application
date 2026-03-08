import React from 'react';
import { Animated, Image, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import ListRow from '../ListRow';
import Picker from '../Picker';
import Stat from '../Stat';
import { ITEM_CATEGORY_OPTIONS, ITEM_TECHNOLOGY_OPTIONS, darkTheme } from '../../constants';
import styles from '../../styles';
import {
  applyItemCapacitySelection,
  resolveItemCapacityInputMode,
  type ItemCapacityInputMode,
} from '../../utils/itemCapacity';

type Props = any;
const MANUAL_CAPACITY_OPTION_ID = '__manual_capacity__';
const NO_CAPACITY_OPTION_ID = '__no_capacity__';

function AdminModuleContent(props: Props) {
  const {
    moduleId,
    theme,
    fade,
    rise,
    overview,
    itemName,
    setItemName,
    itemSku,
    setItemSku,
    itemBrand,
    setItemBrand,
    itemCategory,
    setItemCategory,
    itemTechnologyOption,
    setItemTechnologyOption,
    itemCapacityAh,
    setItemCapacityAh,
    itemDraftVersion,
    itemQty,
    setItemQty,
    itemReorder,
    setItemReorder,
    itemPurchasePrice,
    setItemPurchasePrice,
    itemSellingPrice,
    setItemSellingPrice,
    itemTags,
    setItemTags,
    itemImages,
    itemImageUrls,
    pickItemImages,
    removeItemImage,
    setItemImageUrlValue,
    addItemImageUrlField,
    removeItemImageUrlField,
    createItem,
    editingItemId,
    isItemEditModalVisible,
    openItemEditModal,
    closeItemEditModal,
    canEdit,
    isSaving,
    search,
    setSearch,
    filteredItems,
    partyName,
    setPartyName,
    partyCompany,
    setPartyCompany,
    partyEmail,
    setPartyEmail,
    partyPhone,
    setPartyPhone,
    partyGstin,
    setPartyGstin,
    createParty,
    suppliers,
    customers,
    canDeleteMaster,
    deleteParty,
    deleteItem,
    selectedItemId,
    setSelectedItemId,
    items,
    selectedSupplierId,
    setSelectedSupplierId,
    selectedCustomerId,
    setSelectedCustomerId,
    nameField,
    setNameField,
    qty,
    setQty,
    price,
    setPrice,
    dueDate,
    setDueDate,
    createDocument,
    purchaseOrders,
    salesOrders,
    bills,
    invoices,
    executeAction,
    adjustDelta,
    setAdjustDelta,
    adjustReason,
    setAdjustReason,
    postAdjustment,
    movements,
  } = props;
  const ahOptions = React.useMemo(
    () => ['110Ah', '120Ah', '150Ah', '200Ah', '220Ah'].map(cap => ({ id: cap, label: cap })),
    [],
  );
  const isDarkMode = theme.bg === darkTheme.bg;
  const categoryOptions = React.useMemo(
    () => ITEM_CATEGORY_OPTIONS.map(category => ({ id: category, label: category })),
    [],
  );
  const technologyOptions = React.useMemo(
    () => ITEM_TECHNOLOGY_OPTIONS.map(option => ({ id: option, label: option })),
    [],
  );
  const itemTagOptions = React.useMemo(() => [{ id: 'bestseller', label: 'Bestseller' }, { id: 'premium', label: 'Premium' }], []);
  const presetBrands = React.useMemo(() => ['microtek', 'sukam', 'lumious', 'exide'], []);
  const presetCapacityValues = React.useMemo(() => ahOptions.map(option => option.id), [ahOptions]);
  const capacityOptions = React.useMemo(
    () => [{ id: NO_CAPACITY_OPTION_ID, label: 'Not Set' }, ...ahOptions, { id: MANUAL_CAPACITY_OPTION_ID, label: 'Manual Ah' }],
    [ahOptions],
  );
  const [isCreateBrandDropdownVisible, setIsCreateBrandDropdownVisible] = React.useState(false);
  const [isEditBrandDropdownVisible, setIsEditBrandDropdownVisible] = React.useState(false);
  const [capacityInputMode, setCapacityInputMode] = React.useState<ItemCapacityInputMode>(() =>
    resolveItemCapacityInputMode(itemCapacityAh, presetCapacityValues),
  );
  const [itemsView, setItemsView] = React.useState<'form' | 'inventory'>('form');
  const brandDropdownCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBrandDropdownCloseTimer = React.useCallback(() => {
    if (brandDropdownCloseTimerRef.current) {
      clearTimeout(brandDropdownCloseTimerRef.current);
      brandDropdownCloseTimerRef.current = null;
    }
  }, []);

  const showBrandDropdown = React.useCallback((context: 'create' | 'edit') => {
    clearBrandDropdownCloseTimer();
    if (context === 'edit') {
      setIsEditBrandDropdownVisible(true);
      return;
    }
    setIsCreateBrandDropdownVisible(true);
  }, [clearBrandDropdownCloseTimer]);

  const closeBrandDropdown = React.useCallback((context: 'create' | 'edit') => {
    clearBrandDropdownCloseTimer();
    if (context === 'edit') {
      setIsEditBrandDropdownVisible(false);
      return;
    }
    setIsCreateBrandDropdownVisible(false);
  }, [clearBrandDropdownCloseTimer]);

  const scheduleCloseBrandDropdown = React.useCallback(
    (context: 'create' | 'edit') => {
      clearBrandDropdownCloseTimer();
      brandDropdownCloseTimerRef.current = setTimeout(() => {
        if (context === 'edit') {
          setIsEditBrandDropdownVisible(false);
        } else {
          setIsCreateBrandDropdownVisible(false);
        }
        brandDropdownCloseTimerRef.current = null;
      }, 120);
    },
    [clearBrandDropdownCloseTimer],
  );

  React.useEffect(() => {
    if (isItemEditModalVisible) {
      setIsCreateBrandDropdownVisible(false);
      return;
    }
    setIsEditBrandDropdownVisible(false);
  }, [isItemEditModalVisible]);

  React.useEffect(() => {
    setCapacityInputMode(resolveItemCapacityInputMode(itemCapacityAh, presetCapacityValues));
  }, [itemDraftVersion, presetCapacityValues]);

  React.useEffect(() => () => clearBrandDropdownCloseTimer(), [clearBrandDropdownCloseTimer]);

  React.useEffect(() => {
    if (moduleId !== 'items') {
      setItemsView('form');
    }
  }, [moduleId]);

  const toBrandLabel = React.useCallback((value: string) => {
    const lower = value.toLowerCase();
    return lower.replace(/\b[a-z]/g, char => char.toUpperCase());
  }, []);

  const brandOptions = React.useMemo(() => {
    const out: string[] = [];
    const addUnique = (value: unknown) => {
      const brand = String(value || '').trim();
      if (!brand) return;
      if (brand.toLowerCase() === 'general') return;
      const exists = out.some(item => item.toLowerCase() === brand.toLowerCase());
      if (!exists) out.push(toBrandLabel(brand));
    };
    presetBrands.forEach(addUnique);
    for (const item of Array.isArray(items) ? items : []) {
      addUnique(item?.brand);
    }
    return out;
  }, [items, presetBrands, toBrandLabel]);

  const filteredBrandOptions = React.useMemo(() => {
    const q = String(itemBrand || '').trim().toLowerCase();
    if (!q) return brandOptions;
    return brandOptions.filter(brand => brand.toLowerCase().includes(q));
  }, [brandOptions, itemBrand]);

  const handleBrandInputChange = React.useCallback(
    (context: 'create' | 'edit', value: string) => {
      setItemBrand(value);
      showBrandDropdown(context);
    },
    [setItemBrand, showBrandDropdown],
  );

  const handleBrandSelect = React.useCallback(
    (context: 'create' | 'edit', brand: string) => {
      setItemBrand(brand);
      closeBrandDropdown(context);
      Keyboard.dismiss();
    },
    [closeBrandDropdown, setItemBrand],
  );

  const enableManualBrandEntry = React.useCallback((context: 'create' | 'edit') => {
    closeBrandDropdown(context);
    setItemBrand('');
  }, [closeBrandDropdown, setItemBrand]);

  const handleCapacitySelect = React.useCallback(
    (selectedId: string) => {
      const next = applyItemCapacitySelection(itemCapacityAh, selectedId, presetCapacityValues, {
        manualOptionId: MANUAL_CAPACITY_OPTION_ID,
        noCapacityOptionId: NO_CAPACITY_OPTION_ID,
      });
      setCapacityInputMode(next.mode);
      setItemCapacityAh(next.value);
    },
    [itemCapacityAh, presetCapacityValues, setItemCapacityAh],
  );

  const manualCapacityValue = React.useMemo(() => {
    const raw = String(itemCapacityAh || '').trim();
    if (!raw) {
      return '';
    }
    const compact = raw.replace(/\s+/g, '');
    const numericMatch = compact.match(/^(\d{1,4})(?:ah)?$/i);
    return numericMatch?.[1] || raw.replace(/\s*ah$/i, '');
  }, [itemCapacityAh]);

  const handleManualCapacityChange = React.useCallback(
    (value: string) => {
      const digits = value.replace(/[^0-9]/g, '').slice(0, 4);
      setItemCapacityAh(digits ? `${digits}Ah` : '');
    },
    [setItemCapacityAh],
  );

  const selectedItemTags = React.useMemo(
    () => (Array.isArray(itemTags) ? itemTags.map((tag: unknown) => String(tag || '').trim().toLowerCase()) : []),
    [itemTags],
  );

  const toggleItemTag = React.useCallback(
    (tag: string) => {
      const normalized = String(tag || '').trim().toLowerCase();
      setItemTags((prev: string[]) => {
        const current = Array.isArray(prev) ? prev.map(value => String(value || '').trim().toLowerCase()).filter(Boolean) : [];
        if (current.includes(normalized)) {
          return current.filter(value => value !== normalized);
        }
        return [...current, normalized];
      });
    },
    [setItemTags],
  );

  const urlImageEntries = React.useMemo(
    () =>
      (Array.isArray(itemImageUrls) ? itemImageUrls : [])
        .map((url: unknown, index: number) => ({ index, value: String(url || '').trim() }))
        .filter(entry => Boolean(entry.value)),
    [itemImageUrls],
  );

  const selectedImageCount = (Array.isArray(itemImages) ? itemImages.length : 0) + urlImageEntries.length;
  const previewEntries = React.useMemo(
    () => [
      ...(Array.isArray(itemImages)
        ? itemImages.map((img: any) => ({
            id: img.id,
            uri: img.previewUri,
            onRemove: () => removeItemImage(img.id),
          }))
        : []),
      ...urlImageEntries.map(entry => ({
        id: `url_${entry.index}`,
        uri: entry.value,
        onRemove: () => removeItemImageUrlField(entry.index),
      })),
    ],
    [itemImages, removeItemImage, removeItemImageUrlField, urlImageEntries],
  );

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
      {moduleId === 'dashboard' && (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
          <View style={styles.grid}>
            <Stat label="Items" value={String(overview.itemsCount)} theme={theme} />
            <Stat label="Units" value={String(overview.totalUnits)} theme={theme} />
            <Stat label="Low Stock" value={String(overview.lowStockCount)} theme={theme} />
            <Stat label="Value" value={`Rs ${overview.inventoryValue.toFixed(2)}`} theme={theme} />
            <Stat label="Suppliers" value={String(overview.suppliersCount)} theme={theme} />
            <Stat label="Customers" value={String(overview.customersCount)} theme={theme} />
            <Stat label="Open Bills" value={String(overview.openBills)} theme={theme} />
            <Stat label="Open Invoices" value={String(overview.openInvoices)} theme={theme} />
          </View>
        </View>
      )}

      {moduleId === 'items' && (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <Text style={[styles.title, { color: theme.text }]}>Items</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.adminNavChip,
                styles.navSliderChip,
                isDarkMode
                  ? itemsView === 'form'
                    ? styles.adminNavChipDarkActive
                    : styles.adminNavChipDark
                  : itemsView === 'form'
                    ? styles.adminNavChipLightActive
                    : styles.adminNavChipLight,
              ]}
              onPress={() => setItemsView('form')}
            >
              <Text
                style={[
                  styles.adminNavChipText,
                  itemsView === 'form'
                    ? isDarkMode
                      ? styles.adminNavChipTextDarkActive
                      : styles.adminNavChipTextLightActive
                    : { color: theme.text },
                ]}
              >
                Item Form
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.adminNavChip,
                styles.navSliderChip,
                isDarkMode
                  ? itemsView === 'inventory'
                    ? styles.adminNavChipDarkActive
                    : styles.adminNavChipDark
                  : itemsView === 'inventory'
                    ? styles.adminNavChipLightActive
                    : styles.adminNavChipLight,
              ]}
              onPress={() => setItemsView('inventory')}
            >
              <Text
                style={[
                  styles.adminNavChipText,
                  itemsView === 'inventory'
                    ? isDarkMode
                      ? styles.adminNavChipTextDarkActive
                      : styles.adminNavChipTextLightActive
                    : { color: theme.text },
                ]}
              >
                Inventory
              </Text>
            </Pressable>
          </View>

          {itemsView === 'form' ? (
            <View style={[styles.form, { backgroundColor: theme.panelSoft }]}> 
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Item Name</Text>
              <TextInput value={itemName} onChangeText={setItemName} placeholder="Item Name*" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>HSN/SAC</Text>
              <TextInput value={itemSku} onChangeText={setItemSku} placeholder="HSN/SAC*" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Brand</Text>
              <View style={styles.brandInputWrap}>
                <TextInput
                  value={itemBrand}
                  onChangeText={value => handleBrandInputChange('create', value)}
                  onFocus={() => showBrandDropdown('create')}
                  onPressIn={() => showBrandDropdown('create')}
                  onBlur={() => scheduleCloseBrandDropdown('create')}
                  placeholder="Brand"
                  placeholderTextColor={theme.subtext}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                />
                {isCreateBrandDropdownVisible ? (
                  <ScrollView
                    style={[styles.brandDropdown, { backgroundColor: theme.panel, borderColor: theme.steel }]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator
                  >
                    {(filteredBrandOptions.length > 0 ? filteredBrandOptions : brandOptions).map(brand => (
                      <Pressable
                        key={`brand_${brand.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}
                        style={styles.brandDropdownItem}
                        onPressIn={clearBrandDropdownCloseTimer}
                        onPress={() => handleBrandSelect('create', brand)}
                      >
                        <Text style={[styles.brandDropdownText, { color: theme.text }]}>{brand}</Text>
                      </Pressable>
                    ))}
                    <View style={[styles.brandDropdownDivider, { backgroundColor: theme.steel }]} />
                    <Pressable
                      style={[styles.brandDropdownItem, styles.brandDropdownItemLast]}
                      onPressIn={clearBrandDropdownCloseTimer}
                      onPress={() => enableManualBrandEntry('create')}
                    >
                      <Text style={styles.brandDropdownManualText}>+ Manual Entry</Text>
                    </Pressable>
                  </ScrollView>
                ) : null}
              </View>
              <Picker
                label="Category"
                selectedId={itemCategory}
                options={categoryOptions}
                onSelect={setItemCategory}
                theme={theme}
              />
              <Picker
                label="Technology (Optional)"
                selectedId={itemTechnologyOption}
                options={technologyOptions}
                onSelect={setItemTechnologyOption}
                theme={theme}
                allowDeselect
              />
              <Picker
                label="Capacity (Ah) (Optional)"
                selectedId={capacityInputMode === 'manual' ? MANUAL_CAPACITY_OPTION_ID : itemCapacityAh || NO_CAPACITY_OPTION_ID}
                options={capacityOptions}
                onSelect={handleCapacitySelect}
                theme={theme}
              />
              {capacityInputMode === 'manual' ? (
                <>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Manual Capacity (Ah) (Optional)</Text>
                  <TextInput
                    value={manualCapacityValue}
                    onChangeText={handleManualCapacityChange}
                    placeholder="e.g. 135"
                    keyboardType="numeric"
                    placeholderTextColor={theme.subtext}
                    style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                  />
                </>
              ) : null}
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Tags (Optional)</Text>
              <View style={styles.itemTagRow}>
                {itemTagOptions.map(tag => {
                  const active = selectedItemTags.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      style={[
                        styles.itemTagChip,
                        { backgroundColor: active ? theme.primary : theme.steel, borderColor: active ? theme.primary : '#CBD5E1' },
                      ]}
                      onPress={() => toggleItemTag(tag.id)}
                    >
                      <Text style={[styles.itemTagChipText, { color: active ? '#FFFFFF' : theme.text }]}>{tag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Quantity</Text>
                  <TextInput value={itemQty} onChangeText={v => setItemQty(v.replace(/[^0-9]/g, ''))} placeholder="Qty" keyboardType="numeric" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Reorder Level</Text>
                  <TextInput value={itemReorder} onChangeText={v => setItemReorder(v.replace(/[^0-9]/g, ''))} placeholder="Reorder" keyboardType="numeric" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Purchase Price</Text>
                  <TextInput value={itemPurchasePrice} onChangeText={v => setItemPurchasePrice(v.replace(/[^0-9.]/g, ''))} placeholder="Purchase" keyboardType="decimal-pad" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Selling Price</Text>
                  <TextInput value={itemSellingPrice} onChangeText={v => setItemSellingPrice(v.replace(/[^0-9.]/g, ''))} placeholder="Selling" keyboardType="decimal-pad" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
                </View>
              </View>
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Item Images</Text>
              <View style={styles.rowBetween}>
                <Pressable style={[styles.itemImageUploadBtn, { backgroundColor: theme.steel }]} onPress={pickItemImages}>
                  <Text style={[styles.itemImageUploadBtnText, { color: theme.text }]}>Upload Images</Text>
                </Pressable>
                <Text style={[styles.small, { color: theme.subtext }]}>{selectedImageCount}/5 selected</Text>
              </View>
              <Text style={[styles.small, { color: theme.subtext }]}>Or add image URL (up to 5)</Text>
              {(Array.isArray(itemImageUrls) ? itemImageUrls : ['']).map((urlValue: string, index: number) => {
                const hasValue = String(urlValue || '').trim().length > 0;
                const isLast = index === (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) - 1;
                const canAdd = hasValue && isLast && selectedImageCount < 5 && (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) < 5;
                const canRemove = (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) > 1;
                return (
                  <View key={`item_url_${index}`} style={styles.itemUrlRow}>
                    <TextInput
                      value={urlValue}
                      onChangeText={value => setItemImageUrlValue(index, value)}
                      placeholder={`Image URL ${index + 1}`}
                      placeholderTextColor={theme.subtext}
                      style={[styles.input, styles.itemUrlInput, { color: theme.text, backgroundColor: theme.steel }]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {canAdd ? (
                      <Pressable style={[styles.itemUrlActionBtn, { backgroundColor: theme.steel }]} onPress={addItemImageUrlField}>
                        <Text style={[styles.itemUrlActionBtnText, { color: theme.text }]}>Add</Text>
                      </Pressable>
                    ) : null}
                    {canRemove ? (
                      <Pressable style={styles.itemUrlRemoveBtn} onPress={() => removeItemImageUrlField(index)}>
                        <Text style={styles.itemUrlRemoveBtnText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {previewEntries.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemImagePreviewRow}>
                  {previewEntries.map((entry: any) => (
                    <View key={entry.id} style={[styles.itemImagePreviewCard, { backgroundColor: theme.steel }]}>
                      <Image source={{ uri: entry.uri }} style={styles.itemImagePreviewImage} />
                      <Pressable style={styles.itemImageRemoveBtn} onPress={entry.onRemove}>
                        <Text style={styles.itemImageRemoveBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={[styles.small, { color: theme.subtext }]}>No images selected</Text>
              )}
              <Pressable style={[styles.primaryBtn, canEdit ? styles.orderSubmitBtn : styles.orderSubmitBtnDisabled]} onPress={createItem}>
                <Text style={[styles.primaryText, canEdit ? styles.orderSubmitBtnText : styles.orderSubmitBtnTextDisabled]}>
                  {isSaving ? 'Saving...' : 'Create Item'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.form, { backgroundColor: theme.panelSoft }]}>
              <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Search Items</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search inventory"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, backgroundColor: theme.panel }]}
              />
              <Text style={[styles.small, { color: theme.subtext }]}>
                {filteredItems.length} inventory item{filteredItems.length === 1 ? '' : 's'}
              </Text>
              {filteredItems.length === 0 ? (
                <Text style={[styles.small, { color: theme.subtext }]}>No items found.</Text>
              ) : (
                filteredItems.map((item: any) => {
                  const statusColor = item.status === 'In Stock' ? theme.accent : item.status === 'Low Stock' ? theme.warning : theme.danger;
                  const itemSummary = [item.brand || '—', item.category, item.technologyOption, item.capacityAh, `Qty ${item.qty}`]
                    .filter(Boolean)
                    .join(' • ');
                  return (
                    <View key={item.id} style={[styles.rowCard, { backgroundColor: theme.panel }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemText, { color: theme.text }]}>{`${item.name} (${item.sku})`}</Text>
                        <Text style={[styles.small, { color: theme.subtext }]}>{itemSummary}</Text>
                      </View>
                      <Text style={[styles.itemText, { color: statusColor }]}>{item.status}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pressable
                          style={styles.itemEditIconBtn}
                          onPress={() => openItemEditModal(item.id)}
                          disabled={!canEdit || isSaving}
                        >
                          <Text style={[styles.itemEditIconText, (!canEdit || isSaving) && styles.itemEditIconTextDisabled]}>✎</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.chip, { backgroundColor: canEdit ? '#B85C5C' : theme.steel, opacity: isSaving ? 0.72 : 1 }]}
                          onPress={() => deleteItem(item.id)}
                          disabled={!canEdit || isSaving}
                        >
                          <Text style={[styles.chipText, { color: canEdit ? '#FEE2E2' : theme.subtext }]}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
          <Modal
            visible={isItemEditModalVisible}
            animationType="fade"
            transparent
            onRequestClose={closeItemEditModal}
          >
            <View style={styles.profileEditBackdrop}>
              <View style={[styles.profileEditCard, styles.profileEditCardTall]}>
                <ScrollView
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.profileEditScrollContent}
                >
                  <Text style={styles.profileEditTitle}>Edit Item</Text>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Item Name</Text>
                  <TextInput
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="Item Name*"
                    placeholderTextColor={theme.subtext}
                    style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                  />
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>HSN/SAC</Text>
                  <TextInput
                    value={itemSku}
                    onChangeText={setItemSku}
                    placeholder="HSN/SAC*"
                    placeholderTextColor={theme.subtext}
                    style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                  />
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Brand</Text>
                  <View style={styles.brandInputWrap}>
                    <TextInput
                      value={itemBrand}
                      onChangeText={value => handleBrandInputChange('edit', value)}
                      onFocus={() => showBrandDropdown('edit')}
                      onPressIn={() => showBrandDropdown('edit')}
                      onBlur={() => scheduleCloseBrandDropdown('edit')}
                      placeholder="Brand"
                      placeholderTextColor={theme.subtext}
                      style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                    />
                    {isEditBrandDropdownVisible ? (
                      <ScrollView
                        style={[styles.brandDropdown, { backgroundColor: theme.panel, borderColor: theme.steel }]}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="always"
                        showsVerticalScrollIndicator
                      >
                        {(filteredBrandOptions.length > 0 ? filteredBrandOptions : brandOptions).map(brand => (
                          <Pressable
                            key={`brand_modal_${brand.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}
                            style={styles.brandDropdownItem}
                            onPressIn={clearBrandDropdownCloseTimer}
                            onPress={() => handleBrandSelect('edit', brand)}
                          >
                            <Text style={[styles.brandDropdownText, { color: theme.text }]}>{brand}</Text>
                          </Pressable>
                        ))}
                        <View style={[styles.brandDropdownDivider, { backgroundColor: theme.steel }]} />
                        <Pressable
                          style={[styles.brandDropdownItem, styles.brandDropdownItemLast]}
                          onPressIn={clearBrandDropdownCloseTimer}
                          onPress={() => enableManualBrandEntry('edit')}
                        >
                          <Text style={styles.brandDropdownManualText}>+ Manual Entry</Text>
                        </Pressable>
                      </ScrollView>
                    ) : null}
                  </View>
                  <Picker
                    label="Category"
                    selectedId={itemCategory}
                    options={categoryOptions}
                    onSelect={setItemCategory}
                    theme={theme}
                  />
                  <Picker
                    label="Technology (Optional)"
                    selectedId={itemTechnologyOption}
                    options={technologyOptions}
                    onSelect={setItemTechnologyOption}
                    theme={theme}
                    allowDeselect
                  />
                  <Picker
                    label="Capacity (Ah) (Optional)"
                    selectedId={capacityInputMode === 'manual' ? MANUAL_CAPACITY_OPTION_ID : itemCapacityAh || NO_CAPACITY_OPTION_ID}
                    options={capacityOptions}
                    onSelect={handleCapacitySelect}
                    theme={theme}
                  />
                  {capacityInputMode === 'manual' ? (
                    <>
                      <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Manual Capacity (Ah) (Optional)</Text>
                      <TextInput
                        value={manualCapacityValue}
                        onChangeText={handleManualCapacityChange}
                        placeholder="e.g. 135"
                        keyboardType="numeric"
                        placeholderTextColor={theme.subtext}
                        style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                      />
                    </>
                  ) : null}
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Tags (Optional)</Text>
                  <View style={styles.itemTagRow}>
                    {itemTagOptions.map(tag => {
                      const active = selectedItemTags.includes(tag.id);
                      return (
                        <Pressable
                          key={`modal_${tag.id}`}
                          style={[
                            styles.itemTagChip,
                            { backgroundColor: active ? theme.primary : theme.steel, borderColor: active ? theme.primary : '#CBD5E1' },
                          ]}
                          onPress={() => toggleItemTag(tag.id)}
                        >
                          <Text style={[styles.itemTagChipText, { color: active ? '#FFFFFF' : theme.text }]}>{tag.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Quantity</Text>
                      <TextInput
                        value={itemQty}
                        onChangeText={v => setItemQty(v.replace(/[^0-9]/g, ''))}
                        placeholder="Qty"
                        keyboardType="numeric"
                        placeholderTextColor={theme.subtext}
                        style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                      />
                    </View>
                    <View style={styles.half}>
                      <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Reorder Level</Text>
                      <TextInput
                        value={itemReorder}
                        onChangeText={v => setItemReorder(v.replace(/[^0-9]/g, ''))}
                        placeholder="Reorder"
                        keyboardType="numeric"
                        placeholderTextColor={theme.subtext}
                        style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Purchase Price</Text>
                      <TextInput
                        value={itemPurchasePrice}
                        onChangeText={v => setItemPurchasePrice(v.replace(/[^0-9.]/g, ''))}
                        placeholder="Purchase"
                        keyboardType="decimal-pad"
                        placeholderTextColor={theme.subtext}
                        style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                      />
                    </View>
                    <View style={styles.half}>
                      <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Selling Price</Text>
                      <TextInput
                        value={itemSellingPrice}
                        onChangeText={v => setItemSellingPrice(v.replace(/[^0-9.]/g, ''))}
                        placeholder="Selling"
                        keyboardType="decimal-pad"
                        placeholderTextColor={theme.subtext}
                        style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]}
                      />
                    </View>
                  </View>
                  <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Item Images</Text>
                  <View style={styles.rowBetween}>
                    <Pressable style={[styles.itemImageUploadBtn, { backgroundColor: theme.steel }]} onPress={pickItemImages}>
                      <Text style={[styles.itemImageUploadBtnText, { color: theme.text }]}>Upload Images</Text>
                    </Pressable>
                    <Text style={[styles.small, { color: theme.subtext }]}>{selectedImageCount}/5 selected</Text>
                  </View>
                  <Text style={[styles.small, { color: theme.subtext }]}>Or add image URL (up to 5)</Text>
                  {(Array.isArray(itemImageUrls) ? itemImageUrls : ['']).map((urlValue: string, index: number) => {
                    const hasValue = String(urlValue || '').trim().length > 0;
                    const isLast = index === (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) - 1;
                    const canAdd = hasValue && isLast && selectedImageCount < 5 && (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) < 5;
                    const canRemove = (Array.isArray(itemImageUrls) ? itemImageUrls.length : 1) > 1;
                    return (
                      <View key={`item_modal_url_${index}`} style={styles.itemUrlRow}>
                        <TextInput
                          value={urlValue}
                          onChangeText={value => setItemImageUrlValue(index, value)}
                          placeholder={`Image URL ${index + 1}`}
                          placeholderTextColor={theme.subtext}
                          style={[styles.input, styles.itemUrlInput, { color: theme.text, backgroundColor: theme.steel }]}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {canAdd ? (
                          <Pressable style={[styles.itemUrlActionBtn, { backgroundColor: theme.steel }]} onPress={addItemImageUrlField}>
                            <Text style={[styles.itemUrlActionBtnText, { color: theme.text }]}>Add</Text>
                          </Pressable>
                        ) : null}
                        {canRemove ? (
                          <Pressable style={styles.itemUrlRemoveBtn} onPress={() => removeItemImageUrlField(index)}>
                            <Text style={styles.itemUrlRemoveBtnText}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                  {previewEntries.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemImagePreviewRow}>
                      {previewEntries.map((entry: any) => (
                        <View key={`modal_preview_${entry.id}`} style={[styles.itemImagePreviewCard, { backgroundColor: theme.steel }]}>
                          <Image source={{ uri: entry.uri }} style={styles.itemImagePreviewImage} />
                          <Pressable style={styles.itemImageRemoveBtn} onPress={entry.onRemove}>
                            <Text style={styles.itemImageRemoveBtnText}>Remove</Text>
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={[styles.small, { color: theme.subtext }]}>No images selected</Text>
                  )}
                  <View style={styles.profileEditActions}>
                    <Pressable style={styles.profileEditCancelBtn} onPress={closeItemEditModal}>
                      <Text style={styles.profileEditCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.profileEditSaveBtn} onPress={createItem}>
                      <Text style={styles.profileEditSaveText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {(moduleId === 'suppliers' || moduleId === 'customers') && (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <Text style={[styles.title, { color: theme.text }]}>{moduleId === 'suppliers' ? 'Suppliers' : 'Customers'}</Text>
          <View style={[styles.form, { backgroundColor: theme.panelSoft }]}> 
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Name</Text>
            <TextInput value={partyName} onChangeText={setPartyName} placeholder="Name*" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Company</Text>
            <TextInput value={partyCompany} onChangeText={setPartyCompany} placeholder="Company" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Email</Text>
            <TextInput value={partyEmail} onChangeText={setPartyEmail} placeholder="Email" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Phone</Text>
            <TextInput value={partyPhone} onChangeText={setPartyPhone} placeholder="Phone" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>GSTIN</Text>
            <TextInput value={partyGstin} onChangeText={setPartyGstin} placeholder="GSTIN" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Pressable style={[styles.primaryBtn, canEdit ? styles.orderSubmitBtn : styles.orderSubmitBtnDisabled]} onPress={() => createParty(moduleId)}>
              <Text style={[styles.primaryText, canEdit ? styles.orderSubmitBtnText : styles.orderSubmitBtnTextDisabled]}>
                {isSaving ? 'Saving...' : `Add ${moduleId === 'suppliers' ? 'Supplier' : 'Customer'}`}
              </Text>
            </Pressable>
          </View>

          {(moduleId === 'suppliers' ? suppliers : customers).map((p: any) => (
            <View key={p.id} style={[styles.rowCard, { backgroundColor: theme.panelSoft }]}> 
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemText, { color: theme.text }]}>{p.name}</Text>
                <Text style={[styles.small, { color: theme.subtext }]}>{p.company || '-'} • {p.phone || '-'}</Text>
              </View>
              {canDeleteMaster ? (
                <Pressable style={[styles.chip, { backgroundColor: '#B85C5C' }]} onPress={() => deleteParty(moduleId, p.id)}>
                  <Text style={[styles.chipText, { color: '#FEE2E2' }]}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {(moduleId === 'purchases' || moduleId === 'sales' || moduleId === 'bills' || moduleId === 'invoices') && (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <Text style={[styles.title, { color: theme.text }]}> 
            {moduleId === 'purchases' ? 'Purchase Orders' : moduleId === 'sales' ? 'Sales Orders' : moduleId === 'bills' ? 'Bills' : 'Invoices'}
          </Text>

          <Picker
            label="Item"
            selectedId={selectedItemId}
            options={items.map((i: any) => ({ id: i.id, label: `${i.sku} • ${i.name}` }))}
            onSelect={setSelectedItemId}
            theme={theme}
          />
          {moduleId === 'bills' ? (
            <Picker label="Supplier" selectedId={selectedSupplierId} options={suppliers.map((s: any) => ({ id: s.id, label: s.name }))} onSelect={setSelectedSupplierId} theme={theme} />
          ) : null}
          {moduleId === 'invoices' ? (
            <Picker label="Customer" selectedId={selectedCustomerId} options={customers.map((c: any) => ({ id: c.id, label: c.name }))} onSelect={setSelectedCustomerId} theme={theme} />
          ) : null}

          <View style={[styles.form, { backgroundColor: theme.panelSoft }]}> 
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}> 
              {moduleId === 'purchases' ? 'Vendor' : moduleId === 'sales' ? 'Customer' : 'Reference Name'}
            </Text>
            <TextInput value={nameField} onChangeText={setNameField} placeholder={moduleId === 'purchases' ? 'Vendor' : moduleId === 'sales' ? 'Customer' : 'Reference Name'} placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Quantity</Text>
                <TextInput value={qty} onChangeText={v => setQty(v.replace(/[^0-9]/g, ''))} placeholder="Qty" keyboardType="numeric" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
              </View>
              <View style={styles.half}>
                <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}> 
                  {moduleId === 'purchases' || moduleId === 'bills' ? 'Unit Cost' : 'Unit Price'}
                </Text>
                <TextInput value={price} onChangeText={v => setPrice(v.replace(/[^0-9.]/g, ''))} placeholder={moduleId === 'purchases' || moduleId === 'bills' ? 'Unit Cost' : 'Unit Price'} keyboardType="decimal-pad" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
              </View>
            </View>
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Due / Expected Date</Text>
            <TextInput value={dueDate} onChangeText={setDueDate} placeholder="Due/Expected Date (YYYY-MM-DD)" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Pressable
              style={[
                styles.primaryBtn,
                canEdit ? styles.orderSubmitBtn : styles.orderSubmitBtnDisabled,
              ]}
              onPress={() =>
                createDocument(moduleId === 'purchases' ? 'purchase-orders' : moduleId === 'sales' ? 'sales-orders' : moduleId === 'bills' ? 'bills' : 'invoices')
              }
            >
              <Text style={[styles.primaryText, canEdit ? styles.orderSubmitBtnText : styles.orderSubmitBtnTextDisabled]}>
                {isSaving ? 'Saving...' : `Create ${moduleId === 'purchases' ? 'PO' : moduleId === 'sales' ? 'SO' : moduleId === 'bills' ? 'Bill' : 'Invoice'}`}
              </Text>
            </Pressable>
          </View>

          {(moduleId === 'purchases' ? purchaseOrders : moduleId === 'sales' ? salesOrders : moduleId === 'bills' ? bills : invoices).map((doc: any) => (
            <View key={doc.id} style={[styles.rowCard, { backgroundColor: theme.panelSoft }]}> 
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemText, { color: theme.text }]}>{doc.poNumber || doc.soNumber || doc.billNumber || doc.invoiceNumber}</Text>
                <Text style={[styles.small, { color: theme.subtext }]}>{doc.vendor || doc.customer || doc.supplierName || doc.customerName || '-'} • Rs {doc.total?.toFixed(2)}</Text>
                <Text style={[styles.small, { color: theme.subtext }]}>{doc.status}</Text>
              </View>
              {moduleId === 'purchases' && doc.status === 'Open' ? (
                <Pressable style={[styles.chip, { backgroundColor: theme.accent }]} onPress={() => executeAction(`/api/purchase-orders/${doc.id}/receive`)}><Text style={[styles.chipText, { color: '#052E16' }]}>Receive</Text></Pressable>
              ) : null}
              {moduleId === 'sales' && doc.status === 'Open' ? (
                <Pressable style={[styles.chip, { backgroundColor: theme.orange }]} onPress={() => executeAction(`/api/sales-orders/${doc.id}/fulfill`)}><Text style={[styles.chipText, { color: '#FFFFFF' }]}>Fulfill</Text></Pressable>
              ) : null}
              {moduleId === 'bills' && doc.status === 'Open' ? (
                <Pressable style={[styles.chip, { backgroundColor: theme.accent }]} onPress={() => executeAction(`/api/bills/${doc.id}/pay`)}><Text style={[styles.chipText, { color: '#052E16' }]}>Pay</Text></Pressable>
              ) : null}
              {moduleId === 'invoices' && doc.status === 'Open' ? (
                <Pressable style={[styles.chip, { backgroundColor: theme.primary }]} onPress={() => executeAction(`/api/invoices/${doc.id}/receive-payment`)}><Text style={[styles.chipText, { color: '#0B1220' }]}>Receive</Text></Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {moduleId === 'stock' && (
        <View style={[styles.card, { backgroundColor: theme.panel }]}> 
          <Text style={[styles.title, { color: theme.text }]}>Stock Adjustments</Text>
          <Picker
            label="Item"
            selectedId={selectedItemId}
            options={items.map((i: any) => ({ id: i.id, label: `${i.sku} • Qty ${i.qty}` }))}
            onSelect={setSelectedItemId}
            theme={theme}
          />
          <View style={[styles.form, { backgroundColor: theme.panelSoft }]}> 
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Adjustment Delta</Text>
            <TextInput value={adjustDelta} onChangeText={setAdjustDelta} placeholder="Delta (+/-)" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Text style={[styles.small, styles.fieldLabel, { color: theme.subtext }]}>Reason</Text>
            <TextInput value={adjustReason} onChangeText={setAdjustReason} placeholder="Reason" placeholderTextColor={theme.subtext} style={[styles.input, { color: theme.text, backgroundColor: theme.steel }]} />
            <Pressable style={[styles.primaryBtn, canEdit ? styles.orderSubmitBtn : styles.orderSubmitBtnDisabled]} onPress={postAdjustment}>
              <Text style={[styles.primaryText, canEdit ? styles.orderSubmitBtnText : styles.orderSubmitBtnTextDisabled]}>
                {isSaving ? 'Saving...' : 'Post Adjustment'}
              </Text>
            </Pressable>
          </View>

          {movements.map((m: any) => (
            <ListRow
              key={m.id}
              left={m.itemName}
              sub={`${m.type} • ${m.reason}`}
              right={`${m.delta >= 0 ? '+' : ''}${m.delta}`}
              rightColor={m.delta >= 0 ? theme.accent : theme.danger}
              theme={theme}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export default AdminModuleContent;
