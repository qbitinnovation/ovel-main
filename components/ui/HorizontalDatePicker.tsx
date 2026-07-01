'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalDatePickerProps {
  value: string | string[]; // ISO date string YYYY-MM-DD or array of strings
  onChange: (value: string) => void;
  minDate?: string;
  className?: string;
  onMonthChange?: (date: Date) => void;
  isDateFullyBooked?: (dateStr: string) => boolean;
}

export function HorizontalDatePicker({ value, onChange, minDate, className = '', onMonthChange, isDateFullyBooked }: HorizontalDatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);

  // Parse value to Date, defaulting to today
  const lastValue = Array.isArray(value) ? (value.length > 0 ? value[value.length - 1] : '') : value;

  const initialDate = useMemo(() => {
    if (!lastValue) return new Date();
    const [y, m, d] = lastValue.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [lastValue]);
  
  // State for the currently viewed month/year in the top bar
  const [viewDate, setViewDate] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  
  // State for the visible days window. Try to put the initial date in the middle of the 5 days (offset - 2)
  const [dayOffset, setDayOffset] = useState(() => {
    return initialDate.getDate() - 3;
  });

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (lastValue) {
      const [y, m, d] = lastValue.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      const newViewDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
      setViewDate(newViewDate);
      setDayOffset(newDate.getDate() - 3);
      onMonthChange?.(newViewDate);
    }
  }, [lastValue]);

  // Handle click outside to close grid calendar popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowGrid(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    setViewDate(nextDate);
    setDayOffset(0);
    onMonthChange?.(nextDate);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    setViewDate(nextDate);
    setDayOffset(0);
    onMonthChange?.(nextDate);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handlePrevDays = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      if (container.scrollLeft <= 0) {
        handlePrevMonth();
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.scrollWidth, behavior: 'instant' });
          }
        }, 50);
      } else {
        container.scrollBy({ left: -200, behavior: 'smooth' });
      }
    }
  };

  const handleNextDays = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      if (Math.abs(container.scrollWidth - container.scrollLeft - container.clientWidth) < 2) {
        handleNextMonth();
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'instant' });
          }
        }, 50);
      } else {
        container.scrollBy({ left: 200, behavior: 'smooth' });
      }
    }
  };

  const isBeforeMinDate = (d: Date) => {
    if (!minDate) return false;
    const [my, mm, md] = minDate.split('-').map(Number);
    const minD = new Date(my, mm - 1, md);
    minD.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < minD;
  };

  // Generate all days in the currently viewed month
  const visibleDays = useMemo(() => {
    const days = [];
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), i));
    }
    return days;
  }, [viewDate]);

  // Ensure active day is scrolled into view when switching months or setting initial value
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const activeBtn = scrollContainerRef.current.querySelector('.hdp-day-btn.active');
        if (activeBtn) {
          activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [viewDate, lastValue]);

  // Generate calendar grid days for the popup modal
  const gridDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [viewDate]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleSelect = (d: Date) => {
    if (isBeforeMinDate(d)) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${day}`);
  };

  const handleSelectFromGrid = (d: Date) => {
    handleSelect(d);
    setShowGrid(false);
  };

  const isSelectedDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dStr = `${y}-${m}-${day}`;
    if (Array.isArray(value)) {
      return value.includes(dStr);
    }
    return value === dStr;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };

  return (
    <div ref={containerRef} className={`horizontal-datepicker ${className}`} style={{ position: 'relative' }}>
      {/* Month Header Pill */}
      <div className="hdp-month-pill">
        <button type="button" onClick={handlePrevMonth} className="hdp-nav-btn"><ChevronLeft size={16} /></button>
        <span 
          onClick={() => setShowGrid(!showGrid)} 
          className="hdp-month-label"
          style={{ cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
        >
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()} ▾
        </span>
        <button type="button" onClick={handleNextMonth} className="hdp-nav-btn"><ChevronRight size={16} /></button>
      </div>

      {/* Grid Calendar Dropdown Popover */}
      {showGrid && (
        <div className="custom-datepicker-popup" style={{ top: '44px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div className="custom-datepicker-header">
            <button type="button" onClick={handlePrevMonth} className="custom-datepicker-nav"><ChevronLeft size={18} /></button>
            <div className="custom-datepicker-title" style={{ fontSize: 'var(--text-sm)' }}>
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} className="custom-datepicker-nav"><ChevronRight size={18} /></button>
          </div>
          <div className="custom-datepicker-grid">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="custom-datepicker-day-name">{day}</div>
            ))}
            {gridDays.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} className="custom-datepicker-day empty"></div>;
              const isSelected = isSelectedDate(d);
              const isDisabled = isBeforeMinDate(d);
              
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const dStr = `${y}-${m}-${day}`;
              const isFullyBooked = isDateFullyBooked?.(dStr);
              
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  className={`custom-datepicker-day ${isSelected ? 'selected' : ''} ${isToday(d) && !isSelected ? 'today' : ''} ${isDisabled ? 'disabled' : ''} ${isFullyBooked ? 'fully-booked' : ''}`}
                  onClick={() => !isDisabled && handleSelectFromGrid(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Days Scroller Pill */}
      <div className="hdp-days-pill">
        <button type="button" onClick={handlePrevDays} className="hdp-nav-btn"><ChevronLeft size={16} /></button>
        
        <div className="hdp-days-container" ref={scrollContainerRef}>
          {visibleDays.map((d, i) => {
            const isSelected = isSelectedDate(d);
            const isDisabled = isBeforeMinDate(d);
            
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dStr = `${y}-${m}-${day}`;
            const isFullyBooked = isDateFullyBooked?.(dStr);
            
            return (
              <button 
                key={i} 
                type="button" 
                onClick={() => handleSelect(d)}
                disabled={isDisabled}
                className={`hdp-day-btn ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${isFullyBooked ? 'fully-booked' : ''}`}
              >
                <span className="hdp-day-name">{dayNames[d.getDay()]}</span>
                <span className="hdp-day-num">{String(d.getDate()).padStart(2, '0')}</span>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={handleNextDays} className="hdp-nav-btn"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
