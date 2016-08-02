Spammer
=======

[![Build Status](https://travis-ci.org/AugurProject/market-spammer.svg?branch=master)](https://travis-ci.org/AugurProject/market-spammer)
[![npm version](https://badge.fury.io/js/spammer.svg)](https://badge.fury.io/js/spammer)

Non-stop Augur market and orderbook creation spam.  Intended for use on testnets only.  (Market creation ain't free!)

Usage
-----

```
$ npm install spammer
```

To use Spammer in Node.js, simply require it:

```javascript
var spammer = require("spammer");
```

The `spam` method is a user-friendly method that lets you flood Augur with an endless cascade of gibberish-infused markets:

```javascript
// Non-stop spam
spammer.spam();

// Spam 10 markets
spammer.spam(10);

// Bring-your-own-augur.js (BYOA) and spam 10 markets
var augur = require("augur.js");
spammer.spam(augur, 10);

// Spam 10 markets, then brag about it after
spammer.spam(10, function (err) {
    console.log("Damn it feels good to be a spammer");
});

// BYOA, spam 10 markets, then brag about it after
spammer.spam(augur, 10, function (err) {
    console.log("Damn it feels good to be a spammer");
});
```

Spammer also has less morally-repugnant methods `createRandomMarket` and `generateRandomOrderBook`.  These methods allow you to create just a single random market and/or generate a random order book for a single existing market, without burying Augur under a tsunami of utter nonsense:

```javascript
// Create a single random market
spammer.createRandomMarket(augur, function (err, marketID) { /* ... */ });

// Populate the order book of an existing market
spammer.generateRandomOrderBook(augur, marketID, function (err, orderBook) { /* ... */ });
```

Both `createRandomMarket` and `generateRandomOrderBook` require an [augur.js](https://github.com/AugurProject/augur.js) object as their first argument.

Spammer may be ethically dubious, but even it has standards: methods that use RPC requests are asynchronous-only, because to do otherwise is to descend into savagery.
