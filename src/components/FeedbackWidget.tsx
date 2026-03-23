import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, Send } from 'lucide-react';

interface FeedbackWidgetProps {
  historyId: string | undefined;
  source: string;         // original input text
  aiOutput: string;       // what the AI produced
  dialect: string;
  context: string;        // tone/domain
  onSubmit: (data: FeedbackPayload) => Promise<void>;
  title?: string;
}

export interface FeedbackPayload {
  historyId: string;
  rating: 1 | 2 | 3;
  correction?: string;
  dialect: string;
  domain: string;
  notes?: string;
  source: string;
  aiOutput: string;
}

type RatingOption = { value: 1 | 2 | 3; label: string; icon: React.ReactNode; color: string };

const RATINGS: RatingOption[] = [
  { value: 1, label: 'Incorrect', icon: <ThumbsDown size={16} />, color: 'var(--feedback-bad)' },
  { value: 2, label: 'OK', icon: <Minus size={16} />, color: 'var(--feedback-ok)' },
  { value: 3, label: 'Good', icon: <ThumbsUp size={16} />, color: 'var(--feedback-good)' },
];

export function FeedbackWidget({ historyId, source, aiOutput, dialect, context, onSubmit, title = 'Was this translation accurate?' }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [correction, setCorrection] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!historyId) return null;
  if (submitted) {
    return (
      <motion.div
        className="feedback-thanks"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        ✓ Thank you for improving KyereAse
      </motion.div>
    );
  }

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    try {
      await onSubmit({
        historyId,
        rating,
        correction: correction.trim() || undefined,
        dialect,
        domain: context,
        notes: notes.trim() || undefined,
        source,
        aiOutput,
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const selectedRating = RATINGS.find((r) => r.value === rating);

  return (
    <motion.div
      className="feedback-widget"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="feedback-row">
        <span className="feedback-label">{title}</span>
        <div className="feedback-rating-btns">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              title={r.label}
              className={`feedback-rating-btn ${rating === r.value ? 'selected' : ''}`}
              style={rating === r.value ? { borderColor: r.color, color: r.color } : {}}
              onClick={() => {
                setRating(r.value);
                // Auto-expand correction form for bad/ok ratings
                if (r.value <= 2) setExpanded(true);
              }}
            >
              {r.icon}
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        {rating && (
          <button
            type="button"
            className="feedback-expand-btn"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Add correction'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {!expanded && <span>Add correction</span>}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && rating && (
          <motion.div
            className="feedback-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="feedback-meta">
              <span className="feedback-meta-chip">{dialect}</span>
              <span className="feedback-meta-chip">{context}</span>
              {selectedRating && (
                <span className="feedback-meta-chip" style={{ color: selectedRating.color }}>
                  {selectedRating.label}
                </span>
              )}
            </div>

            <label className="feedback-field">
              <span>Your correction <em>(leave blank if the translation is correct)</em></span>
              <textarea
                className="feedback-textarea"
                rows={3}
                placeholder="Type the correct translation here..."
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
              />
            </label>

            <label className="feedback-field">
              <span>Notes for the reviewer <em>(optional)</em></span>
              <input
                type="text"
                className="feedback-input"
                placeholder="e.g. wrong verb tense, missing honorific..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="feedback-submit-btn"
              onClick={handleSubmit}
              disabled={loading || !rating}
            >
              {loading ? 'Saving...' : (
                <>
                  <Send size={14} />
                  Submit Feedback
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {rating && !expanded && (
        <motion.button
          type="button"
          className="feedback-quick-submit"
          onClick={handleSubmit}
          disabled={loading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {loading ? 'Saving...' : `Submit — ${selectedRating?.label}`}
        </motion.button>
      )}
    </motion.div>
  );
}
