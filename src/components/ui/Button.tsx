import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold " +
  "transition-[background-color,border-color,color,transform,translate] duration-200 ease-out active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  solid: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
  outline: "border border-border-strong text-text hover:border-accent hover:text-accent",
  ghost: "text-text-muted hover:text-text",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-6 text-base",
  md: "h-13 px-7 text-[17px]",
  lg: "h-16 px-10 text-lg",
};

type Common = { variant?: Variant; size?: Size; className?: string };

export function buttonClasses({ variant = "solid", size = "md", className = "" }: Common = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({ variant, size, className, ...props }: Common & ComponentProps<"button">) {
  return <button data-magnetic="" className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link data-magnetic="" className={buttonClasses({ variant, size, className })} {...props} />;
}
