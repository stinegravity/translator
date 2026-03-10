import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Loader2, Check } from 'lucide-react';

interface VerificationBannerProps {
  email: string;
  onResend: (email: string) => Promise<unknown>;
}

export function VerificationBanner({ email, onResend }: VerificationBannerProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    setSent(false);
    try {
      await onResend(email);
      setSent(true);
    } catch {
      // Error handled by parent / toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="verification-banner"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Mail size={18} />
      <span>
        Please verify your email address. Check your inbox for the verification link.
      </span>
      <button
        type="button"
        className="verification-banner-btn"
        onClick={handleResend}
        disabled={loading}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : sent ? (
          <>
            <Check size={16} />
            Sent
          </>
        ) : (
          'Resend'
        )}
      </button>
    </motion.div>
  );
}
