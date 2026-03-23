import { useState } from 'react';
import { BadgeCheck, Send, X } from 'lucide-react';
import type { ReviewerAccessStatus, TierName } from '../types';
import { shouldShowReviewerAccessBanner } from '../lib/reviewerAccess';

interface ReviewerAccessBannerProps {
  tier?: TierName;
  reviewerAccessStatus?: ReviewerAccessStatus;
  onSubmit: (payload: {
    organization?: string;
    roleTitle?: string;
    languages?: string;
    credentials: string;
    reviewUseCase?: string;
    portfolioUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

export function ReviewerAccessBanner({ tier, reviewerAccessStatus = 'NONE', onSubmit }: ReviewerAccessBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [organization, setOrganization] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [languages, setLanguages] = useState('');
  const [credentials, setCredentials] = useState('');
  const [reviewUseCase, setReviewUseCase] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(reviewerAccessStatus === 'PENDING');

  const [dismissed, setDismissed] = useState(() => localStorage.getItem('dismissedReviewerBanner') === 'true');

  if (dismissed || !shouldShowReviewerAccessBanner(tier, reviewerAccessStatus)) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem('dismissedReviewerBanner', 'true');
    setDismissed(true);
  };

  if (reviewerAccessStatus === 'REJECTED') {
    return (
      <div className="reviewer-banner">
        <div className="reviewer-banner-copy">
          <strong>Reviewer access was not approved</strong>
          <p>You can submit a new request if your qualifications or use case have changed.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={() => setExpanded((value) => !value)}>
          Reapply
        </button>
      </div>
    );
  }

  if (submitted && !expanded) {
    return (
      <div className="reviewer-banner">
        <div className="reviewer-banner-copy">
          <strong>Reviewer access request submitted</strong>
          <p>Your request is pending internal review. You will be able to submit reviewer feedback after approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`reviewer-banner ${expanded ? 'reviewer-banner-expanded' : ''}`}>
      <div className="reviewer-banner-container">
        <div className="reviewer-banner-copy">
          <strong>Apply for reviewer access</strong>
          <p>Qualified users can apply to review translations and submit correction feedback.</p>
        </div>
        {!expanded && (
          <button type="button" className="reviewer-banner-close" onClick={handleDismiss} title="Dismiss">
            <X size={16} />
          </button>
        )}
      </div>

      {!expanded ? (
        <button type="button" className="secondary-btn reviewer-apply-btn" onClick={() => setExpanded(true)}>
          <BadgeCheck size={16} />
          Apply now
        </button>
      ) : (
        <form
          className="reviewer-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!credentials.trim()) {
              setError('Credentials are required');
              return;
            }

            setError(null);
            setSaving(true);
            void onSubmit({
              organization: organization.trim() || undefined,
              roleTitle: roleTitle.trim() || undefined,
              languages: languages.trim() || undefined,
              credentials: credentials.trim(),
              reviewUseCase: reviewUseCase.trim() || undefined,
              portfolioUrl: portfolioUrl.trim() || undefined,
              notes: notes.trim() || undefined,
            })
              .then(() => {
                setSubmitted(true);
                setExpanded(false);
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Could not submit reviewer request');
              })
              .finally(() => setSaving(false));
          }}
        >
          <div className="reviewer-form-grid">
            <input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization" />
            <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Role title" />
            <input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="Languages / dialects" />
            <input value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="Portfolio or reference URL" />
          </div>
          <textarea
            className="reviewer-form-textarea"
            rows={4}
            value={credentials}
            onChange={(event) => setCredentials(event.target.value)}
            placeholder="Share your credentials, experience, or qualifications"
          />
          <textarea
            className="reviewer-form-textarea"
            rows={3}
            value={reviewUseCase}
            onChange={(event) => setReviewUseCase(event.target.value)}
            placeholder="How would you use reviewer access?"
          />
          <textarea
            className="reviewer-form-textarea"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes"
          />
          {error ? <p className="settings-error">{error}</p> : null}
          <div className="reviewer-form-actions">
            <button type="button" className="secondary-btn" onClick={() => setExpanded(false)}>
              Cancel
            </button>
            <button type="submit" className="secondary-btn" disabled={saving}>
              <Send size={16} />
              {saving ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
