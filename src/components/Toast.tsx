import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface ToastProps {
  message: string;
  show: boolean;
}

export function Toast({ message, show }: ToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Check size={18} />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
