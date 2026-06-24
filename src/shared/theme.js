// ─── SHARED THEME ─────────────────────────────────────────────────────────────
// Base font import, resets, and the colour palette shared between the admin
// app and the public RSVP page, so both surfaces feel like one product.
export const theme = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cream: #faf7f2;
    --warm-white: #f5f0e8;
    --gold: #c9a84c;
    --gold-light: #e8d5a3;
    --gold-dark: #a07830;
    --charcoal: #2c2416;
    --brown: #5c4a2a;
    --red: #c0392b;
    --red-soft: #fdf0ee;
    --green: #2d6a4f;
    --green-soft: #edf7f2;
    --shadow: 0 2px 20px rgba(44,36,22,0.08);
    --shadow-lg: 0 8px 40px rgba(44,36,22,0.12);
    --radius: 12px;
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--charcoal); }
`;
