const path = require('path');
const express = require('express');

const staticFiles = express.static(path.join(__dirname, '../public'));
module.exports = staticFiles;
