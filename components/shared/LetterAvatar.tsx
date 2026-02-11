const LetterAvatar = ({ name }: { name: string }) => {
  const initials = name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-900 text-white font-bold text-xs shadow-sm border-2 border-white dark:border-zinc-800 shrink-0">
      {initials || 'U'}
    </div>
  );
};

export default LetterAvatar;
