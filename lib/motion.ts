import type { Variants, Transition } from "framer-motion";

export const defaultTransition: Transition = {
  duration: 0.35,
  ease: [0, 0, 0.2, 1],
};

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: defaultTransition },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: defaultTransition },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: defaultTransition },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: defaultTransition },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: defaultTransition,
  },
};

export const hoverLift = {
  rest: { y: 0, boxShadow: "0 1px 3px 0 rgb(61 35 20 / 0.05)" },
  hover: {
    y: -4,
    boxShadow: "0 8px 24px -4px rgb(61 35 20 / 0.12)",
    transition: { duration: 0.2 },
  },
};
