import SystemSettings, { DEFAULT_SETTINGS } from '@/models/SystemSettings';
import { type TurfHoliday, type TurfPricingConfig, normalizeSlotPriceRules } from '@/lib/turf-pricing';
import { createDevId, getDevStore } from '@/lib/dev-store';

const PRICING_SETTING_KEYS = [
  'turf_slot_price_rules',
  'turf_weekday_rules',
  'turf_weekend_rules',
  'turf_holidays',
  'turf_weekend_days',
] as const;

function getDefaultSettingValue(key: string) {
  return DEFAULT_SETTINGS.find((setting) => setting.key === key)?.value;
}

function getDefaultHolidays(): TurfHoliday[] {
  const value = getDefaultSettingValue('turf_holidays');
  return Array.isArray(value) ? (value as unknown as TurfHoliday[]) : [];
}

function getDefaultWeekendDays(): number[] {
  const value = getDefaultSettingValue('turf_weekend_days');
  if (!Array.isArray(value)) return [0, 6];

  const days = value.filter((day): day is number => typeof day === 'number');
  return days.length > 0 ? days : [0, 6];
}

function ensureDevBookingSettings() {
  const store = getDevStore();
  const now = new Date().toISOString();

  for (const def of DEFAULT_SETTINGS) {
    if (def.category !== 'bookings') continue;
    if (!store.settings.some((setting) => setting.key === def.key)) {
      store.settings.push({
        _id: createDevId('setting'),
        key: def.key,
        value: def.value,
        label: def.label,
        category: def.category,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return store.settings;
}

export function getDevTurfPricingConfig(): TurfPricingConfig {
  const settings = ensureDevBookingSettings();
  const map = new Map(settings.map((setting) => [setting.key, setting.value]));
  const slotRulesValue = map.get('turf_slot_price_rules');
  const weekdayRulesValue = map.get('turf_weekday_rules');
  const weekendRulesValue = map.get('turf_weekend_rules');
  const holidaysValue = map.get('turf_holidays');
  const weekendDaysValue = map.get('turf_weekend_days');

  let weekdayRules = normalizeSlotPriceRules(weekdayRulesValue);
  let weekendRules = normalizeSlotPriceRules(weekendRulesValue);

  if (weekdayRules.length === 0 && weekendRules.length === 0 && slotRulesValue) {
    const legacyRules = normalizeSlotPriceRules(slotRulesValue);
    weekdayRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekdays');
    weekendRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekends');
  }

  return {
    weekdayRules,
    weekendRules,
    holidays: Array.isArray(holidaysValue) ? holidaysValue as import('@/lib/turf-pricing').TurfHoliday[] : [],
    weekendDays: Array.isArray(weekendDaysValue) ? (weekendDaysValue as number[]) : [0, 6],
  };
}

export async function getTurfPricingConfig(): Promise<TurfPricingConfig> {
  const settings = await SystemSettings.find({
    key: {
      $in: PRICING_SETTING_KEYS,
    },
  }).lean();

  const map = new Map(settings.map((setting) => [setting.key, setting.value]));
  const slotRulesValue = map.get('turf_slot_price_rules');
  const weekdayRulesValue = map.get('turf_weekday_rules');
  const weekendRulesValue = map.get('turf_weekend_rules');
  const holidaysValue = map.get('turf_holidays');
  const weekendDaysValue = map.get('turf_weekend_days');

  let weekdayRules = normalizeSlotPriceRules(weekdayRulesValue);
  let weekendRules = normalizeSlotPriceRules(weekendRulesValue);
  let usedLegacyRules = false;

  if (weekdayRules.length === 0 && weekendRules.length === 0 && slotRulesValue) {
    const legacyRules = normalizeSlotPriceRules(slotRulesValue);
    weekdayRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekdays');
    weekendRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekends');
    usedLegacyRules = true;
  }

  if (!usedLegacyRules && !map.has('turf_weekday_rules')) {
    weekdayRules = normalizeSlotPriceRules(getDefaultSettingValue('turf_weekday_rules'));
  }

  if (!usedLegacyRules && !map.has('turf_weekend_rules')) {
    weekendRules = normalizeSlotPriceRules(getDefaultSettingValue('turf_weekend_rules'));
  }

  return {
    weekdayRules,
    weekendRules,
    holidays: Array.isArray(holidaysValue) ? holidaysValue as TurfHoliday[] : getDefaultHolidays(),
    weekendDays: Array.isArray(weekendDaysValue) ? (weekendDaysValue as number[]) : getDefaultWeekendDays(),
  };
}
