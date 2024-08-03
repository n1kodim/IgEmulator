process.on("uncaughtException", function (err, origin) {
	console.log("uncaughtException:\n" + err.stack);
	require("fs").writeFileSync("./crashes/crash_exception_" + new Date().getTime() + ".txt", err.stack);
	process.exit(1);
})

process.on('unhandledRejection', function (reason, promise) {
	console.log("unhandledRejection:\n" + promise);
	require("fs").writeFileSync("./crashes/crash_rejection_" + new Date().getTime() + ".txt", promise);
	process.exit(1);
})

var mongoClient = require("mongodb").MongoClient;
var xmppNodeClient = require('node-xmpp-client');
var ltx = require("ltx");

var xmppCore = require("./core.js");

global.config = require('./config.json')

var scriptCacheJson = require('./scripts/cacheJson.js');
var scriptResources = require('./scripts/resources.js');
var scriptTools = require('./scripts/tools.js');
var scriptXmppFunctions = require('./scripts/xmppFunctions.js')
var scriptCacheDynamic = require('./scripts/cacheDynamic.js');
var scriptTimers = require('./scripts/timers.js');

global.startupParams = {};
for (argKey in process.argv) {
	var argData = process.argv[argKey].split("=")
	if (argData.length == 2) {
		global.startupParams[argData[0]] = argData[1];
	}
}

function initGlobalVars() {
	global.users = { jid: {}, _id: {} };

	global.gamerooms = [];
	global.roomId = 1;
	global.roomBrowserCacheToken = 1;
	global.roomBrowserCacheArr = [];

	global.ticketsObject = {};

	global.dedicatedServersObject = {};
	global.sessionId = 1;

	global.sessions_data = {};
}
initGlobalVars();

scriptCacheJson.load();
scriptResources.load();

function loadDb() {
	global.db = {};
	console.log("[MongoDb]:Connecting...");
	//reconnectTries: Number.MAX_VALUE
	mongoClient.connect(config.mongodb, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, dbClient) {
		if (dbClient != null) {
			//console.log("[MongoDb]:Connected");
			global.db.warface = {};
			global.db.warface.accounts = dbClient.db("warface").collection("accounts");
			global.db.warface.profiles = dbClient.db("warface").collection("profiles");
			global.db.warface.cache = dbClient.db("warface").collection("cache");
			global.db.warface.clans = dbClient.db("warface").collection("clans");
			initCache();
		} else {
			console.log("[MongoDb]:Connect error -> " + err.message);
			setTimeout(function () {
				loadDb();
			}, 1000);
		}
	});
}
loadDb();

function initCache() {
	scriptCacheDynamic.init(function () {
		loadXmppConnection(global.config.masterserver.host, global.config.masterserver.port, global.config.masterserver.domain, global.config.masterserver.username, global.config.masterserver.password, global.startupParams.resource);
	});
}


function loadXmppConnection(xmppHost, xmppPort, xmppDomain, xmppUsername, xmppPassword, xmppResource) {

	var xmppOptions = {
		jid: xmppUsername + "@" + xmppDomain + "/" + xmppResource,
		password: xmppPassword,
		preferred: 'PLAIN',
		host: xmppHost,
		port: xmppPort,
		reconnect: true
	}

	console.log('[Masterserver]:Connecting...')

	global.xmppClient = new xmppNodeClient(xmppOptions)

	scriptXmppFunctions.init(global.xmppClient);
	scriptTimers.init();

	global.xmppClient.on('stanza', function (stanza) {
		//console.time("t");
		xmppCore.module(stanza);
		//console.timeEnd("t");
	})

	global.xmppClient.on('online', function () {
		console.log('[Masterserver]:Online')
		scriptTimers.sendMasterserverInfo();
	})

	global.xmppClient.on('offline', function () {
		console.log('[Masterserver]:Offline')
	})

	global.xmppClient.on('connect', function () {
		console.log('[Masterserver]:Connected')
	})

	global.xmppClient.on('reconnect', function () {
		console.log('[Masterserver]:Reconnect...')
	})

	global.xmppClient.on('disconnect', function (e) {
		console.log("[Masterserver]:Disconnect")
		initGlobalVars();//Reinit
	})

	global.xmppClient.on('error', function (e) {
		console.error(e)
		process.exit(1)
	})
	
	process.on('exit', function () {
		global.xmppClient.end()
	})

}