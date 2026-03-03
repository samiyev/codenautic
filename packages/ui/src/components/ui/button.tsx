import {type ButtonHTMLAttributes, type ReactNode, forwardRef} from "react"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex h-10 items-center justify-center rounded-md border border-transparent text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110",
                secondary:
                    "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[color-mix(in oklch,var(--surface-muted)_55%,var(--surface))]",
                outline:
                    "bg-transparent border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
                ghost:
                    "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)] hover:border-transparent",
                danger:
                    "bg-[var(--danger)] text-white hover:brightness-105",
            },
            size: {
                sm: "h-8 rounded-md px-3 text-xs",
                md: "h-10 rounded-md px-4",
                lg: "h-12 rounded-lg px-6 text-base",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    },
)

export interface ButtonProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
        VariantProps<typeof buttonVariants> {
    children: ReactNode
}

/**
 * Кнопка с вариантами оформления и поддержкой disabled-состояния.
 *
 * @param props - стандартные props кнопки и варианты `variant`/`size`
 * @returns кнопка
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({className, variant, size, children, ...properties}, ref) => {
        return (
            <button
                ref={ref}
                className={cn(buttonVariants({variant, size}), className)}
                aria-disabled={properties.disabled === true ? "true" : "false"}
                {...properties}
            >
                {children}
            </button>
        )
    },
)

Button.displayName = "Button"
