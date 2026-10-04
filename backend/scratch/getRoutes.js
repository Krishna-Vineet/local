const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const routesInfo = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const lines = content.split('\n');
  
  routesInfo.push(`\n=== ${file} ===`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/router\.(get|post|put|delete|patch)\((['"`])(.*?)\2/);
    if (match) {
      let comments = [];
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (prevLine.startsWith('//') || prevLine.startsWith('*') || prevLine.startsWith('/**')) {
          comments.unshift(prevLine);
        } else if (prevLine !== '') {
          break;
        }
      }
      routesInfo.push(`${match[1].toUpperCase()} ${match[3]}`);
      if (comments.length > 0) {
        routesInfo.push(`  Description: ${comments.join(' ').replace(/\/\*+|\*+\/|\* /g, '').trim()}`);
      }
    }
  }
});

fs.writeFileSync(path.join(__dirname, 'routes_summary.txt'), routesInfo.join('\n'));
console.log('Done!');
