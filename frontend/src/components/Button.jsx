import React from 'react';
import { cn } from '../lib/cn';

const variants = {
  default:
    'bg-gradient-to-r from-primary to-primary/80 text-white shadow-soft hover:opacity-95',
  secondary:
    'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/15',
  outline:
    'bg-white/70 dark:bg-card/60 border border-primary/30 text-primary hover:bg-primary/5',
  ghost:
    'bg-transparent hover:bg-primary/10 text-slate-700 dark:text-slate-200',
  destructive:
    'bg-destructive text-white hover:opacity-95 shadow-soft',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export default Button;
