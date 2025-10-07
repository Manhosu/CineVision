const crypto = require('crypto');
const fs = require('fs');

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save private key
fs.writeFileSync('cloudfront-private-key.pem', privateKey);
console.log('Private key saved to cloudfront-private-key.pem');

// Save public key
fs.writeFileSync('cloudfront-public-key.pem', publicKey);
console.log('Public key saved to cloudfront-public-key.pem');

console.log('\nPublic key content:');
console.log(publicKey);