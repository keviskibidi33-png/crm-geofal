import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from './input';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: any) => void;
  suggestions: any[];
  placeholder?: string;
  className?: string;
  displayField?: string;
  codeField?: string;
  minChars?: number;
  maxSuggestions?: number;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = "Buscar...",
  className,
  displayField = 'descripcion',
  codeField = 'codigo',
  minChars = 2,
  maxSuggestions = 8
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  const normalizedValue = value.toLowerCase().trim();
  
  const filteredSuggestions = normalizedValue.length >= minChars 
    ? suggestions
        .filter(item => {
          const code = (item[codeField] || '').toLowerCase();
          const desc = (item[displayField] || '').toLowerCase();
          const norma = (item.norma || '').toLowerCase();
          
          return code.includes(normalizedValue) ||
            desc.includes(normalizedValue) ||
            norma.includes(normalizedValue);
        })
        .slice(0, maxSuggestions)
    : [];

  const showDropdown = isOpen && filteredSuggestions.length > 0;

  // Update position when dropdown opens
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      // Position dropdown to start at the left of the input but extend to the right
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: 600 // Fixed width for better visibility
      });
    }
  }, [showDropdown, value]);

  // Close dropdown when clicking outside - but NOT on dropdown items
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside container or on dropdown portal
      if (containerRef.current?.contains(target)) {
        return;
      }
      // Check if clicking on dropdown (which is in a portal)
      const dropdown = document.querySelector('[data-autocomplete-dropdown="true"]');
      if (dropdown?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    
    if (isOpen) {
      // Use setTimeout to ensure the event listener is added after the current event cycle
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleFocus = () => {
    if (value.length >= minChars) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: any) => {
    console.log('Selected item:', item);
    onSelect(item);
    setIsOpen(false);
  };

  const dropdownContent = showDropdown ? (
    <div
      data-autocomplete-dropdown="true"
      onMouseDown={(e) => e.preventDefault()} // Prevent blur on input
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        maxWidth: 700,
        zIndex: 99999,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        maxHeight: '320px',
        overflowY: 'auto'
      }}
    >
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        backgroundColor: '#f9fafb', 
        padding: '8px 12px', 
        borderBottom: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: 500
      }}>
        {filteredSuggestions.length} resultado{filteredSuggestions.length !== 1 ? 's' : ''}
      </div>
      {filteredSuggestions.map((item, index) => (
        <div
          key={item[codeField]}
          onClick={() => handleSelect(item)}
          onMouseEnter={() => setHighlightedIndex(index)}
          style={{
            padding: '12px',
            cursor: 'pointer',
            backgroundColor: highlightedIndex === index ? '#eff6ff' : 'white',
            borderBottom: '1px solid #f3f4f6',
            transition: 'background-color 0.15s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: '#dbeafe',
              color: '#1e40af'
            }}>
              {item[codeField]}
            </span>
            <span style={{ fontWeight: 500, color: '#111827', fontSize: '14px' }}>
              {item[displayField]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
            {item.norma && <span>📋 {item.norma}</span>}
            {item.precio !== undefined && <span style={{ color: '#059669', fontWeight: 500 }}>S/. {item.precio}</span>}
            {item.tiempo && <span>⏱️ {item.tiempo}</span>}
            {item.acreditado === 'SI' && <span style={{ color: '#2563eb' }}>✓ Acreditado</span>}
          </div>
          {item.codigosRelacionados && item.codigosRelacionados.length > 0 && (
            <div style={{ 
              fontSize: '12px', 
              color: '#ea580c', 
              marginTop: '4px', 
              backgroundColor: '#fff7ed', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}>
              ⚠️ Requiere: {item.codigosRelacionados.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
