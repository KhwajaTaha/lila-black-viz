
export function colorHue(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) + uid.charCodeAt(i);
    h = h >>> 0;
  }
  return h % 360;
}

export function playerColor(hue: number, alpha = 1): string {
  return `hsla(${hue}, 80%, 60%, ${alpha})`;
}

export function botColor(alpha = 1): string {
  return `rgba(160, 160, 160, ${alpha})`;
}

export function eventColor(eventType: string): string {
  switch (eventType) {
    case 'Kill':
    case 'BotKill':
      return '#ff4444';
    case 'Killed':
    case 'BotKilled':
    case 'KilledByStorm':
      return '#888888';
    case 'Loot':
      return '#ffd700';
    default:
      return '#ffffff';
  }
}
