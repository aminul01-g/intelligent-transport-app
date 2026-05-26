import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glassmorphic?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  glassmorphic = false,
  className = '',
  ...props
}) => {
  const baseStyle = 'p-6 rounded-xl border transition-shadow duration-200';
  const normalStyle = 'bg-zinc-900 border-zinc-800 shadow-lg';
  const glassStyle = 'bg-zinc-950/40 backdrop-blur-md border-zinc-800/80 shadow-xl';

  return (
    <div
      className={`${baseStyle} ${glassmorphic ? glassStyle : normalStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
