import { FAQS, FEATURES, PRINTERS, CAMERAS, ADDONS } from '../data/content.js'

export const SITE_ORIGIN = 'https://happypix.in'
export const SITE_ORIGIN_AU = 'https://happypix.com.au'
export const SITE_NAME = 'HappyPix'
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/images/hero-pro-1.jpg`

function buildBreadcrumbSchema(path, label) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${SITE_ORIGIN}/`,
    },
  ]
  if (path && path !== '/') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: label,
      item: `${SITE_ORIGIN}${path}`,
    })
  }
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

function buildFaqSchema() {
  return {
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }
}

function buildPricingOffersSchema() {
  const planOffers = [
    // 12 Months (Annual)
    { name: 'Basic Plan — 12 Months (Annual · 2 Devices)', price: '5988', monthlyRate: '499', duration: 'P12M', description: 'Annual: ₹499/Month - 2 Devices = ₹5,988/year excluding GST 18%' },
    { name: 'Pro Plan — 12 Months (Annual · 2 Devices)', price: '8388', monthlyRate: '699', duration: 'P12M', description: 'Annual: ₹699/Month - 2 Devices = ₹8,388/year (excluding GST 18%)' },
    { name: 'Premium Plan — 12 Months (Annual · 2 Devices)', price: '9588', monthlyRate: '799', duration: 'P12M', description: 'Annual: ₹799/Month - 2 Devices = ₹9,588/year (excluding GST 18%)' },
    // 6 Months
    { name: 'Basic Plan — 6 Months (2 Devices)', price: '4794', monthlyRate: '799', duration: 'P6M', description: '₹799/Month - 2 Devices = ₹4,794/6 Months excluding GST 18%' },
    { name: 'Pro Plan — 6 Months (2 Devices)', price: '5994', monthlyRate: '999', duration: 'P6M', description: '₹999/Month - 2 Devices = ₹5,994/6 Months (excluding GST 18%)' },
    { name: 'Premium Plan — 6 Months (2 Devices)', price: '6594', monthlyRate: '1099', duration: 'P6M', description: '₹1,099/Month - 2 Devices = ₹6,594/6 Months (excluding GST 18%)' },
    // 3 Months
    { name: 'Basic Plan — 3 Months (2 Devices)', price: '2847', monthlyRate: '949', duration: 'P3M', description: '₹949/Month - 2 Devices = ₹2,847/3 Months excluding GST 18%' },
    { name: 'Pro Plan — 3 Months (2 Devices)', price: '3447', monthlyRate: '1149', duration: 'P3M', description: '₹1,149/Month - 2 Devices = ₹3,447/3 Months (excluding GST 18%)' },
    { name: 'Premium Plan — 3 Months (2 Devices)', price: '3897', monthlyRate: '1299', duration: 'P3M', description: '₹1,299/Month - 2 Devices = ₹3,897/3 Months (excluding GST 18%)' },
    // 1 Month (Monthly)
    { name: 'Basic Plan — 1 Month (Monthly · 2 Devices)', price: '1099', monthlyRate: '1099', duration: 'P1M', description: 'Monthly: ₹1,099/Month - 2 Devices = ₹13,188/year excluding GST 18%' },
    { name: 'Pro Plan — 1 Month (Monthly · 2 Devices)', price: '1299', monthlyRate: '1299', duration: 'P1M', description: 'Monthly: ₹1,299/Month - 2 Devices = ₹15,588/year excluding GST 18%' },
    { name: 'Premium Plan — 1 Month (Monthly · 2 Devices)', price: '1499', monthlyRate: '1499', duration: 'P1M', description: 'Monthly: ₹1,499/Month - 2 Devices = ₹17,988/year excluding GST 18%' },
  ]

  const addonOffers = ADDONS.map((addon) => ({
    '@type': 'Offer',
    name: `${addon.name} (Add-on)`,
    description: `${addon.desc} (₹249 excluding GST 18%)`,
    price: '249',
    priceCurrency: 'INR',
    availability: 'https://schema.org/InStock',
    url: `${SITE_ORIGIN}/pricing#checkout`,
  }))

  return {
    '@type': 'SoftwareApplication',
    name: 'HappyPix Photo Booth Platform & Operator CRM',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Android, iPadOS, Windows, Web',
    url: `${SITE_ORIGIN}/pricing`,
    offers: [
      {
        '@type': 'Offer',
        name: '14-Day Free Trial (1 Booth · 1 Event)',
        price: '0',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: `${SITE_ORIGIN}/pricing#checkout`,
      },
      ...planOffers.map((item) => ({
        '@type': 'Offer',
        name: item.name,
        description: item.description,
        price: item.price,
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: `${SITE_ORIGIN}/pricing#checkout`,
      })),
      ...addonOffers,
    ],
  }
}

export const ROUTE_SEO = {
  '/': {
    title: 'HappyPix — Photo Booth Software, Hardware & CRM | Every Pixel is a Happy Moment',
    description:
      'HappyPix is the all-in-one photo booth platform for events, weddings, malls & operators. Studio-grade DNP instant prints, 24h QR digital copies, Canon camera tethering, UPI booth payments & operator CRM. Plans from ₹499/Month (2 devices included).',
    keywords:
      'photo booth software India, photobooth business India, wedding photo booth software, DNP printer photo booth, Canon tether photo booth app, pay per print kiosk, QR photo download booth, HappyPix CRM',
    image: `${SITE_ORIGIN}/images/hero-pro-1.jpg`,
    imageAlt: 'HappyPix photo booth guests posing and printing photo strips at an event',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/#webpage`,
          url: `${SITE_ORIGIN}/`,
          name: 'HappyPix — Photo Booth Software, Hardware & CRM',
          description:
            'The all-in-one photo booth platform for events, venues and operators — software, hardware and a CRM that runs your whole booth business.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/', 'Home'),
        buildFaqSchema(),
      ],
    }),
  },

  '/pricing': {
    title: 'Photo Booth Software Pricing & Plans (from ₹499/mo · 2 Devices) | HappyPix',
    description:
      'Transparent HappyPix subscription plans for 12, 6, 3, and 1 Month durations (excluding GST 18%). Basic from ₹499/mo, Pro from ₹699/mo, Premium from ₹799/mo — all with 2 devices included. Any add-on is ₹249. Start a 14-day free trial.',
    keywords:
      'photo booth software price India, photobooth subscription plans, HappyPix pricing, photo booth CRM pricing, 2 device photo booth plan, photo booth add-ons India',
    image: `${SITE_ORIGIN}/images/hero-booth.jpg`,
    imageAlt: 'HappyPix photo booth software subscription plans and pricing',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/pricing#webpage`,
          url: `${SITE_ORIGIN}/pricing`,
          name: 'HappyPix Pricing & Subscription Plans',
          description:
            'Compare HappyPix Basic, Pro, and Premium photo booth plans across 12, 6, 3, and 1 Month billing cycles (2 devices included, excluding GST 18%) plus ₹249 modular add-ons.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/pricing', 'Pricing & Plans'),
        buildPricingOffersSchema(),
        buildFaqSchema(),
      ],
    }),
  },

  '/booth': {
    title: 'The HappyPix Booth Experience — Instant Prints & 24h QR Digital Copies',
    description:
      'Explore the HappyPix guest photo booth experience: branded welcome screen, live camera countdown, custom print templates, stickers, ~12-second DNP prints, and private 24-hour QR digital downloads.',
    keywords:
      'interactive photo booth experience, QR code photo booth download, instant print photo booth India, retro photo booth kiosk, wedding photo booth guest flow',
    image: `${SITE_ORIGIN}/images/hero-booth.jpg`,
    imageAlt: 'Guests using the HappyPix interactive touchscreen photo booth and scanning QR digital copies',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/booth#webpage`,
          url: `${SITE_ORIGIN}/booth`,
          name: 'The HappyPix Photo Booth Experience',
          description:
            'Retro soul, studio standards: countdown, flash, ~12-second warm print and 24-hour private QR digital copy.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/booth', 'The Booth'),
        {
          '@type': 'Service',
          name: 'HappyPix Interactive Photo Booth & Instant Print Experience',
          provider: { '@id': `${SITE_ORIGIN}/#organization` },
          serviceType: 'Photo Booth Software & Event Experience',
          areaServed: ['IN', 'AU'],
          description:
            'Complete guest photo booth workflow with branded start screens, live view countdown, custom frames, instant dye-sub printing, UPI booth payments, and 24-hour private QR digital downloads.',
        },
      ],
    }),
  },

  '/software': {
    title: 'Photo Booth App & Operator CRM Software (Android, iPad & Windows) | HappyPix',
    description:
      'One photo booth platform for every screen: kiosk apps for Android tablets, iPad & Windows plus a cloud operator CRM for events, AI templates, background removal, Razorpay/UPI payments, galleries & analytics.',
    keywords:
      'photo booth app Android, iPad photo booth software, Windows photo booth kiosk software, photo booth CRM dashboard, AI photo booth background removal, UPI pay per print photo booth',
    image: `${SITE_ORIGIN}/images/guests-party.jpg`,
    imageAlt: 'HappyPix photo booth kiosk app and cloud CRM control room',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/software#webpage`,
          url: `${SITE_ORIGIN}/software`,
          name: 'HappyPix Photo Booth App & Operator CRM Software',
          description:
            'Booth kiosk software and cloud CRM for managing events, devices, custom templates, AI cutouts, UPI payments, and guest galleries.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/software', 'Software & CRM'),
        {
          '@type': 'SoftwareApplication',
          name: 'HappyPix Booth App & Operator CRM',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Android 10+, iPadOS 16+, Windows 10/11, Web',
          featureList: FEATURES.map((f) => `${f.title}: ${f.text}`),
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'INR',
            lowPrice: '499',
            highPrice: '1499',
            offerCount: '12',
            url: `${SITE_ORIGIN}/pricing`,
          },
        },
      ],
    }),
  },

  '/hardware': {
    title: 'Photo Booth Hardware Compatibility — DNP Printers & Canon Cameras | HappyPix',
    description:
      'HappyPix works natively with industry-standard DNP dye-sublimation printers (DS620A, DS820A, DS-RX1HS, QW410, DS40, DS80) and Canon EOS mirrorless & DSLR cameras over USB tethering and Canon CCAPI.',
    keywords:
      'DNP DS-RX1HS photo booth software, DNP DS620A photo booth, Canon EOS R50 photo booth tethering, Canon CCAPI photo booth, photo booth hardware India, portable photo booth kit',
    image: `${SITE_ORIGIN}/images/retro-booth.jpg`,
    imageAlt: 'HappyPix portable photo booth hardware with Canon camera and DNP dye-sub printer',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/hardware#webpage`,
          url: `${SITE_ORIGIN}/hardware`,
          name: 'HappyPix Hardware & Printer/Camera Compatibility',
          description:
            'Supported DNP dye-sublimation printers and Canon EOS tethered cameras for HappyPix photo booths.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/hardware', 'Hardware & Compatibility'),
        {
          '@type': 'ItemList',
          name: 'Compatible Photo Booth Printers & Cameras',
          itemListElement: [
            ...PRINTERS.map((p, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: `${p.brand} ${p.model} (${p.kind})`,
              description: p.note,
            })),
            ...CAMERAS.map((c, idx) => ({
              '@type': 'ListItem',
              position: PRINTERS.length + idx + 1,
              name: `${c.brand} ${c.model} (${c.kind})`,
              description: `Status: ${c.status}`,
            })),
          ],
        },
      ],
    }),
  },

  '/business': {
    title: 'Start a Photo Booth Business in India — ROI & Earnings Calculator | HappyPix',
    description:
      'Run the numbers on starting a photo booth business in India. Event rentals (₹20k–60k/event), unattended pay-per-print UPI kiosks, and custom photo merchandise. Interactive earnings calculator & 5-step operator playbook.',
    keywords:
      'start photo booth business India, photo booth business cost India, photo booth ROI calculator, pay per print photo booth business, wedding photo booth rental business',
    image: `${SITE_ORIGIN}/images/wedding-booth.jpg`,
    imageAlt: 'HappyPix photo booth business operator at a wedding event',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE_ORIGIN}/business#webpage`,
          url: `${SITE_ORIGIN}/business`,
          name: 'Start a Photo Booth Business with HappyPix — Playbook & Calculator',
          description:
            'Honest startup maths, three photo booth revenue models, interactive earnings calculator, and real operator stories across India.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        },
        buildBreadcrumbSchema('/business', 'Business Case & Calculator'),
        {
          '@type': 'HowTo',
          name: 'How to Start a Profitable Photo Booth Business in India',
          description:
            'Five-step playbook used by 120+ HappyPix operators to launch and scale a weekend or full-time photo booth business.',
          estimatedCost: {
            '@type': 'MonetaryAmount',
            currency: 'INR',
            minValue: '120000',
            maxValue: '250000',
          },
          step: [
            {
              '@type': 'HowToStep',
              position: 1,
              name: 'Pick your first market',
              text: 'Start with one city and a crowd you know — housing societies, college fests, or banquet halls near home.',
            },
            {
              '@type': 'HowToStep',
              position: 2,
              name: 'Get the kit together',
              text: 'Assemble your booth unit, DNP dye-sub printer, Canon EOS camera, backdrop, and paper stock.',
            },
            {
              '@type': 'HowToStep',
              position: 3,
              name: 'Do two showcase events',
              text: 'Run two initial events to capture real photos, reviews, and your first branded HappyPix gallery.',
            },
            {
              '@type': 'HowToStep',
              position: 4,
              name: 'List, quote, and book',
              text: 'Share your gallery link, quote within the hour, take a 30% advance, and track bookings in the HappyPix CRM.',
            },
            {
              '@type': 'HowToStep',
              position: 5,
              name: 'Add a second income line',
              text: 'Combine weekend event rentals with weekday UPI pay-per-print placements, fridge magnets, and bookmarks.',
            },
          ],
        },
      ],
    }),
  },

  '/contact': {
    title: 'Contact HappyPix — Book a Demo, Hardware Compatibility & Support',
    description:
      'Talk to the HappyPix team: book a live 20-minute software & CRM demo, check DNP printer or Canon camera compatibility, inquire about booth hardware pre-orders, or get operator support.',
    keywords:
      'contact HappyPix, book photo booth software demo, HappyPix support, photo booth hardware inquiry India',
    image: `${SITE_ORIGIN}/images/hero-pro-2.jpg`,
    imageAlt: 'Contact HappyPix for a live photo booth demo or hardware check',
    schema: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ContactPage',
          '@id': `${SITE_ORIGIN}/contact#webpage`,
          url: `${SITE_ORIGIN}/contact`,
          name: 'Contact HappyPix — Book a Demo & Support',
          description:
            'Reach HappyPix for live product demos, printer/camera compatibility checks, enterprise plans, and customer support.',
          isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
          mainEntity: { '@id': `${SITE_ORIGIN}/#organization` },
        },
        buildBreadcrumbSchema('/contact', 'Contact'),
      ],
    }),
  },
}

export function resolveRouteSeo(pathname = '/') {
  if (pathname.startsWith('/download')) {
    return {
      title: 'Your HappyPix Digital Photo Copy | Private 24-Hour Download',
      description: 'Download your private HappyPix photo booth strip and individual frames before the 24-hour link expires.',
      robots: 'noindex, nofollow',
      canonicalPath: pathname,
      image: DEFAULT_OG_IMAGE,
      imageAlt: 'HappyPix digital photo download',
      schema: null,
    }
  }

  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
  const match = ROUTE_SEO[normalized]
  if (match) {
    return {
      ...match,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      canonicalPath: normalized,
    }
  }

  return {
    title: 'Page Not Found | HappyPix',
    description: 'The page you are looking for could not be found on HappyPix.',
    robots: 'noindex, nofollow',
    canonicalPath: normalized,
    image: DEFAULT_OG_IMAGE,
    imageAlt: 'HappyPix',
    schema: null,
  }
}
