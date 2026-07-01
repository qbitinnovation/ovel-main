'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  searchable?: boolean;
}

export function CustomSelect({ options, value, onChange, placeholder = 'Select...', className = '', style, disabled = false, searchable = true }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const popupWidth = 280; // Min width is 280px in globals.css
      
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

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable 
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className={`custom-select-container ${className}`} style={style} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        className={`custom-select-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        <div className="custom-select-value">
          {selectedOption?.icon && <span className="custom-select-icon">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`custom-select-chevron ${isOpen ? 'open' : ''}`} size={16} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown" style={dropdownStyle}>
          {searchable && (
            <div style={{ padding: '8px', borderBottom: '1px solid var(--surface-glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="custom-select-empty">No options</div>
          ) : (
            <div className="custom-select-options">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <div className="custom-select-option-label">
                      {option.icon && (
                        <span className="custom-select-icon">{option.icon}</span>
                      )}
                      <span>{option.label}</span>
                    </div>
                    {isSelected && <Check size={16} className="custom-select-check" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
