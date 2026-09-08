const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const directory = path.resolve(__dirname, '../images');
const source = fs.readFileSync(path.join(directory, 'icon.svg'), 'utf8');
const palettes = {
  light: ['#FFFCF2', '#082F68', '#00BFC1'],
  dark: ['#082F68', '#FFFFFF', '#00E2E5'],
  mono: ['#FFFFFF', '#111111', '#111111'],
};
const tokens = ['#FFFCF2', '#082F68', '#00BFC1'];
for (const token of tokens) {
  if (!source.includes(token)) throw new Error(`Missing SVG palette color: ${token}`);
}
for (const [name, colors] of Object.entries(palettes)) {
  // Single pass prevents one replacement color being replaced again.
  const svg = source.replace(/#FFFCF2|#082F68|#00BFC1/g, color => colors[tokens.indexOf(color)]);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
  fs.writeFileSync(path.join(directory, `icon-${name}.png`), png);
  if (name === 'light') fs.writeFileSync(path.join(directory, 'icon.png'), png);
}
console.log('Generated light, dark, and monochrome icons; default: light (512 × 512).');
