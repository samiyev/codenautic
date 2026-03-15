/**
 * Reusable variant definitions for staggered children.
 */
export const STAGGER_ITEM_VARIANTS = {
    hidden: {
        opacity: 0,
        y: 12,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.25,
            ease: [0.0, 0.0, 0.2, 1.0],
        },
    },
} as const
