export type ItemCapacityInputMode = 'not_set' | 'preset' | 'manual';

type CapacityOptionIds = {
  manualOptionId: string;
  noCapacityOptionId: string;
};

type CapacitySelectionResult = {
  mode: ItemCapacityInputMode;
  value: string;
};

function normalizeCapacityKey(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function resolveItemCapacityInputMode(value: unknown, presetValues: readonly string[]): ItemCapacityInputMode {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'not_set';
  }

  const normalizedValue = normalizeCapacityKey(raw);
  const isPreset = presetValues.some(option => normalizeCapacityKey(option) === normalizedValue);
  return isPreset ? 'preset' : 'manual';
}

export function applyItemCapacitySelection(
  currentValue: unknown,
  selectedId: string,
  presetValues: readonly string[],
  optionIds: CapacityOptionIds,
): CapacitySelectionResult {
  if (!selectedId || selectedId === optionIds.noCapacityOptionId) {
    return { mode: 'not_set', value: '' };
  }

  if (selectedId === optionIds.manualOptionId) {
    const mode = resolveItemCapacityInputMode(currentValue, presetValues);
    return {
      mode: 'manual',
      value: mode === 'manual' ? String(currentValue || '').trim() : '',
    };
  }

  return {
    mode: 'preset',
    value: String(selectedId || '').trim(),
  };
}
