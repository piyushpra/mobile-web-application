import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Animated } from 'react-native';

import AdminModuleContent from '../src/app/components/admin/AdminModuleContent';
import { theme } from '../src/app/constants';

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    moduleId: 'items',
    theme,
    fade: new Animated.Value(1),
    rise: new Animated.Value(0),
    overview: {
      itemsCount: 0,
      totalUnits: 0,
      lowStockCount: 0,
      inventoryValue: 0,
      pendingPurchaseOrders: 0,
      pendingSalesOrders: 0,
      movementCount: 0,
      suppliersCount: 0,
      customersCount: 0,
      openBills: 0,
      openInvoices: 0,
    },
    itemName: '',
    setItemName: jest.fn(),
    itemSku: '',
    setItemSku: jest.fn(),
    itemBrand: '',
    setItemBrand: jest.fn(),
    itemCategory: 'Inverter',
    setItemCategory: jest.fn(),
    itemTechnologyOption: 'Sinewave',
    setItemTechnologyOption: jest.fn(),
    itemCapacityAh: '',
    setItemCapacityAh: jest.fn(),
    itemDraftVersion: 0,
    itemQty: '1',
    setItemQty: jest.fn(),
    itemReorder: '8',
    setItemReorder: jest.fn(),
    itemPurchasePrice: '0',
    setItemPurchasePrice: jest.fn(),
    itemSellingPrice: '0',
    setItemSellingPrice: jest.fn(),
    itemTags: [],
    setItemTags: jest.fn(),
    itemImages: [],
    itemImageUrls: [''],
    pickItemImages: jest.fn(),
    removeItemImage: jest.fn(),
    setItemImageUrlValue: jest.fn(),
    addItemImageUrlField: jest.fn(),
    removeItemImageUrlField: jest.fn(),
    createItem: jest.fn(),
    editingItemId: 'inv_1',
    isItemEditModalVisible: false,
    openItemEditModal: jest.fn(),
    closeItemEditModal: jest.fn(),
    canEdit: true,
    isSaving: false,
    search: '',
    setSearch: jest.fn(),
    filteredItems: [],
    partyName: '',
    setPartyName: jest.fn(),
    partyCompany: '',
    setPartyCompany: jest.fn(),
    partyEmail: '',
    setPartyEmail: jest.fn(),
    partyPhone: '',
    setPartyPhone: jest.fn(),
    partyGstin: '',
    setPartyGstin: jest.fn(),
    createParty: jest.fn(),
    suppliers: [],
    customers: [],
    canDeleteMaster: true,
    deleteParty: jest.fn(),
    deleteItem: jest.fn(),
    selectedItemId: '',
    setSelectedItemId: jest.fn(),
    items: [],
    selectedSupplierId: '',
    setSelectedSupplierId: jest.fn(),
    selectedCustomerId: '',
    setSelectedCustomerId: jest.fn(),
    nameField: '',
    setNameField: jest.fn(),
    qty: '1',
    setQty: jest.fn(),
    price: '0',
    setPrice: jest.fn(),
    dueDate: '',
    setDueDate: jest.fn(),
    createDocument: jest.fn(),
    purchaseOrders: [],
    salesOrders: [],
    bills: [],
    invoices: [],
    executeAction: jest.fn(),
    adjustDelta: '1',
    setAdjustDelta: jest.fn(),
    adjustReason: 'Manual adjustment',
    setAdjustReason: jest.fn(),
    postAdjustment: jest.fn(),
    movements: [],
    ...overrides,
  };
}

function findPressableByText(root: ReactTestRenderer.ReactTestInstance, label: string) {
  const textNode = root.findAll(node => node.props?.children === label)[0];
  let current: ReactTestRenderer.ReactTestInstance | null = textNode || null;

  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }

  return current;
}

describe('AdminModuleContent capacity picker', () => {
  test('opens manual Ah input after switching from not set to manual', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AdminModuleContent {...createProps()} />);
    });

    const manualChip = findPressableByText(renderer.root, 'Manual Ah');

    expect(manualChip).toBeTruthy();
    expect(renderer.root.findAllByProps({ placeholder: 'e.g. 135' })).toHaveLength(0);

    ReactTestRenderer.act(() => {
      manualChip?.props.onPress();
    });

    expect(renderer.root.findAllByProps({ placeholder: 'e.g. 135' }).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
  });

  test('resets manual Ah input when parent loads a fresh blank draft', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AdminModuleContent {...createProps()} />);
    });

    const manualChip = findPressableByText(renderer.root, 'Manual Ah');

    ReactTestRenderer.act(() => {
      manualChip?.props.onPress();
    });

    expect(renderer.root.findAllByProps({ placeholder: 'e.g. 135' }).length).toBeGreaterThan(0);

    ReactTestRenderer.act(() => {
      renderer.update(<AdminModuleContent {...createProps({ itemDraftVersion: 1 })} />);
    });

    expect(renderer.root.findAllByProps({ placeholder: 'e.g. 135' })).toHaveLength(0);

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
  });
});
