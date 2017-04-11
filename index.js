#!/usr/bin/env node
'use strict'

const express = require('express')
const http = require('http')

const port = process.env.PORT || 8000

const app = express()
app.use(express.static('static'))
app.listen(port)

console.log(`Listening on port ${port}.`)
