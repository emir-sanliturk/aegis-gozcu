import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface EventPulseProps {
  children: React.ReactNode;
  itemKey: string;
}

export const EventPulse: React.FC<EventPulseProps> = ({ children, itemKey }) => {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      key={itemKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};
