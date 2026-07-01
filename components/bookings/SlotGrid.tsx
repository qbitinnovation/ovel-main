import { TIME_SLOTS, isSlotBooked, isSlotInPast, type ExistingBooking } from '@/lib/booking-utils';

export function SlotGrid({
  date,
  selectedSet,
  bookedByDate,
  disabled,
  onToggle,
  currentBookingSlots = new Set(), // pass set of slot starts that belong to current booking
}: {
  date: string;
  selectedSet: Set<string>;
  bookedByDate: Record<string, ExistingBooking[]>;
  disabled: boolean;
  onToggle: (slot: typeof TIME_SLOTS[number]) => void;
  currentBookingSlots?: Set<string>;
}) {
  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(3, auto)',
        gridAutoFlow: 'column',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: '8px',
        gridAutoColumns: 'calc(33.333% - 6px)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingBottom: '4px'
      }}
    >
      {TIME_SLOTS.map((slot) => {
        // If a slot is booked by *others*, it is 'booked'
        const booked = isSlotBooked(date, slot.start, slot.end, bookedByDate);
        const selected = selectedSet.has(slot.start);
        const isCurrentBooking = currentBookingSlots.has(slot.start);
        
        const isPast = isSlotInPast(date, slot.start);
        const locked = (disabled && !selected) || (isPast && !isCurrentBooking);

        return (
          <button
            key={`${date}-${slot.start}`}
            type="button"
            className={`slot-pill ${selected ? 'selected' : ''} ${booked && !isCurrentBooking ? 'booked' : ''} ${locked ? 'locked' : ''} ${isCurrentBooking ? 'current-booking' : ''}`}
            disabled={(booked && !isCurrentBooking) || locked}
            onClick={() => onToggle(slot)}
            title={booked && !isCurrentBooking ? 'Booked' : locked ? 'Locked' : slot.label}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
