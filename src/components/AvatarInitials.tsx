export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ES';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AvatarInitials({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7 text-xs'
      : size === 'lg'
        ? 'w-16 h-16 text-xl'
        : 'w-9 h-9 text-sm';

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} rounded-full bg-primary text-white font-semibold inline-flex items-center justify-center shrink-0`}
    >
      {getInitials(name)}
    </span>
  );
}
