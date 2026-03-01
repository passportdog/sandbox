export const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const cn = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
