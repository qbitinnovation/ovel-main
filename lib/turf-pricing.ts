export type TurfPriceType = 'normal' | 'regular';
export type TurfDayType = 'all_days' | 'weekdays' | 'weekends';

export interface TurfHoliday {
  date: string;
  name: string;
  normalPricePerHour: number;
  regularPricePerHour?: number;
}

export interface TurfSlotPriceRule {
  id?: string;
  name?: string;
  startTime: string;
  endTime: string;
  priceType?: TurfPriceType;
  pricePerHour?: number;
  normalPricePerHour: number;
  regularPricePerHour?: number;
  dayType: TurfDayType;
  isActive: boolean;
}

export interface TurfPricingConfig {
  weekdayRules: TurfSlotPriceRule[];
  weekendRules: TurfSlotPriceRule[];
  holidays: TurfHoliday[];
  weekendDays: number[];
}

export interface TurfPricingResult {
  amount: number;
  durationHours: number;
  priceType: TurfPriceType;
  isHoliday: boolean;
  isWeekend: boolean;
  appliedRules: Array<{
    name: string;
    startTime: string;
    endTime: string;
    ruleStartTime?: string;
    ruleEndTime?: string;
    minutes: number;
    rate: number;
    amount: number;
    dayType: TurfDayType;
  }>;
}

export const DEFAULT_TURF_SLOT_PRICE_RULES: TurfSlotPriceRule[] = [];

export const DEFAULT_TURF_PRICING_CONFIG: TurfPricingConfig = {
  weekdayRules: [],
  weekendRules: [],
  holidays: [],
  weekendDays: [0, 6],
};

export function normalizeTurfPriceType(value: unknown): TurfPriceType {
  return value === 'regular' ? 'regular' : 'normal';
}

export function normalizeSlotPriceRules(value: unknown): TurfSlotPriceRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rule, index) => {
      const item = rule as Record<string, unknown>;
      const legacyPrice = Number(item.pricePerHour ?? item.price ?? 0);
      const legacyPriceType = normalizeTurfPriceType(item.priceType);
      const normalPrice = Number(item.normalPricePerHour ?? (legacyPriceType === 'normal' ? legacyPrice : 0));
      const regularPrice = Number(item.regularPricePerHour ?? (legacyPriceType === 'regular' ? legacyPrice : 0));
      const dayType: TurfDayType = item.dayType === 'weekdays' || item.dayType === 'weekends' || item.dayType === 'weekends_holidays' ? (item.dayType === 'weekends_holidays' ? 'weekends' : item.dayType as TurfDayType) : 'all_days';
      return {
        id: typeof item.id === 'string' ? item.id : `rule-${index + 1}`,
        name: typeof item.name === 'string' ? item.name : `Rule ${index + 1}`,
        startTime: typeof item.startTime === 'string' ? item.startTime : '00:00',
        endTime: typeof item.endTime === 'string' ? item.endTime : '01:00',
        priceType: legacyPriceType,
        pricePerHour: Number.isFinite(legacyPrice) ? legacyPrice : 0,
        normalPricePerHour: Number.isFinite(normalPrice) ? normalPrice : 0,
        regularPricePerHour: Number.isFinite(regularPrice) ? regularPrice : 0,
        dayType,
        isActive: item.isActive !== false,
      };
    })
    .filter((rule) => (
      isTimeValue(rule.startTime) &&
      isTimeValue(rule.endTime) &&
      (rule.normalPricePerHour > 0 || Number(rule.regularPricePerHour || 0) > 0)
    ));
}

export function calculateTurfSlotPrice(args: {
  bookingDate: string | Date;
  startTime: string;
  endTime: string;
  priceType?: TurfPriceType;
  weekdayRules?: TurfSlotPriceRule[];
  weekendRules?: TurfSlotPriceRule[];
  holidays?: TurfHoliday[];
  weekendDays?: number[];
}): TurfPricingResult {
  const priceType = normalizeTurfPriceType(args.priceType);
  const dateKey = toDateKey(args.bookingDate);
  const bookingDate = parseDateOnly(dateKey);
  const day = bookingDate.getDay();
  const isWeekend = (args.weekendDays || [0, 6]).includes(day);
  const holiday = (args.holidays || []).find((h) => h.date === dateKey);
  const isHoliday = !!holiday;
  const start = toMinutes(args.startTime);
  const end = toMinutes(args.endTime);

  if (start === null || end === null || start >= end) {
    throw new Error('Invalid booking time range');
  }

  const appliedRules: TurfPricingResult['appliedRules'] = [];
  let amount = 0;

  if (isHoliday) {
    const minutes = end - start;
    const rate = priceType === 'regular' 
      ? Number(holiday.regularPricePerHour || holiday.normalPricePerHour || 0) 
      : Number(holiday.normalPricePerHour || 0);
    
    amount = (rate * minutes) / 60;
    appliedRules.push({
      name: holiday.name || 'Holiday Rule',
      startTime: args.startTime,
      endTime: args.endTime,
      minutes,
      rate,
      amount: Math.round(amount),
      dayType: 'all_days',
    });

    return {
      amount: Math.round(amount),
      durationHours: minutes / 60,
      priceType,
      isHoliday,
      isWeekend,
      appliedRules,
    };
  }

  const primaryRules = normalizeSlotPriceRules(isWeekend ? args.weekendRules : args.weekdayRules);
  const fallbackRules = normalizeSlotPriceRules(isWeekend ? args.weekdayRules : args.weekendRules)
    .map((rule) => ({ ...rule, dayType: 'all_days' as TurfDayType }));
  const activeRules = [...primaryRules, ...fallbackRules].filter((rule) => rule.isActive && getRuleRate(rule, priceType) > 0);
  let cursor = start;

  while (cursor < end) {
    const matchingRule = findBestRule(activeRules, cursor, isWeekend);
    if (!matchingRule) {
      const futureRules = activeRules.filter(r => {
        const ruleStart = toMinutes(r.startTime);
        return ruleStart !== null && ruleStart > cursor;
      });
      const nextStart = futureRules.length > 0 
        ? Math.min(...futureRules.map(r => toMinutes(r.startTime)!))
        : end;
      
      const segmentEnd = Math.min(end, nextStart);
      const minutes = Math.max(0, segmentEnd - cursor);
      
      appliedRules.push({
        name: 'Unmapped Slot',
        startTime: formatMinutesToTime(cursor),
        endTime: formatMinutesToTime(segmentEnd),
        minutes,
        rate: 0,
        amount: 0,
        dayType: isWeekend ? 'weekends' : 'weekdays',
      });
      
      cursor = segmentEnd;
      continue;
    }

    const segmentEnd = Math.min(end, nextRuleBoundary(matchingRule, cursor));
    const minutes = Math.max(0, segmentEnd - cursor);
    const rate = getRuleRate(matchingRule, priceType);
    const segmentAmount = Math.round((rate * minutes) / 60);
    amount += segmentAmount;
    appliedRules.push({
      name: matchingRule.name || 'Slot Rule',
      startTime: formatMinutesToTime(cursor),
      endTime: formatMinutesToTime(segmentEnd),
      ruleStartTime: matchingRule.startTime,
      ruleEndTime: matchingRule.endTime,
      minutes,
      rate,
      amount: segmentAmount,
      dayType: matchingRule.dayType,
    });
    cursor = segmentEnd;
  }

  return {
    amount: Math.round(amount),
    durationHours: (end - start) / 60,
    priceType,
    isHoliday,
    isWeekend,
    appliedRules,
  };
}

export function toMinutes(time: string) {
  if (!isTimeValue(time)) return null;
  if (time === '23:59') return 24 * 60;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes: number): string {
  if (minutes >= 24 * 60) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function findBestRule(rules: TurfSlotPriceRule[], minute: number, isWeekend: boolean) {
  const candidates = rules.filter((rule) => ruleMatchesMinute(rule, minute, isWeekend));
  const priority: Record<TurfDayType, number> = {
    weekends: isWeekend ? 3 : 0,
    weekdays: isWeekend ? 0 : 3,
    all_days: 1,
  };
  return candidates.sort((a, b) => priority[b.dayType] - priority[a.dayType])[0] || null;
}

function ruleMatchesMinute(rule: TurfSlotPriceRule, minute: number, isWeekend: boolean) {
  if (rule.dayType === 'weekdays' && isWeekend) return false;
  if (rule.dayType === 'weekends' && !isWeekend) return false;

  const start = toMinutes(rule.startTime);
  const end = toMinutes(rule.endTime);
  if (start === null || end === null) return false;
  const normalizedEnd = end === 0 ? 24 * 60 : end;
  return minute >= start && minute < normalizedEnd;
}

function nextRuleBoundary(rule: TurfSlotPriceRule, currentMinute: number) {
  const end = toMinutes(rule.endTime);
  const normalizedEnd = end === 0 ? 24 * 60 : end || currentMinute + 1;
  return Math.max(currentMinute + 1, normalizedEnd);
}

function getRuleRate(rule: TurfSlotPriceRule, priceType: TurfPriceType) {
  if (priceType === 'regular') return Number(rule.regularPricePerHour || 0);
  return Number(rule.normalPricePerHour || 0);
}

function isTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function toDateKey(value: string | Date) {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value.includes('T') ? value.split('T')[0] : value;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
