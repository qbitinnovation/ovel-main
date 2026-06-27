'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, User } from 'lucide-react';

export interface AutocompleteOption {
  name: string;
  contact?: string;
}

interface CustomAutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: AutocompleteOption | null) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CustomAutocomplete({
  options,
  value,
  onChange,
  onSelect,
  placeholder = 'Search Customer...',
  className = '',
  style
}: CustomAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal input value when the prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounce the parent onChange callback when typing
  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(handler);
  }, [inputValue, onChange, value]);

  // Click outside handler to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on input value
  const filteredOptions = useMemo(() => {
    const q = inputValue.toLowerCase().trim();
    if (!q) {
      return options.slice(0, 8); // Show first 8 customers when input is empty
    }
    return options.filter(
      opt =>
        opt.name.toLowerCase().includes(q) ||
        (opt.contact && opt.contact.toLowerCase().includes(q))
    ).slice(0, 8); // Cap at 8 results for better performance and layout
  }, [options, inputValue]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const selected = filteredOptions[highlightedIndex];
        selectOption(selected);
      } else {
        setIsOpen(false);
        onChange(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectOption = (option: AutocompleteOption) => {
    setInputValue(option.name);
    onChange(option.name);
    if (onSelect) {
      onSelect(option);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    if (onSelect) {
      onSelect(null);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      className={`custom-select-container ${className}`}
      style={{ width: 'auto', minWidth: '220px', position: 'relative', ...style }}
      ref={dropdownRef}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={14}
          color="var(--text-muted)"
          style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            if (onSelect) {
              onSelect(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="form-input"
          style={{
            paddingLeft: '32px',
            paddingRight: inputValue ? '32px' : '12px',
            fontSize: '13px',
            height: '36px',
            width: '100%',
          }}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%',
              color: 'var(--text-muted)',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="custom-select-dropdown"
          style={{
            maxHeight: '260px',
            width: '100%',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--surface-glass-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            marginTop: '4px',
            left: 0,
            right: 0,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className="custom-select-empty" style={{ padding: '12px', fontSize: '13px' }}>
              No customers found
            </div>
          ) : (
            <div className="custom-select-options" style={{ padding: '4px' }}>
              {filteredOptions.map((option, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isSelected = option.name === value;
                return (
                  <button
                    key={`${option.name}_${idx}`}
                    type="button"
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    style={{
                      width: '100%',
                      background: isHighlighted ? 'var(--bg-hover)' : isSelected ? 'var(--accent-primary-soft)' : 'transparent',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => selectOption(option)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <User size={13} style={{ opacity: 0.6 }} />
                      <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '13px' }}>{option.name}</span>
                    </div>
                    {option.contact && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '21px', marginTop: '2px' }}>
                        {option.contact}
                      </span>
                    )}
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
