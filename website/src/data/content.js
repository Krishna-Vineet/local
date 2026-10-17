// ─── HappyPix website content ─────────────────────────────────
// Feature language is inspired by the best photo-booth platforms in
// the world, but every capability listed as "live" below is one the
// HappyPix stack actually ships today (booth + CRM + this website).
// Roadmap items are always badged honestly as Launching / Coming soon.

export const BRAND = {
  pink: '#EA097F',
  pinkDeep: '#9E0554',
  blue: '#3871C1',
  green: '#85C536',
  purple: '#5F4CAA',
  amber: '#FFB03A',
  ink: '#141020',
  cream: '#FFF7EA',
}

export const STATS = [
  { value: '2,310+', label: 'photos captured at events' },
  { value: '479+', label: 'happy guests & users' },
  { value: '32+', label: 'software subscriptions' },
  { value: '24 hrs', label: 'guest download window' },
]

export const EVENT_TYPES = [
  'Weddings', 'Corporate galas', 'Birthdays', 'Campus fests', 'Brand launches',
  'Mall activations', 'Sangeets', 'Exhibitions', 'House parties', 'Award nights',
]

export const FEATURES = [
  {
    icon: 'layouts', tone: 'pink', title: 'Layouts guests actually love',
    text: 'Classic strips, 4×6 pages, multi-pose grids and square social formats — every layout keeps print-true geometry, so what guests see is exactly what the printer gives them.',
  },
  {
    icon: 'sparkles', tone: 'purple', title: 'AI templates & background removal',
    text: 'Generate a themed frame from a line of text, or lift guests straight out of the venue with AI background removal — no green screen, no studio, no fuss.',
  },
  {
    icon: 'sliders', tone: 'blue', title: 'Filters, stickers & signatures',
    text: 'Warm, vintage, B&W and party filters, playful stickers and draw-on signatures. Guests personalise; the booth keeps the brand frame perfectly intact.',
  },
  {
    icon: 'qr', tone: 'green', title: 'Instant QR digital copies',
    text: 'Every session mints a private download page. Guests scan the QR on the success screen and save their strip in seconds — the link self-expires in 24 hours.',
  },
  {
    icon: 'wallet', tone: 'amber', title: 'Payments built into the booth',
    text: 'Razorpay & UPI pricing per layout, coupons, free-mode for hosted events and print limits per session. No separate card machine, no cash box.',
  },
  {
    icon: 'gallery', tone: 'pink', title: 'A gallery that fills itself',
    text: 'Final prints stream into your organization gallery in the CRM as sessions finish — filterable by event and booth, ready to share with clients the same night.',
  },
  {
    icon: 'chart', tone: 'blue', title: 'A CRM for the whole business',
    text: 'Events, devices, teams, coupons, revenue, support and plan limits — run six booths or sixty from one calm dashboard, with roles for every team member.',
  },
  {
    icon: 'shield', tone: 'purple', title: 'Consent & privacy, respected',
    text: 'Guests choose whether their photos may be featured. Galleries can require consent, download links expire, and every organization sees only its own data.',
  },
]

export const HOW_IT_WORKS = [
  { step: '01', title: 'Pair your booth', text: 'Sign in on the booth once. Your events, templates, prices and branding sync down — and keep working even if the venue Wi-Fi doesn’t.' },
  { step: '02', title: 'Design the moment', text: 'Pick layouts, add logos and frames, set per-layout prices or go fully hosted. Push changes from the CRM; the booth picks them up live.' },
  { step: '03', title: 'Guests do the rest', text: 'Countdown, poses, filters, stickers, print. The retro ritual everyone remembers — with studio light and a real camera doing the work.' },
  { step: '04', title: 'Print + QR, together', text: 'Prints land in the tray while the success screen shows a QR. Guests scan and download their digital strip before they even leave the booth.' },
  { step: '05', title: 'You watch it land', text: 'Photos appear in your gallery, revenue in your dashboard, prints counted per device. Pack up knowing exactly how the night went.' },
]

export const PLATFORMS = [
  {
    id: 'android', name: 'Android Tablets', icon: 'tablet', status: 'Launching soon',
    text: 'Turn the tablets you already own into full HappyPix booths — camera, touch flow, printing and QR sharing in a locked-down kiosk mode.',
    points: ['Kiosk lock-down', 'Phone & USB cameras', 'Works offline, syncs later'],
  },
  {
    id: 'ipad', name: 'iPad', icon: 'tablet', status: 'Launching soon',
    text: 'The prettiest front-of-house deserves the prettiest booth. The full HappyPix guest flow, designed for iPad and AirPrint-ready setups.',
    points: ['Front & rear camera flow', 'AirPrint + DNP via bridge', 'Guided-access ready'],
  },
  {
    id: 'windows', name: 'Windows Kiosk', icon: 'monitor', status: 'Launching soon',
    text: 'Our most powerful booth build: Canon tethering, DNP workhorse printers and big touchscreens for permanent installs and rental fleets.',
    points: ['Canon USB / CCAPI tether', 'DNP professional printers', 'Permanent-install mode'],
  },
]

export const PRINTERS = [
  { brand: 'DNP', model: 'DS620A', kind: 'Dye-sub · 4×6 / 5×7 / 6×8', status: 'Compatible', note: 'The event workhorse — fast, dry, smudge-free prints.' },
  { brand: 'DNP', model: 'DS820A', kind: 'Dye-sub · up to 8×12', status: 'Compatible', note: 'Bigger pages for premium portrait-style booths.' },
  { brand: 'DNP', model: 'DS-RX1HS', kind: 'Dye-sub · 4×6 / 6×8', status: 'Compatible', note: 'The rental-fleet favourite; HappyPix prints to it today.' },
  { brand: 'DNP', model: 'QW410', kind: 'Dye-sub · compact 4×6', status: 'Compatible', note: 'Ultra-compact for tablet-led and pop-up setups.' },
  { brand: 'DNP', model: 'DS40', kind: 'Dye-sub · 4×6 / 5×7 / 6×9', status: 'Compatible', note: 'A proven classic still running fleets worldwide.' },
  { brand: 'DNP', model: 'DS80', kind: 'Dye-sub · 8×10 / 8×12', status: 'Compatible', note: 'Large-format enlargements at the booth.' },
]

export const CAMERAS = [
  { brand: 'Canon', model: 'EOS R5 / R6 Mark II', kind: 'Mirrorless · USB + CCAPI', status: 'Compatible' },
  { brand: 'Canon', model: 'EOS R50 / R100', kind: 'Mirrorless · USB + CCAPI', status: 'Compatible' },
  { brand: 'Canon', model: 'EOS RP / EOS R', kind: 'Mirrorless · USB + CCAPI', status: 'Compatible' },
  { brand: 'Canon', model: 'EOS M50 Mark II', kind: 'Mirrorless · USB', status: 'Compatible' },
  { brand: 'Canon', model: 'EOS 90D / 250D', kind: 'DSLR · USB tether', status: 'Compatible' },
  { brand: 'Canon', model: 'EOS 2000D / 4000D', kind: 'DSLR · USB tether', status: 'Compatible' },
  { brand: 'Canon', model: 'PowerShot G7 X Mark III', kind: 'Compact · USB', status: 'Compatible' },
]

export const TESTIMONIALS = [
  {
    quote: 'The print comes out, the QR pops up, and guests are posting before they reach the bar. Our wedding clients think we hired a bigger team.',
    name: 'Sunset Weddings', role: 'Wedding photography studio', initials: 'SW', tone: 'pink',
  },
  {
    quote: 'We run launches across three cities. Templates, prices and coupons update from the CRM and every booth just… follows. It feels unfair.',
    name: 'Pika Events', role: 'Brand activations', initials: 'PE', tone: 'blue',
  },
  {
    quote: 'Guests keep the strip, I keep the data. Seeing every final print in the gallery the same night ended our end-of-event scramble forever.',
    name: 'Glow Booth Co.', role: 'Booth rental fleet', initials: 'GB', tone: 'purple',
  },
]

/* ---- business side: how operators actually make money ---- */
export const BUSINESS_MODELS = [
  {
    id: 'rental', color: 'var(--pink)', chip: 'Most popular', title: 'Event rental',
    desc: 'Hire the booth out per event — weddings, birthdays, corporate parties. You quote a package, drop it off (or host it), and collect the prints and the payment.',
    facts: [['Typical booking', '₹20,000 – ₹60,000'], ['Per event', '3–5 hours'], ['Your effort', 'Setup + standby host']],
  },
  {
    id: 'payperprint', color: 'var(--blue)', chip: 'No booking needed', title: 'Pay-per-print',
    desc: 'Park the booth in a mall, café, cinema or fair and let guests pay per print or strip. The booth takes UPI and card payments itself — nobody needs to stand next to it.',
    facts: [['Per print', '₹99 – ₹299'], ['Per busy day', '150–400 prints'], ['Your effort', 'Paper & ink refills']],
  },
  {
    id: 'venue', color: 'var(--purple)', chip: 'Steady income', title: 'Venue placement',
    desc: 'Place a booth permanently in a banquet hall, pub or family restaurant. The venue gets a crowd-pleaser, you split revenue or charge a monthly placement fee.',
    facts: [['Placement fee', '₹10,000 – ₹30,000/mo'], ['Or revenue share', '60/40 typical'], ['Your effort', 'Weekly check-ins']],
  },
];

export const VENUES = [
  { img: '/images/wedding-booth.jpg', cls: 'v-a', name: 'Weddings & receptions', note: 'The classic. 300 guests, one booth, a queue all night — and a guestbook full of strips.' },
  { img: '/images/guests-party.jpg', cls: 'v-b', name: 'Birthdays & house parties', note: 'Milestone birthdays, anniversaries, baby showers — smaller crowds, higher print rates.' },
  { img: '/images/hero-booth.jpg', cls: 'v-c', name: 'Corporate events', note: 'Brand the start screen and templates with the sponsor logo. Companies pay for the data too.' },
  { img: '/images/retro-booth.jpg', cls: 'v-d', name: 'Malls, cafés & cinemas', note: 'Pay-per-print placements that earn while you sleep — UPI in, strip out.' },
  { img: '/images/wedding-booth.jpg', cls: 'v-e', name: 'College fests & expos', note: 'Sponsors love the footfall magnet; lead-capture surveys turn photos into signups.' },
];

export const STORIES = [
  {
    name: 'Priya Sharma', initials: 'PS', color: 'var(--pink)', city: 'Mumbai', model: 'Wallet-print studio',
    img: '/images/guests-party.jpg',
    quote: 'I started with birthday parties in my own housing society. The wallet-size prints were the hit — aunties would order ten copies for the family WhatsApp. Now I do 6–8 events a month alongside my job.',
    stats: [['₹48k', 'avg. month'], ['38', 'events done'], ['4.2 mo', 'to break even']],
    tags: ['Wallet prints', 'Weekends'],
  },
  {
    name: 'Rohan Mehta', initials: 'RM', color: 'var(--blue)', city: 'Pune', model: 'Magnet-print booth',
    img: '/images/wedding-booth.jpg',
    quote: 'Fridge magnets changed everything. A strip peels off and sticks on the fridge — guests keep it for years, with my brand on the back. Corporate clients rebook because their logo lives in 200 kitchens.',
    stats: [['₹92k', 'best month'], ['11', 'repeat clients'], ['2 booths', 'and hiring']],
    tags: ['Magnet prints', 'Corporate'],
  },
  {
    name: 'Aisha Khan', initials: 'AK', color: 'var(--purple)', city: 'Bengaluru', model: 'Bookmark keepsakes',
    img: '/images/retro-booth.jpg',
    quote: 'I sell laminated photo bookmarks at fairs and college fests — ₹199 each, made in 40 seconds. Book launches, literature fests, school fairs: anywhere people love books, the queue finds me.',
    stats: [['₹199', 'per bookmark'], ['300+', 'per fest day'], ['9 fests', 'booked this season']],
    tags: ['Laminated bookmarks', 'Fairs & fests'],
  },
  {
    name: 'Daniel D’Souza', initials: 'DD', color: '#5f9420', city: 'Goa', model: 'Resort & venue placements',
    img: '/images/hero-booth.jpg',
    quote: 'Two booths live permanently in beach resorts. Tourists pay per print, the resort takes a cut, I refill paper twice a week. December alone paid for the second booth.',
    stats: [['2', 'booths placed'], ['₹1.1L', 'December take'], ['2 visits', 'per week']],
    tags: ['Pay-per-print', 'Placements'],
  },
];

export const WHY_POINTS = [
  { color: 'var(--pink)', ic: '🖨️', title: 'Prints that are products, not handouts', desc: 'Wallet prints, fridge magnets, laminated bookmarks — physical keepsakes guests pay for and keep for years. That is a product line, not a photo gimmick.' },
  { color: 'var(--blue)', ic: '📴', title: 'Works where events actually happen', desc: 'Farms, rooftops, hill stations, basement banquet halls. The booth runs its full session offline and syncs galleries, leads and analytics when Wi-Fi returns.' },
  { color: 'var(--green)', ic: '💸', title: 'Gets paid without you standing there', desc: 'UPI and card payments on the booth itself for pay-per-print, plus quotes, bookings and invoices in the CRM for rentals. Cash stops leaking.' },
  { color: 'var(--purple)', ic: '🔗', title: 'Guests leave with your brand', desc: 'Every guest downloads from your branded page within hours of the event — your logo, your colors, your next-booking button in front of a warm audience.' },
];

/* plan feature matrix (rows × plan names) */
export const PLAN_MATRIX = [
  ['Unlimited photo sessions & templates', true, true, true],
  ['Live view, countdown & retakes', true, true, true],
  ['Instant printing (DNP & Canon SELPHY)', true, true, true],
  ['Guest QR download page (24-hour link)', true, true, true],
  ['CRM: events, galleries & designs', true, true, true],
  ['Custom branding on booth & downloads', false, true, true],
  ['Premium template library', false, true, true],
  ['Cloud storage — 30 days', false, true, true],
  ['AI headshot mode', false, true, true],
  ['Booth payments (UPI / cards)', false, false, true],
  ['Video booth & GIF / boomerang', false, false, true],
  ['Survey & lead capture', false, false, true],
  ['Business analytics & reports', false, false, true],
  ['Dedicated account manager', false, false, true],
  ['Priority support', false, true, true],
];

// Fallback copy for the add-on section if the catalogue API has no
// add-on rows yet — live add-ons (kind: 'addon') replace this list and
// its prices. Prices are never hard-coded here: they come from the catalogue.
export const ADDONS = [
  { key: 'addon-headshot', name: 'Professional Headshot Mode', desc: 'Studio-style AI headshots for corporate events and campuses.' },
  { key: 'addon-video', name: 'Video Booth Mode', desc: 'Video, GIF & boomerang capture with slow-motion for social-first crowds.' },
  { key: 'addon-branding', name: 'Custom Start Screen Branding', desc: 'Your own start screen, colours and sponsor logos.' },
  { key: 'addon-survey', name: 'Survey & Lead Capture', desc: 'Ask three questions before the photo — turn footfall into a mailing list.' },
  { key: 'addon-music', name: 'Custom Music & Sound Effects', desc: 'Event soundtracks and branded audio cues.' },
  { key: 'addon-props', name: 'Fun Event Props & Frames Pack', desc: '30 props and 2 premium frames, unlocked forever.' },
];

export const FAQS = [
  {
    q: 'Do I need to buy a HappyPix booth to use the software?',
    a: 'No. HappyPix is software-first: start with the booth app on your own hardware, and add printers and cameras from the compatibility list. Our own booth hardware is coming soon for operators who want the full turn-key ritual.',
  },
  {
    q: 'How does the guest digital copy work?',
    a: 'When a session finishes, the booth creates a private download page and shows its QR code on the success screen. Guests scan, open the page and save the final strip plus individual frames. Every link expires automatically 24 hours after the session.',
  },
  {
    q: 'Which printers and cameras work with HappyPix?',
    a: 'DNP dye-sub printers (DS620A, DS820A, DS-RX1HS, QW410, DS40, DS80) and Canon cameras over USB tethering / CCAPI are supported today — see the Hardware page for the full list.',
  },
  {
    q: 'Can I charge guests per print?',
    a: 'Yes. Set a price per layout, accept Razorpay / UPI at the booth, run coupon codes, or switch an event to free hosted mode. Caps on prints per session keep paper costs predictable.',
  },
  {
    q: 'What happens when I renew from this website?',
    a: 'Pay with Razorpay using the same email as your CRM account and your existing password — we verify it, then extend your plan from its current expiry so no paid day is lost. New here? Your organization and admin account are created the moment payment confirms.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Every new organization starts with a 14-day trial on a single booth — full product, no card required. Upgrade whenever you are ready.',
  },
]

export const PLAN_HIGHLIGHTS = {
  trial: ['Full product for 14 days', '1 booth · 1 event', 'QR digital copies', 'Organization gallery'],
  basic: ['2 devices included', '2 parallel events', 'Instant printing + QR downloads', 'Operator dashboard & gallery'],
  pro: ['2 devices included', '4 parallel events', 'Custom branding & premium templates', 'Cloud gallery — 30 days'],
  premium: ['2 devices included', '8 parallel events', 'AI templates + 500 credits', 'Analytics, own gateways, priority support'],
  custom: ['Customisable — volume booths', 'Custom limits & onboarding', 'Dedicated success manager', 'Talk to sales →'],
}
