import {
  applyItemCapacitySelection,
  resolveItemCapacityInputMode,
} from '../src/app/utils/itemCapacity';

const presetValues = ['110Ah', '120Ah', '150Ah', '200Ah', '220Ah'];

describe('item capacity selection', () => {
  test('resolves empty value as not set', () => {
    expect(resolveItemCapacityInputMode('', presetValues)).toBe('not_set');
  });

  test('resolves preset values even with different casing or spaces', () => {
    expect(resolveItemCapacityInputMode(' 150AH ', presetValues)).toBe('preset');
  });

  test('resolves non-preset values as manual', () => {
    expect(resolveItemCapacityInputMode('135Ah', presetValues)).toBe('manual');
  });

  test('switches from not set to manual without losing manual mode', () => {
    expect(
      applyItemCapacitySelection('', '__manual_capacity__', presetValues, {
        manualOptionId: '__manual_capacity__',
        noCapacityOptionId: '__no_capacity__',
      }),
    ).toEqual({
      mode: 'manual',
      value: '',
    });
  });

  test('clears preset value when manual is selected', () => {
    expect(
      applyItemCapacitySelection('150Ah', '__manual_capacity__', presetValues, {
        manualOptionId: '__manual_capacity__',
        noCapacityOptionId: '__no_capacity__',
      }),
    ).toEqual({
      mode: 'manual',
      value: '',
    });
  });

  test('preserves existing manual value when manual stays selected', () => {
    expect(
      applyItemCapacitySelection('135Ah', '__manual_capacity__', presetValues, {
        manualOptionId: '__manual_capacity__',
        noCapacityOptionId: '__no_capacity__',
      }),
    ).toEqual({
      mode: 'manual',
      value: '135Ah',
    });
  });
});
