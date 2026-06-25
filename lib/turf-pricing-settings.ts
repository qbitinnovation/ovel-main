import SystemSettings, { DEFAULT_SETTINGS } from '@/models/SystemSettings';
import { type TurfHoliday, type TurfPricingConfig, type AllFacilitiesPricingConfig, normalizeSlotPriceRules } from '@/lib/turf-pricing';
import { createDevId, getDevStore } from '@/lib/dev-store';

const PRICING_SETTING_KEYS = [
  'turf_slot_price_rules',
  'turf_weekday_rules',
  'turf_weekend_rules',
  'nets_machine_weekday_rules',
  'nets_machine_weekend_rules',
  'nets_nomachine_weekday_rules',
  'nets_nomachine_weekend_rules',
  'lounge_hourly_rate',
  'turf_holidays',
  'nets_machine_holidays',
  'nets_nomachine_holidays',
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

export function getDevAllFacilitiesPricingConfig(): AllFacilitiesPricingConfig {
  const settings = ensureDevBookingSettings();
  const map = new Map(settings.map((setting) => [setting.key, setting.value]));
  const slotRulesValue = map.get('turf_slot_price_rules');
  const turfWeekdayRulesValue = map.get('turf_weekday_rules');
  const turfWeekendRulesValue = map.get('turf_weekend_rules');
  const netsMachineWeekdayRulesValue = map.get('nets_machine_weekday_rules');
  const netsMachineWeekendRulesValue = map.get('nets_machine_weekend_rules');
  const netsNoMachineWeekdayRulesValue = map.get('nets_nomachine_weekday_rules');
  const netsNoMachineWeekendRulesValue = map.get('nets_nomachine_weekend_rules');
  const loungeHourlyRateValue = map.get('lounge_hourly_rate');
  const turfHolidaysValue = map.get('turf_holidays');
  const netsMachineHolidaysValue = map.get('nets_machine_holidays');
  const netsNoMachineHolidaysValue = map.get('nets_nomachine_holidays');
  const weekendDaysValue = map.get('turf_weekend_days');

  let turfWeekdayRules = normalizeSlotPriceRules(turfWeekdayRulesValue);
  let turfWeekendRules = normalizeSlotPriceRules(turfWeekendRulesValue);

  if (turfWeekdayRules.length === 0 && turfWeekendRules.length === 0 && slotRulesValue) {
    const legacyRules = normalizeSlotPriceRules(slotRulesValue);
    turfWeekdayRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekdays');
    turfWeekendRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekends');
  }

  const turfHolidays = Array.isArray(turfHolidaysValue) ? turfHolidaysValue as import('@/lib/turf-pricing').TurfHoliday[] : [];
  const netsMachineHolidays = Array.isArray(netsMachineHolidaysValue) ? netsMachineHolidaysValue as import('@/lib/turf-pricing').TurfHoliday[] : [];
  const netsNoMachineHolidays = Array.isArray(netsNoMachineHolidaysValue) ? netsNoMachineHolidaysValue as import('@/lib/turf-pricing').TurfHoliday[] : [];
  const weekendDays = Array.isArray(weekendDaysValue) ? (weekendDaysValue as number[]) : [0, 6];

  return {
    turf: {
      weekdayRules: turfWeekdayRules,
      weekendRules: turfWeekendRules,
      holidays: turfHolidays,
      weekendDays,
    },
    nets_with_machine: {
      weekdayRules: normalizeSlotPriceRules(netsMachineWeekdayRulesValue),
      weekendRules: normalizeSlotPriceRules(netsMachineWeekendRulesValue),
      holidays: netsMachineHolidays,
      weekendDays,
    },
    nets_without_machine: {
      weekdayRules: normalizeSlotPriceRules(netsNoMachineWeekdayRulesValue),
      weekendRules: normalizeSlotPriceRules(netsNoMachineWeekendRulesValue),
      holidays: netsNoMachineHolidays,
      weekendDays,
    },
    loungeHourlyRate: Number(loungeHourlyRateValue) || 0,
  };
}

export async function getAllFacilitiesPricingConfig(): Promise<AllFacilitiesPricingConfig> {
  const settings = await SystemSettings.find({
    key: {
      $in: PRICING_SETTING_KEYS,
    },
  }).lean();

  const map = new Map(settings.map((setting) => [setting.key, setting.value]));
  const slotRulesValue = map.get('turf_slot_price_rules');
  const turfWeekdayRulesValue = map.get('turf_weekday_rules');
  const turfWeekendRulesValue = map.get('turf_weekend_rules');
  const netsMachineWeekdayRulesValue = map.get('nets_machine_weekday_rules');
  const netsMachineWeekendRulesValue = map.get('nets_machine_weekend_rules');
  const netsNoMachineWeekdayRulesValue = map.get('nets_nomachine_weekday_rules');
  const netsNoMachineWeekendRulesValue = map.get('nets_nomachine_weekend_rules');
  const loungeHourlyRateValue = map.get('lounge_hourly_rate');
  const turfHolidaysValue = map.get('turf_holidays');
  const netsMachineHolidaysValue = map.get('nets_machine_holidays');
  const netsNoMachineHolidaysValue = map.get('nets_nomachine_holidays');
  const weekendDaysValue = map.get('turf_weekend_days');

  let turfWeekdayRules = normalizeSlotPriceRules(turfWeekdayRulesValue);
  let turfWeekendRules = normalizeSlotPriceRules(turfWeekendRulesValue);
  let usedLegacyRules = false;

  if (turfWeekdayRules.length === 0 && turfWeekendRules.length === 0 && slotRulesValue) {
    const legacyRules = normalizeSlotPriceRules(slotRulesValue);
    turfWeekdayRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekdays');
    turfWeekendRules = legacyRules.filter((r) => r.dayType === 'all_days' || r.dayType === 'weekends');
    usedLegacyRules = true;
  }

  if (!usedLegacyRules && !map.has('turf_weekday_rules')) {
    turfWeekdayRules = normalizeSlotPriceRules(getDefaultSettingValue('turf_weekday_rules'));
  }

  if (!usedLegacyRules && !map.has('turf_weekend_rules')) {
    turfWeekendRules = normalizeSlotPriceRules(getDefaultSettingValue('turf_weekend_rules'));
  }

  const turfHolidays = Array.isArray(turfHolidaysValue) ? turfHolidaysValue as TurfHoliday[] : getDefaultHolidays();
  const netsMachineHolidays = Array.isArray(netsMachineHolidaysValue) ? netsMachineHolidaysValue as TurfHoliday[] : getDefaultHolidays();
  const netsNoMachineHolidays = Array.isArray(netsNoMachineHolidaysValue) ? netsNoMachineHolidaysValue as TurfHoliday[] : getDefaultHolidays();
  const weekendDays = Array.isArray(weekendDaysValue) ? (weekendDaysValue as number[]) : getDefaultWeekendDays();

  return {
    turf: {
      weekdayRules: turfWeekdayRules,
      weekendRules: turfWeekendRules,
      holidays: turfHolidays,
      weekendDays,
    },
    nets_with_machine: {
      weekdayRules: normalizeSlotPriceRules(netsMachineWeekdayRulesValue) || normalizeSlotPriceRules(getDefaultSettingValue('nets_machine_weekday_rules')),
      weekendRules: normalizeSlotPriceRules(netsMachineWeekendRulesValue) || normalizeSlotPriceRules(getDefaultSettingValue('nets_machine_weekend_rules')),
      holidays: netsMachineHolidays,
      weekendDays,
    },
    nets_without_machine: {
      weekdayRules: normalizeSlotPriceRules(netsNoMachineWeekdayRulesValue) || normalizeSlotPriceRules(getDefaultSettingValue('nets_nomachine_weekday_rules')),
      weekendRules: normalizeSlotPriceRules(netsNoMachineWeekendRulesValue) || normalizeSlotPriceRules(getDefaultSettingValue('nets_nomachine_weekend_rules')),
      holidays: netsNoMachineHolidays,
      weekendDays,
    },
    loungeHourlyRate: Number(loungeHourlyRateValue) || Number(getDefaultSettingValue('lounge_hourly_rate')) || 0,
  };
}
