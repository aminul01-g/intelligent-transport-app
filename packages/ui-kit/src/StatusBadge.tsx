import React from 'react';

export interface StatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const configs = {
    ACTIVE: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      label: 'Active',
    },
    INACTIVE: {
      bg: 'bg-zinc-500/15',
      text: 'text-zinc-400',
      label: 'Inactive',
    },
    MAINTENANCE: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      label: 'Maintenance',
    },
    OUT_OF_SERVICE: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      label: 'Out of Service',
    },
  };

  const config = configs[status];

  const classes = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold '
    + `${config.bg} ${config.text} ${className}`;

  return (
    <span className={classes}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
};
