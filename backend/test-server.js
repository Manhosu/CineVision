const express = require('express');
const app = express();
const port = 3001;

app.get('/test', (req, res) => {
  res.json({ message: 'Test server is working!' });
});

app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});