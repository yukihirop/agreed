agreed-client
===================
[![Build Status](https://travis-ci.org/recruit-tech/agreed-client.svg?branch=master)](https://travis-ci.org/recruit-tech/agreed-client)

An agreed client for check response.

# Install

```
$ npm install agreed-client -D
```

# Usage

```javascript
const agreedClient = require('agreed-client')

const {
  client,
  agrees,
  reporter,
} = agreedClient({
  path: './test/agreed.json5', // required
  scheme: 'http', // optional, default is http
  host: 'localhost', // optional, default is localhost
  port: 30103, // optional, default is 80
  defaultRequestHeaders: {
    'x-jwt-token': 'foobarbaz'
  }
})

client.requestPromise(agrees)
  .then(reporter)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```
