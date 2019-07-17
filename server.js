'use strict';

require('dotenv').config();
const express = require('express');
const session = require("express-session");
const path = require('path');
const morgan = require('morgan');
const encodeUrl = require('encodeurl');
const rp = require('request-promise-native');
const {ApiApp} = require('@smartthings/apps')

const port = process.env.PORT;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = `${process.env.URL}/oauth/callback`;
const scope = encodeUrl('i:deviceprofiles r:locations:* r:devices:* x:devices:* r:scenes:* x:scenes:*');

/* SmartThings API */
const apiApp = new ApiApp()
	.clientId(clientId)
	.clientSecret(clientSecret)
	.redirectUri(redirectUri)
	.subscribedEventHandler('switchHandler', async (ctx, event) => {
		console.log(`*** EVENT: Switch ${event.deviceId} is ${event.value}`)
	})

/* Webserver setup */
const server = express();
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(morgan('dev'));
server.use(express.json());
server.use(express.urlencoded({extended: false}));
server.use(session({
	secret: "oauth example secret",
	resave: false,
	saveUninitialized: true,
	cookie: {secure: false}
}));
server.use(express.static(path.join(__dirname, 'public')));

/* Main page. Shows link to SmartThings if not authenticated and list of scenes afterwards */
server.get('/', function (req, res) {
	if (req.session.smartThings) {
		// Context cookie found, use it to list scenes
		const data = req.session.smartThings;
		apiApp.withContext(data).then(ctx => {
			ctx.api.scenes.list().then(scenes => {
				res.render('scenes', {
					installedAppId: data.installedAppId,
					locationName: data.locationName,
					errorMessage: '',
					scenes: scenes
				})
			}).catch(error => {
				res.render('scenes', {
					installedAppId: data.installedAppId,
					locationName: data.locationName,
					errorMessage: `${error.message}`,
					scenes: {items:[]}
				})
			})
		})
	}
	else {
		// No context cookie. Displey link to authenticate with SmartThings
		res.render('index', {
			url: `https://api.smartthings.com/oauth/authorize?client_id=${clientId}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`
		})
	}
});

/* Uninstalls app and clears context cookie */
server.get('/logout', async function(req, res) {
	const ctx = await apiApp.withContext(req.session.smartThings)
	await ctx.api.installedApps.deleteInstalledApp()
	req.session.destroy(err => {
		res.redirect('/')
	})
});

/* Executes a scene */
server.post('/scenes/:sceneId', function (req, res) {
	apiApp.withContext(req.session.smartThings).then(ctx => {
		ctx.api.scenes.execute(req.params.sceneId).then(result => {
			res.send(result)
		})
	})
});

/* Accepts registration challenge and confirms app */
server.post('/', async (req, res) => {
	console.log(`HEADERS: ${JSON.stringify(req.headers, null, 2)}`)
	console.log(`BODY: ${JSON.stringify(req.body, null, 2)}`)
	console.log(`AUTHORIZED: ${await apiApp.isAuthorized(req)}`)
})

/* Handles OAuth redirect */
server.get('/oauth/callback', async (req, res) => {
	const ctx = await apiApp.handleOAuthCallback(req)

	// Subscribe to events
	await ctx.api.subscriptions.unsubscribeAll()
	await ctx.api.subscriptions.subscribeToCapability('switch', 'switch', 'switchHandler');

	// Get the location name
	const location = await ctx.api.locations.get(ctx.locationId)

	// Set the cookie with the context, including the location ID and name
	const sessionData = {
		locationId: ctx.locationId,
		locationName: location.name,
		installedAppId: ctx.installedAppId,
		authToken: ctx.authToken,
		refreshToken: ctx.refreshToken
	}
	req.session.smartThings = sessionData

	// Redirect back to the main mage
	res.redirect('/')

});

server.listen(port);
console.log(`Open:     ${process.env.URL}`);
console.log(`Callback: ${process.env.URL}/oauth/callback`);
