#!/usr/bin/node
/**
 * Express server setup.
 */

const express = require('express');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json()); // Add this line to parse JSON request bodies
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

