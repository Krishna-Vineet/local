const fs = require('fs');

let svg = fs.readFileSync('c:/happypix/client-app/apps/booth/src/assets/logo_dark.svg', 'utf8');

// The styles we extracted:
// .cls-1 { fill: none; }
// .cls-2 { fill: #ea097f; }
// .cls-3 { clip-path: url(#clippath-1); }
// .cls-4 { fill: #fff; }
// .cls-5 { fill: #3871c1; }
// .cls-6 { fill: red; }
// .cls-7 { fill: aqua; }
// .cls-8 { fill: #5f4caa; }
// .cls-9 { clip-path: url(#clippath); }
// .cls-10 { fill: #85c536; }

const replacements = {
  'class="cls-1"': 'fill="none"',
  'class="cls-2"': 'fill="#ea097f"',
  'class="cls-3"': 'clipPath="url(#clippath-1)"',
  'class="cls-4"': 'fill="#ffffff"',
  'class="cls-5"': 'fill="#3871c1"',
  'class="cls-6"': 'fill="#ff0000"',
  'class="cls-7"': 'fill="#00ffff"',
  'class="cls-8"': 'fill="#5f4caa"',
  'class="cls-9"': 'clipPath="url(#clippath)"',
  'class="cls-10"': 'fill="#85c536"',
  'clip-path': 'clipPath',
  'xmlns:xlink': 'xmlnsXlink',
  'viewBox': 'viewBox',
};

for (const [k, v] of Object.entries(replacements)) {
  svg = svg.split(k).join(v);
}

// Remove XML header, defs>style, etc.
svg = svg.replace(/<\?xml.*?\?>/g, '');
svg = svg.replace(/<style>[\s\S]*?<\/style>/g, '');

// Convert tags to Capitalized
const tags = ['svg', 'defs', 'clipPath', 'rect', 'g', 'path'];
tags.forEach(tag => {
  svg = svg.replace(new RegExp(`<${tag}\\b`, 'g'), `<${tag.charAt(0).toUpperCase() + tag.slice(1)}`);
  svg = svg.replace(new RegExp(`</${tag}>`, 'g'), `</${tag.charAt(0).toUpperCase() + tag.slice(1)}>`);
});

svg = svg.replace(/data-name/g, 'dataName');

fs.writeFileSync('c:/happypix/client-app/apps/booth/src/components/HappyPixLogoDark.tsx', `import React from 'react';\nimport { Svg, Defs, ClipPath, Rect, G, Path } from 'react-native-svg';\n\nexport const HappyPixLogoDark = (props) => (\n  ${svg.trim()}\n);\n`);
console.log("Done!");
