import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomSelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: T[] | { label: string; value: T }[];
  label: string;
  className?: string;
  disabled?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export function CustomSelect<T extends string | number>({ 
  value, 
  onChange, 
  options, 
  label,
  className,
  disabled,
  layout = 'horizontal'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = (option: T | { label: string; value: T }) => {
    if (typeof option === 'object' && option !== null) {
      return (option as { label: string; value: T }).label;
    }
    return String(option);
  };

  const getValue = (option: T | { label: string; value: T }) => {
    if (typeof option === 'object' && option !== null) {
      return (option as { label: string; value: T }).value;
    }
    return option as T;
  };

  const displayValue = options.find(opt => getValue(opt) === value);
  const displayText = displayValue ? getLabel(displayValue) : String(value);

  return (
    <div className={`custom-select-container ${layout} ${className || ''} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      {label && <span className="select-label">{label}</span>}
      <div className="select-wrapper">
        <button
          type="button"
          className={`select-trigger ${isOpen ? 'active' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          <span>{displayText}</span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.ul
              className="select-options"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              role="listbox"
            >
              {options.map((option, index) => {
                const optValue = getValue(option);
                const optLabel = getLabel(option);
                const isSelected = optValue === value;
                
                return (
                  <li
                    key={typeof optValue === 'string' ? optValue : `opt-${index}`}
                    className={`select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {optLabel}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
