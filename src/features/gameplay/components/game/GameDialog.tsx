"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GameDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  actions: ReactNode;
};

export function GameDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: GameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={
          onOpenChange ? undefined : (event) => event.preventDefault()
        }
      >
        <header className="px-4 py-5 text-center sm:py-7">
          <DialogTitle className="font-heading text-4xl sm:text-5xl">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </header>
        <div className="min-h-48 border-y border-border bg-background-secondary px-5 py-8 sm:min-h-80 sm:px-8">
          {children}
        </div>
        <footer className="flex flex-wrap gap-3 px-4 py-5 sm:px-7">
          {actions}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export function DialogAction({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn(
        "h-auto min-h-12 whitespace-normal border-foreground/60 px-4 py-3 text-base shadow-[inset_0_0_0_3px_var(--background),inset_0_0_0_4px_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}
