import { motion } from 'framer-motion';
import { RefreshCcw, Wand2, X } from 'lucide-react';

interface TextInputProps {
  textInput: string;
  setTextInput: (text: string) => void;
  onTranslate: () => void;
  onClear?: () => void;
  loading: boolean;
  placeholder: string;
  showClear?: boolean;
}

export function TextInput({
  textInput,
  setTextInput,
  onTranslate,
  onClear,
  loading,
  placeholder,
  showClear,
}: TextInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (textInput.trim() && !loading) onTranslate();
    }
  };

  return (
    <motion.div key="text-section" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="input-section">
      <textarea
        id="text-input-field"
        placeholder={placeholder}
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Text to translate"
      />
      <div className="input-actions">
        <div className="char-count">{textInput.length} characters</div>
        {showClear && onClear && (
          <motion.button type="button" className="clear-btn" onClick={onClear} title="Clear" whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
            <X size={16} />
            Clear
          </motion.button>
        )}
      </div>
      <motion.button
        id="translate-btn"
        type="button"
        className={`main-btn ${loading ? 'loading' : ''}`}
        onClick={onTranslate}
        disabled={loading || !textInput.trim()}
        title="Translate (Ctrl+Enter)"
        whileTap={{ scale: 0.98 }}
        whileHover={!loading && textInput.trim() ? { scale: 1.01 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {loading ? <RefreshCcw size={20} className="animate-spin" /> : <Wand2 size={20} />}
        {loading ? 'Translating...' : 'Translate'}
      </motion.button>
    </motion.div>
  );
}
