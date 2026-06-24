export interface ExistingBooking {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: 'confirmed' | 'cancelled';
  bookingType?: 'standard' | 'bulk';
  slots?: { bookingDate: string | Date; startTime: string; endTime: string }[];
}

export function toMinutes(time: string) {
  if (time === '23:59') return 24 * 60;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function toTimeValue(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const normalizedHours = time === '23:59' ? 23 : hours;
  const ampm = normalizedHours >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const startMinutes = index * 30;
  const endMinutes = startMinutes + 30;
  const start = toTimeValue(startMinutes);
  const end = endMinutes >= 24 * 60 ? '23:59' : toTimeValue(endMinutes);
  return {
    start,
    end,
    label: formatTime(start),
  };
});

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMinutes = toMinutes(aStart);
  const aEndMinutes = toMinutes(aEnd);
  const bStartMinutes = toMinutes(bStart);
  const bEndMinutes = toMinutes(bEnd);
  return aStartMinutes < bEndMinutes && bStartMinutes < aEndMinutes;
}

export function isSlotBooked(
  date: string,
  startTime: string,
  endTime: string,
  bookedByDate: Record<string, ExistingBooking[]>,
  ignoreBookingId?: string
) {
  return (bookedByDate[date] || []).some((booking) => {
    if (booking.bookingStatus !== 'confirmed') return false;
    if (ignoreBookingId && booking._id === ignoreBookingId) return false;
    
    if (booking.bookingType === 'bulk' && booking.slots && Array.isArray(booking.slots)) {
      return booking.slots.some((slot: any) => {
        if (getDateStr(slot.bookingDate) !== date) return false;
        return rangesOverlap(startTime, endTime, slot.startTime, slot.endTime);
      });
    }
    
    if (!booking.startTime || !booking.endTime) return false;
    return rangesOverlap(startTime, endTime, booking.startTime, booking.endTime);
  });
}

export function hasAnyBookingOnDate(date: string, bookedByDate: Record<string, ExistingBooking[]>) {
  return (bookedByDate[date] || []).some((booking) => booking.bookingStatus === 'confirmed');
}

export function mergeSelectedSlots(slotStarts: string[]) {
  const sorted = slotStarts
    .map((start) => TIME_SLOTS.find((slot) => slot.start === start))
    .filter((slot): slot is typeof TIME_SLOTS[number] => Boolean(slot))
    .sort((a, b) => a.start.localeCompare(b.start));

  const ranges: Array<{ startTime: string; endTime: string }> = [];
  for (const slot of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.endTime === slot.start) {
      last.endTime = slot.end;
    } else {
      ranges.push({ startTime: slot.start, endTime: slot.end });
    }
  }

  return ranges;
}

export function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getDateStr(d: string | Date | undefined | null) {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSlotInPast(dateStr: string, startTimeStr: string) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  
  const currentMinutes = today.getHours() * 60 + today.getMinutes();
  const slotMinutes = toMinutes(startTimeStr);
  return slotMinutes < currentMinutes;
}

export function getSlotsBetweenTimes(start: string, end: string) {
  const startMins = toMinutes(start);
  const endMins = toMinutes(end);
  const selected: string[] = [];
  for (const slot of TIME_SLOTS) {
    const sMins = toMinutes(slot.start);
    const eMins = toMinutes(slot.end);
    if (sMins >= startMins && eMins <= endMins) {
      selected.push(slot.start);
    }
  }
  return selected;
}
