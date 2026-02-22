"use client";

import { motion } from "motion/react";
import { ReactNode } from "react";

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialY?: number;
}

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.06,
  initialY = 16,
}: StaggerChildrenProps) {
  const containerVariants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  initialY = 16,
}: {
  children: ReactNode;
  className?: string;
  initialY?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: initialY },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            stiffness: 400,
            damping: 30,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Re-export for convenience
export { container as staggerContainer, item as staggerItem };
