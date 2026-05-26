import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-medium rounded-lg '
    + 'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm border border-transparent',
    secondary:
      'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 focus:ring-zinc-600 border border-zinc-700',
    danger:
      'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm border border-transparent',
    ghost:
      'bg-transparent hover:bg-zinc-800 text-zinc-300 focus:ring-zinc-600 border border-transparent',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const currentVariant = variants[variant];
  const currentSize = sizes[size];
  const opacity = disabled || isLoading ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`${baseStyle} ${currentVariant} ${currentSize} ${opacity} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
};
