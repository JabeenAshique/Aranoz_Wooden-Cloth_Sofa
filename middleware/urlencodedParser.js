const express = require('express');
const urlencodedParser = express.urlencoded({ extended: true });
module.exports = urlencodedParser;
