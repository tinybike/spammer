#!/usr/bin/env node

"use strict";

var async = require("async");
var chalk = require("chalk");
var madlibs = require("madlibs");
var augur = require("augur.js");

var DEBUG = process.env.NODE_ENV === "development";

var noop = function () {};

var topUp = function (callback) {
    var balance = augur.Cash.balance(augur.from);
    if (balance > 10000000) return callback();
    augur.setCash({
        address: augur.from,
        balance: "10000000000000",
        onSent: noop,
        onSuccess: function () { callback(); },
        onFailed: function (e) {
            console.error(chalk.red.bold("setCash failed:"), e);
            callback();
        }
    });
};

var spam = function (erf) {
    async.forever(function (next) {
        var minValue, maxValue, numOutcomes, type, prefix;
        var rand = Math.random();
        if (rand > 0.667) {
            // scalar
            maxValue = Math.round(Math.random() * 25);
            minValue = Math.round(Math.random() * maxValue);
            numOutcomes = 2;
            prefix = "How much";
            type = "scalar";
        } else if (rand < 0.333) {
            // binary
            maxValue = 2;
            minValue = 1;
            numOutcomes = 2;
            prefix = "Will";
            type = "binary";
        } else {
            // categorical
            maxValue = 2;
            minValue = 1;
            numOutcomes = Math.floor(6*Math.random()) + 3;
            prefix = "Which";
            type = "categorical";
        }
        var streetName = madlibs.streetName();
        var action = madlibs.action();
        var city = madlibs.city();
        var description = prefix + " " + city + " " + madlibs.noun() + " " + action + " " + streetName + " " + madlibs.noun() + "?";
        var resolution = "http://" + action + "." + madlibs.noun() + "." + madlibs.tld();
        var tags = [streetName, madlibs.noun(), city];
        var extraInfo = streetName + " is a " + madlibs.adjective() + " " + madlibs.noun() + ".  " + madlibs.transportation() + " " + madlibs.usState() + " " + action + " and " + madlibs.noun() + "!";
        if (type === "categorical") {
            var choices = new Array(numOutcomes);
            for (var i = 0; i < numOutcomes; ++i) {
                choices[i] = madlibs.action();
            }
            description += "~|>" + choices.join('|');
        }
        var expDate = Math.round(new Date().getTime() / 995);
        augur.createSingleEventMarket({
            branchId: augur.constants.DEFAULT_BRANCH_ID,
            description: description,
            expDate: expDate,
            minValue: minValue,
            maxValue: maxValue,
            numOutcomes: numOutcomes,
            resolution: resolution,
            takerFee: "0.02",
            makerFee: "0.01",
            extraInfo: extraInfo,
            tags: tags,
            onSent: noop,
            onSuccess: function (r) {
                var marketID = r.callReturn;
                if (!marketID) return next();
                console.log("[" + type + "]", chalk.green(marketID), chalk.cyan.dim(description));
                augur.getMarketInfo(marketID, function (marketInfo) {
                    if (marketInfo === null) {
                        console.log(chalk.red("Market info not found:"), chalk.cyan.dim(description), chalk.white.dim(expDate));
                        return topUp(next);
                    }
                    var orderBookParams = {
                        market: marketID,
                        liquidity: Math.floor(400*Math.random()) + 10000,
                        startingQuantity: Math.floor(40*Math.random()) + 1000,
                        bestStartingQuantity: Math.floor(40*Math.random()) + 1000
                    };
                    var initialFairPrices = new Array(numOutcomes);
                    if (type === "scalar") {
                        orderBookParams.priceWidth = (0.25*(maxValue - minValue)).toString();
                        var avg = 0.5*(minValue + maxValue);
                        initialFairPrices = [0.5*avg, 1.5*avg];
                        while (initialFairPrices[0] < minValue + 0.5*parseFloat(orderBookParams.priceWidth)) {
                            initialFairPrices[0] = initialFairPrices[0]*1.01;
                        }
                        while (initialFairPrices[1] > maxValue - 0.5*parseFloat(orderBookParams.priceWidth)) {
                            initialFairPrices[1] = initialFairPrices[1]*0.99;
                        }
                    } else {
                        orderBookParams.priceWidth = Math.random().toString();
                        for (var i = 0; i < numOutcomes; ++i) {
                            do {
                                initialFairPrices[i] = ((0.4*Math.random()) + 0.3);
                            } while (initialFairPrices[i] < 0.5*parseFloat(orderBookParams.priceWidth) || initialFairPrices[i] > 1 - 0.5*parseFloat(orderBookParams.priceWidth));
                        }
                    }
                    orderBookParams.initialFairPrices = initialFairPrices;
                    augur.generateOrderBook(orderBookParams, {
                        onSimulate: function (sim) {
                            if (DEBUG) console.log("simulation:", sim);
                        },
                        onBuyCompleteSets: function (res) {
                            if (DEBUG) console.log("buyCompleteSets:", res);
                        },
                        onSetupOutcome: function (res) {
                            if (DEBUG) console.log("setupOutcome:", res);
                        },
                        onSetupOrder: function (res) {
                            if (DEBUG) console.log("setupOrder:", res);
                        },
                        onSuccess: function (res) {
                            if (DEBUG) console.log("generateOrderBook success:", res);
                            topUp(next);
                        },
                        onFailed: function (err) {
                            console.error(chalk.red.bold("generateOrderBook failed:"), err);
                            topUp(next);
                        }
                    });
                });
            },
            onFailed: function (err) {
                console.error(chalk.red.bold("createSingleEventMarket failed:"), err);
                topUp(next);
            }
        });
    }, erf);
};

augur.rpc.retryDroppedTxs = true;
augur.rpc.setLocalNode("http://127.0.0.1:8545");
augur.connect({
    http: "http://127.0.0.1:8545",
    ipc: process.env.GETH_IPC,
    ws: "ws://127.0.0.1:8546"
}, function (connection) {
    if (DEBUG) {
        console.log("Connected:", connection);
        console.log(chalk.cyan.bold("local:   "), chalk.cyan(augur.rpc.nodes.local));
        console.log(chalk.blue.bold("ws:      "), chalk.blue(augur.rpc.wsUrl));
        console.log(chalk.magenta.bold("ipc:     "), chalk.magenta(augur.rpc.ipcpath));
        this.print_nodes(augur.rpc.nodes.hosted);
        console.log(chalk.yellow.bold("network: "), chalk.yellow(augur.network_id));
        console.log(chalk.bold("coinbase:"), chalk.white.dim(augur.coinbase));
        console.log(chalk.bold("from:    "), chalk.white.dim(augur.from));
    }
    var numMarkets = parseInt(augur.getNumMarketsBranch(augur.constants.DEFAULT_BRANCH_ID));
    console.log(chalk.blue.bold("Found " + numMarkets + " markets"));
    spam(function (e) {
        if (e) console.error("[market-spammer]", new Date().toISOString(), e);
        process.exit(1);
    });
});
