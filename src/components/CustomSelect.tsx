import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}

export function CustomSelect({ value, onChange, options, label }: CustomSelectProps) {
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

  return (
    <div className="custom-select-container" ref={containerRef}>
      <span className="select-label">{label}</span>
      <div className="select-wrapper">
        <button
          type="button"
          className={`select-trigger ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{value}</span>
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
              {options.map((option) => (
                <li
                  key={option}
                  className={`select-option ${option === value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={option === value}
                >
                  {option}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
