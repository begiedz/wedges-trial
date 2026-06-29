import type { ReactNode } from "react";

import { joinClasses } from "../utils";

type ActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "accent" | "default" | "success";
};

const variantClasses: Record<
  NonNullable<ActionButtonProps["variant"]>,
  string
> = {
  accent: "border-amber-500 bg-amber-400 text-zinc-950 hover:bg-amber-300",
  default:
    "border-zinc-300 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 hover:border-zinc-400",
  success: "border-emerald-700 text-emerald-800 dark:text-emerald-100",
};

export function ActionButton({
  children,
  disabled = false,
  onClick,
  type = "button",
  variant = "default",
}: ActionButtonProps) {
  return (
    <button
      className={joinClasses(
        "rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
