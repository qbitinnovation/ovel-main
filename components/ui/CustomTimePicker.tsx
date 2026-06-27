'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

interface CustomTimePickerProps {
  value: string; // "HH:MM" format (24h)
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CustomTimePicker({ value, onChange, className = '', style }: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Generate 48 time options (30 min intervals)
  const timeOptions = useMemo(() => {
    return Array.from({ length: 48 }, (_, idx) => {
      const totalMinutes = idx * 30;
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const valStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const labelStr = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      return { value: valStr, label: labelStr };
    });
  }, []);

  const selectedOption = useMemo(() => {
    return timeOptions.find(opt => opt.value === value) || timeOptions[0];
  }, [timeOptions, value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to active option when dropdown opens
  useEffect(() => {
    if (isOpen && optionsRef.current) {
      const activeEl = optionsRef.current.querySelector('.selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [isOpen]);

  return (
    <div
      className={`custom-select-container ${className}`}
      style={{ ...style, position: 'relative' }}
      ref={dropdownRef}
    >
      <button
        type="button"
        className={`custom-select-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          fontSize: '13px',
          height: '36px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} className="custom-select-icon" style={{ opacity: 0.7 }} />
          <span style={{ fontWeight: 500 }}>{selectedOption.label}</span>
        </div>
        <ChevronDown size={14} className={`custom-select-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="custom-select-dropdown"
          ref={optionsRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            maxHeight: '220px',
            overflowY: 'auto',
            width: '100%',
            minWidth: '140px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--surface-glass-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            marginTop: '4px',
            zIndex: 100,
          }}
        >
          <div className="custom-select-options" style={{ padding: '4px' }}>
            {timeOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                  style={{
                    width: '100%',
                    background: isSelected ? 'var(--accent-primary-soft)' : 'transparent',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
