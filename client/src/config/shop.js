// One place for the shop's name, contact details and editable copy.
// Change these and the whole shop updates. Once the admin Settings page exists (phase 7),
// shop name, WhatsApp number, pickup details and cut-off time saved there override these.
export const SHOP = {
  name: 'Sika Beauty',
  logoWord: 'Sika', // shown as "Sika." in the header and footer
  city: 'Accra',
  whatsapp: '233240000000', // international format, digits only (used for wa.me links)
  whatsappDisplay: '+233 24 000 0000',
  email: 'hello@sikabeauty.example',
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/',
  cutoffTime: '[CUT-OFF TIME]',
  returnsDays: '[X]',
  credit: 'Site by [Your studio]',
}

// Homepage reviews. Paste real customer reviews here (from WhatsApp or Instagram).
// Only use real reviews. Delete an entry to show fewer.
export const REVIEWS = [
  { quote: '[Paste a real customer review from WhatsApp or Instagram here.]', name: '[Customer name]', area: '[area]', stars: 5 },
  { quote: '[Paste a real customer review from WhatsApp or Instagram here.]', name: '[Customer name]', area: '[area]', stars: 5 },
  { quote: '[Paste a real customer review from WhatsApp or Instagram here.]', name: '[Customer name]', area: '[area]', stars: 5 },
]

export const waLink = (text = '', number = SHOP.whatsapp) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
