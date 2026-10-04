const fs = require('fs');

const svgStr = fs.readFileSync('c:/happypix/client-app/apps/booth/src/assets/logo_dark.svg', 'utf8');
const compStr = fs.readFileSync('c:/happypix/client-app/apps/booth/src/components/HappyPixLogoDark.tsx', 'utf8');

const svgPaths = [...svgStr.matchAll(/d="([^"]+)"/g)].map(m => m[1]);
const compPaths = [...compStr.matchAll(/d="([^"]+)"/g)].map(m => m[1]);

let diffFound = false;
for (let i = 0; i < svgPaths.length; i++) {
  if (svgPaths[i] !== compPaths[i]) {
    console.log(`Path ${i} differs!`);
    console.log('SVG : ' + svgPaths[i].substring(0, 50) + '...');
    console.log('COMP: ' + compPaths[i].substring(0, 50) + '...');
    diffFound = true;
  }
}

if (!diffFound) {
  console.log("All paths match perfectly!");
}
