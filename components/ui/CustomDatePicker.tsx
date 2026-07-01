'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  minDate?: string; // ISO date string YYYY-MM-DD
}

export function CustomDatePicker({ value, onChange, className = '', style, disabled = false, placeholder = 'Select Date', minDate }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [viewDate, setViewDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const popupWidth = 320;
      
      let style: React.CSSProperties = {};
      
      if (rect.left + popupWidth > screenWidth - 10) {
        if (rect.right - popupWidth >= 10) {
          style = { right: 0, left: 'auto' };
        } else {
          const targetLeft = Math.max(10, (screenWidth - popupWidth) / 2);
          style = { left: `${targetLeft - rect.left}px`, right: 'auto' };
        }
      } else {
        style = { left: 0, right: 'auto' };
      }
      
      setDropdownStyle(style);
    }
  }, [isOpen]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const generateCalendarDays = () => {
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
  };

  const days = generateCalendarDays();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const formatDateForDisplay = (isoStr: string) => {
    if (!isoStr) return placeholder;
    const [y, m, d] = isoStr.split('-').map(Number);
    if (!y || !m || !d) return placeholder;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isSelected = (d: Date) => {
    if (!value) return false;
    const [vy, vm, vd] = value.split('-').map(Number);
    return d.getFullYear() === vy && d.getMonth() === vm - 1 && d.getDate() === vd;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
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

  const handleSelectDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${day}`);
    setIsOpen(false);
  };

  return (
    <div className={`custom-datepicker-container ${className}`} style={style} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`custom-datepicker-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        <div className="custom-datepicker-value">
          <CalendarIcon size={16} className="custom-datepicker-icon" />
          <span>{formatDateForDisplay(value)}</span>
        </div>
      </button>

      {isOpen && (
        <div className="custom-datepicker-popup" style={dropdownStyle}>
          <div className="custom-datepicker-header">
            <button type="button" onClick={handlePrevMonth} className="custom-datepicker-nav"><ChevronLeft size={18} /></button>
            <div className="custom-datepicker-title">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</div>
            <button type="button" onClick={handleNextMonth} className="custom-datepicker-nav"><ChevronRight size={18} /></button>
          </div>
          <div className="custom-datepicker-grid">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="custom-datepicker-day-name">{day}</div>
            ))}
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} className="custom-datepicker-day empty"></div>;
              const past = isBeforeMinDate(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={past}
                  className={`custom-datepicker-day ${isSelected(d) ? 'selected' : ''} ${isToday(d) && !isSelected(d) ? 'today' : ''} ${past ? 'disabled' : ''}`}
                  onClick={() => !past && handleSelectDate(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
