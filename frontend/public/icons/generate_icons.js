// Script para gerar ícones PNG usando Canvas (se disponível no environment)
// Para uso com Node.js + canvas package ou ferramenta de build

const fs = require('fs');
const path = require('path');

// Sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create placeholder icon data URLs for each size
const createIconDataURL = (size) => {
  // Simple base64 encoded 1x1 red pixel PNG
  const redPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  // For now, we'll use a simple SVG converted to data URL
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#dc2626"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.3}" fill="none" stroke="white" stroke-width="${size * 0.02}"/>
    <polygon points="${size * 0.4},${size * 0.4} ${size * 0.4},${size * 0.6} ${size * 0.6},${size * 0.5}" fill="white"/>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

console.log('Icon sizes needed:', sizes);
console.log('Use this SVG as base for creating actual PNG icons:');
console.log(createIconDataURL(512));