export const CHANNEL_TYPES = ['whatsapp', 'facebook', 'tiktok', 'instagram', 'line', 'phone', 'email', 'address', 'other'];

export const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', line: 'LINE',
  phone: 'Phone', email: 'Email', address: 'Address', other: 'Link',
};

export function channelHref(c) {
  if (c.url) return c.url;
  const v = (c.value || '').trim();
  const digits = v.replace(/\D/g, '');
  switch (c.type) {
    case 'whatsapp': return `https://wa.me/${digits}`;
    case 'phone': return `tel:+${digits}`;
    case 'email': return `mailto:${v}`;
    case 'address': return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    case 'facebook': return v.startsWith('http') ? v : `https://facebook.com/${v.replace(/^@/, '')}`;
    case 'instagram': return v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/, '')}`;
    case 'tiktok': return v.startsWith('http') ? v : `https://www.tiktok.com/@${v.replace(/^@/, '')}`;
    case 'line': return v.startsWith('http') ? v : `https://line.me/ti/p/~${v.replace(/^@/, '')}`;
    default: return v.startsWith('http') ? v : null;
  }
}

const P = {
  chat: 'M4 5h16v11H8l-4 4V5z',
  phone: 'M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  pin: 'M12 22s7-7.1 7-12a7 7 0 10-14 0c0 4.9 7 12 7 12zm0-9a3 3 0 110-6 3 3 0 010 6z',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zm10-2a3 3 0 11-6 0 3 3 0 016 0z',
  camera: 'M4 7h4l2-2h4l2 2h4v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
};
const ICON = { whatsapp: 'chat', line: 'chat', facebook: 'globe', tiktok: 'note', instagram: 'camera', phone: 'phone', email: 'mail', address: 'pin', other: 'globe' };

export function ChannelIcon({ type, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[ICON[type] || 'globe']} />
    </svg>
  );
}
