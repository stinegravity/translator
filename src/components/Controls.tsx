import { Type, AudioLines, ArrowRightLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CustomSelect } from './CustomSelect';
import { motion } from 'framer-motion';
import { languages } from '../config/languages';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ControlsProps {
  inputMode: 'text' | 'audio';
  setInputMode: (mode: 'text' | 'audio') => void;
  direction: string;
  onToggleDirection: () => void;
  diarize: boolean;
  setDiarize: (d: boolean) => void;
  context: string;
  setContext: (c: string) => void;
  dialect: string;
  setDialect: (d: string) => void;
}

export function Controls({
  inputMode,
  setInputMode,
  direction,
  onToggleDirection,
  diarize,
  setDiarize,
  context,
  setContext,
  dialect,
  setDialect,
}: ControlsProps) {
  const contexts = ['Casual', 'Formal', 'Business', 'Medical', 'News'];

  const [sourceCode, targetCode] = direction.split('-');
  const sourceLang = languages[sourceCode];
  const targetLang = languages[targetCode];

  // Dialects for the current "Twi-like" language in the pair
  const dialectLang = sourceCode === 'tw' ? sourceLang : targetCode === 'tw' ? targetLang : null;
  const dialectOptions = dialectLang?.variants.map(v => v.name) || [];

  const sourceLanguageLabel = sourceCode === 'tw' ? dialect : sourceLang?.name || sourceCode;
  const targetLanguageLabel = targetCode === 'tw' ? dialect : targetLang?.name || targetCode;

  return (
    <div className="controls-wrapper">
      <div className="controls-main-row">
        {/* Mode Switcher */}
        <div className="mode-switcher-container">
          <div className="mode-switcher">
            <button
              className={cn('mode-btn', inputMode === 'text' && 'active')}
              onClick={() => setInputMode('text')}
            >
              <Type size={16} />
              <span>Translate</span>
            </button>
            <button
              className={cn('mode-btn', inputMode === 'audio' && 'active')}
              onClick={() => setInputMode('audio')}
            >
              <AudioLines size={16} />
              <span>Listen</span>
            </button>
            <motion.div
              className="mode-indicator"
              animate={{ x: inputMode === 'text' ? '0%' : '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        {/* Language Switcher */}
        <div className="language-switcher-container">
          <div className="language-switcher">
            <div className="lang-slot source">
              <span className="lang-badge">FROM</span>
              <span className="lang-label">{sourceLanguageLabel}</span>
            </div>
            <div className="swap-btn-wrapper">
              <button className="swap-btn" onClick={onToggleDirection} title="Swap Languages">
                <ArrowRightLeft size={18} />
              </button>
            </div>
            <div className="lang-slot target">
              <span className="lang-badge">TO</span>
              <span className="lang-label">{targetLanguageLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="controls-secondary-row">
        <div className="secondary-group">
          <CustomSelect
            label="Tone"
            value={context}
            onChange={setContext}
            options={contexts}
          />

          <CustomSelect
            label="Dialect"
            value={dialect}
            onChange={setDialect}
            options={dialectOptions}
          />
        </div>

        {inputMode === 'audio' && (
          <label className={cn('diarize-switch', diarize && 'active')}>
            <input
              type="checkbox"
              checked={diarize}
              onChange={(e) => setDiarize(e.target.checked)}
              aria-label="Speaker diarization"
            />
            <span className="switch-slider" />
            <span className="switch-label">Diarization</span>
          </label>
        )}
      </div>
    </div>
  );
}
