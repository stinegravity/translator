import { useState } from 'react';
import { MessageSquareHeart, Send } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface AppFeedbackPanelProps {
  onSubmit: (data: {
    overallRating: number;
    performanceRating: number;
    reliabilityRating: number;
    easeRating: number;
    notes?: string;
    currentPath?: string;
  }) => Promise<void>;
}

const ratingOptions = [
  { label: '1/5', value: 1 },
  { label: '2/5', value: 2 },
  { label: '3/5', value: 3 },
  { label: '4/5', value: 4 },
  { label: '5/5', value: 5 },
];

export function AppFeedbackPanel({ onSubmit }: AppFeedbackPanelProps) {
  const [overallRating, setOverallRating] = useState(4);
  const [performanceRating, setPerformanceRating] = useState(4);
  const [reliabilityRating, setReliabilityRating] = useState(4);
  const [easeRating, setEaseRating] = useState(4);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSubmit({
        overallRating,
        performanceRating,
        reliabilityRating,
        easeRating,
        notes: notes.trim() || undefined,
        currentPath: window.location.pathname,
      });
      setSaved(true);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit app feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">App Feedback</div>
      <p className="settings-help">Rate app performance and usability. This is separate from translation-quality feedback.</p>
      <div className="app-feedback-grid">
        <CustomSelect
          label="Overall"
          value={overallRating}
          onChange={setOverallRating}
          options={ratingOptions}
          layout="vertical"
        />
        <CustomSelect
          label="Performance"
          value={performanceRating}
          onChange={setPerformanceRating}
          options={ratingOptions}
          layout="vertical"
        />
        <CustomSelect
          label="Reliability"
          value={reliabilityRating}
          onChange={setReliabilityRating}
          options={ratingOptions}
          layout="vertical"
        />
        <CustomSelect
          label="Ease of use"
          value={easeRating}
          onChange={setEaseRating}
          options={ratingOptions}
          layout="vertical"
        />
      </div>
      <textarea
        className="app-feedback-notes"
        rows={4}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="What felt slow, confusing, or broken?"
      />
      <div className="app-feedback-actions">
        <button type="button" className="settings-mini-btn" onClick={() => void submit()} disabled={saving}>
          {saving ? <MessageSquareHeart size={14} /> : <Send size={14} />}
          {saving ? 'Submitting...' : 'Submit feedback'}
        </button>
        {saved ? <span className="app-feedback-success">Thanks, feedback saved.</span> : null}
        {error ? <span className="settings-error">{error}</span> : null}
      </div>
    </section>
  );
}
