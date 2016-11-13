/**
 * Non-stop Augur market / orderbook creation spam.
 * Intended for use on testnets only...market creation ain't free!
 * @author Jack Peterson (jack@tinybike.net)
 */

"use strict";

var async = require("async");
var chalk = require("chalk");
var madlibs = require("madlibs");

var noop = function () {};

var spammer = {
    debug: process.env.NODE_ENV === "development",
    generateOrderBook: false,
    connection: {
        http: "http://127.0.0.1:8545",
        ipc: process.env.GETH_IPC,
        ws: "ws://127.0.0.1:8546"
    },
    takerFee: "0.02",
    makerFee: "0.01",
    liquidity: {baseline: 50, multiplier: 2},
    startingQuantity: {baseline: 10, multiplier: 2}
};

spammer.topUp = function (augur, callback) {
    augur.Cash.balance(augur.from, function (balance) {
        if (balance > 10000000) return callback(null);
        augur.setCash({
            address: augur.from,
            balance: "10000000000000",
            onSent: noop,
            onSuccess: function () { callback(null); },
            onFailed: function (e) {
                console.error(chalk.red.bold("setCash failed:"), e);
                callback();
            }
        });
    });
};

spammer.randomizeOrderBookParams = function (market, type, numOutcomes, minValue, maxValue) {
    var orderBookParams = {
        market: market,
        liquidity: Math.floor(this.liquidity.multiplier*Math.random()) + this.liquidity.baseline,
        startingQuantity: Math.floor(this.startingQuantity.multiplier*Math.random()) + this.startingQuantity.baseline,
        bestStartingQuantity: Math.floor(this.startingQuantity.multiplier*Math.random()) + this.startingQuantity.baseline
    };
    var initialFairPrices = new Array(numOutcomes);
    if (type === "scalar") {
        orderBookParams.priceWidth = (0.25*(maxValue - minValue)).toString();
        var avg = 0.5*(minValue + maxValue);
        initialFairPrices = [0.5*avg, 1.5*avg];
        console.log("scalar IFP:", initialFairPrices);
        while (initialFairPrices[0] < minValue + 0.5*parseFloat(orderBookParams.priceWidth)) {
            initialFairPrices[0] = initialFairPrices[0]*1.01;
            console.log("scalar IFP [adjust 0]:", initialFairPrices);
        }
        while (initialFairPrices[1] > maxValue - 0.5*parseFloat(orderBookParams.priceWidth)) {
            initialFairPrices[1] = initialFairPrices[1]*0.99;
            console.log("scalar IFP [adjust 1]:", initialFairPrices);
        }
    } else {
        orderBookParams.priceWidth = (0.25*Math.random()).toString();
        for (var i = 0; i < numOutcomes; ++i) {
            do {
                initialFairPrices[i] = ((0.4*Math.random()) + 0.3);
            } while (initialFairPrices[i] < 0.5*parseFloat(orderBookParams.priceWidth) || initialFairPrices[i] > 1 - 0.5*parseFloat(orderBookParams.priceWidth));
        }
    }
    orderBookParams.initialFairPrices = initialFairPrices;
    if (this.debug) console.log("orderBookParams:", orderBookParams);
    return orderBookParams;
};

spammer.generateMarketText = function (type, numOutcomes) {
    var prefix;
    switch (type) {
    case "scalar":
        prefix = "How much";
        break;
    case "categorical":
        prefix = "Which";
        break;
    case "binary":
        prefix = "Will";
        break;
    default:
        console.error("Unknown market type:", type);
        return null;
    }
    var streetName = madlibs.streetName();
    var action = madlibs.action();
    var city = madlibs.city();
    var usState = madlibs.usState();
    var description = prefix + " " + city + " " + madlibs.noun() + " " + action + " " + streetName + " " + madlibs.noun() + "?";
    if (type === "categorical") {
        var choices = new Array(numOutcomes);
        for (var i = 0; i < numOutcomes; ++i) {
            choices[i] = madlibs.action();
        }
        description += "~|>" + choices.join('|');
    }
    return {
        description: description,
        resolution: "http://" + action + "." + madlibs.noun() + "." + madlibs.tld(),
        tags: [madlibs.noun(), city, usState],
        extraInfo: streetName + " is a " + madlibs.adjective() + " " + madlibs.noun() + ".  " + madlibs.transportation() + " " + usState + " " + action + " and " + madlibs.noun() + "!"
    };
};

spammer.randomizeMarketType = function () {
    var type, minValue, maxValue, numOutcomes;
    var rand = Math.random();
    if (rand > 0.667) {
        type = "scalar";
        maxValue = Math.round(Math.random() * 25);
        minValue = Math.round(Math.random() * maxValue);
        numOutcomes = 2;
    } else if (rand < 0.333) {
        type = "binary";
        maxValue = 2;
        minValue = 1;
        numOutcomes = 2;
    } else {
        type = "categorical";
        maxValue = Math.floor(6*Math.random()) + 2;
        minValue = 1;
        numOutcomes = maxValue;
    }
    return {
        type: type,
        minValue: minValue,
        maxValue: maxValue,
        numOutcomes: numOutcomes
    };
};

spammer.generateRandomOrderBook = function (augur, market, callback) {
    var self = this;
    augur.getMarketInfo(market, function (info) {
        if (info === null) {
            console.log(chalk.red("Market info not found:"), chalk.green(market));
            return callback("Market info not found for " + market);
        }
        var orderBookParams = self.randomizeOrderBookParams(market, info.type, info.numOutcomes, info.events[0].minValue, info.events[0].minValue);
        augur.generateOrderBook(orderBookParams, {
            onSimulate: function (simulation) {
                if (self.debug) console.log("simulation:", simulation);
            },
            onBuyCompleteSets: function (res) {
                if (self.debug) console.log("buyCompleteSets:", res);
            },
            onSetupOutcome: function (res) {
                if (self.debug) console.log("setupOutcome:", res);
            },
            onSetupOrder: function (res) {
                if (self.debug) console.log("setupOrder:", res);
            },
            onSuccess: function (orderBook) {
                if (self.debug) console.log("generateOrderBook success:", orderBook);
                callback(null, orderBook);
            },
            onFailed: function (err) {
                console.error(chalk.red.bold("generateOrderBook failed:"), err);
                callback("Order book creation failed for " + market);
            }
        });
    });
};

spammer.createRandomMarket = function (augur, callback) {
    var randomized = this.randomizeMarketType();
    var marketText = this.generateMarketText(randomized.type, randomized.numOutcomes);
    augur.createSingleEventMarket({
        branchId: augur.constants.DEFAULT_BRANCH_ID,
        description: marketText.description,
        expDate: Math.round(new Date().getTime() / 995),
        minValue: randomized.minValue,
        maxValue: randomized.maxValue,
        numOutcomes: randomized.numOutcomes,
        resolution: marketText.resolution,
        takerFee: "0.02",
        makerFee: "0.01",
        extraInfo: marketText.extraInfo,
        tags: marketText.tags,
        onSent: noop,
        onSuccess: function (r) {
            if (!r.callReturn) return callback(null);
            var marketID = r.callReturn;
            console.log("[" + randomized.type + "]", chalk.green(marketID), chalk.cyan.dim(marketText.description));
            callback(null, marketID);
        },
        onFailed: function (err) {
            console.error(chalk.red.bold("createSingleEventMarket failed:"), err);
            callback(err);
        }
    });
};

spammer.createRandomMarkets = function (augur, marketsToCreate, callback) {
    var self = this;
    var marketsCreated = 0;
    async.forever(function (createNext) {
        self.createRandomMarket(augur, function (err, market) {
            if (err || !market) return self.topUp(augur, createNext);
            if (!self.generateOrderBook) {
                if (marketsToCreate && ++marketsCreated >= marketsToCreate) {
                    return createNext({isComplete: true});
                }
                return self.topUp(augur, createNext);
            }
            self.generateRandomOrderBook(augur, market, function () {
                if (marketsToCreate && ++marketsCreated >= marketsToCreate) {
                    return createNext({isComplete: true});
                }
                self.topUp(augur, createNext);
            });
        });
    }, function (result) {
        if (result && result.isComplete) return callback(null);
        callback(result);
    });
};

spammer.initSpammer = function (augur, marketsToCreate, callback) {
    augur.getNumMarketsBranch(augur.constants.DEFAULT_BRANCH_ID, function (numMarkets) {
        console.log(chalk.blue.bold("Found " + numMarkets + " markets"));
        if (marketsToCreate) {
            console.log(chalk.blue.bold("Creating " + marketsToCreate + " markets"));
        }
        spammer.createRandomMarkets(augur, marketsToCreate, callback);
    });
};

spammer.spam = function (augur, marketsToCreate, callback) {
    var self = this;
    if (augur && augur.constructor === Number) {
        marketsToCreate = augur;
        augur = null;
    }
    if (!callback && marketsToCreate && marketsToCreate.constructor === Function) {
        callback = marketsToCreate;
        marketsToCreate = null;
    }
    if (!callback && !marketsToCreate && augur && augur.constructor === Function) {
        callback = augur;
        augur = null;
    }
    callback = callback || noop;
    marketsToCreate = (isNaN(marketsToCreate)) ? null : parseInt(marketsToCreate);
    if (augur) return this.initSpammer(augur, marketsToCreate, callback);
    augur = require("augur.js");
    augur.rpc.retryDroppedTxs = true;
    augur.rpc.setLocalNode(spammer.connection.http);
    augur.connect(spammer.connection, function (connection) {
        if (self.debug) console.log("Connected:", connection);
        self.initSpammer(augur, marketsToCreate, callback);
    });
};

module.exports = spammer;
