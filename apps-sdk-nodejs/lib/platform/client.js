'use strict'

const axios = require('axios')
const querystring = require('query-string')
const ClientError = require('./client-error')

class Client {
	constructor(options) {
		this.authToken = options.authToken
		this.refreshToken = options.refreshToken
		this.clientId = options.clientId
		this.clientSecret = options.clientSecret
		this.apiUrl = options.apiUrl ? options.apiUrl : 'https://api.smartthings.com'
		this.refreshUrl = options.refreshUrl ? options.refreshUrl : 'https://auth-global.api.smartthings.com/oauth/token'
		this.contextStore = options.contextStore
		this.installedAppId = options.installedAppId
		this._log = options.log
		this._mutex = options.apiMutex
	}

	async request(path, method, data, transform, qs) {
		if (this._mutex) {
			return this._sequentialRequest(path, method, data, transform, qs)
		}

		return this._request(path, method, data, transform, qs)
	}

	async _request(path, method, data, transform, qs) {
		const url = qs ? `${this.apiUrl}/${path}?${querystring.stringify(qs)}` : `${this.apiUrl}/${path}`
		const opts = {
			url,
			method: method ? method : 'GET',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Authorization': 'Bearer ' + this.authToken
			}
		}
		if (data) {
			opts.data = data
		}

		if (transform) {
			opts.transformResponse = function (data) {
				return transform(JSON.parse(data))
			}
		}

		return axios(opts)
			.then(res => {
				return res.data
			})
			.catch(error => {
				logError(this._log, error)
			})
	}

	async _sequentialRequest(path, method, data, transform, qs) {
		const release = await this._mutex.acquire()
		const url = qs ? `${this.apiUrl}/${path}?${querystring.stringify(qs)}` : `${this.apiUrl}/${path}`
		const opts = {
			url,
			method: method ? method : 'GET',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Authorization': 'Bearer ' + this.authToken
			}
		}
		if (data) {
			opts.data = data
		}

		if (transform) {
			opts.transformResponse = function (data) {
				return transform(JSON.parse(data))
			}
		}

		return axios(opts).catch(async error => {
			const client = this
			if (error.response.status === 401 && client.refreshToken && client.contextStore) {
				const str = await refreshToken(client.refreshUrl, client.clientId, client.clientSecret, client.refreshToken)
				const data = JSON.parse(str)
				if (data.access_token) {
					client.authToken = data.access_token
					client.refreshToken = data.refresh_token

					// This._log.debug(`refresh ${JSON.stringify(data)}`);

					await client.contextStore.update(client.installedAppId, {
						authToken: client.authToken,
						refreshToken: client.refreshToken
					})

					release()

					opts.headers.Authorization = 'Bearer ' + client.authToken

					return axios(opts)
						.then(res => {
							return res.data
						})
						.catch(error => {
							logError(this._log, error)
						})
				}
			} else {
				logError(client._log, error)
			}

			release()
		}).then(async res => {
			release()
			return res.data
		})
	}
}

module.exports = function (authToken, clientId, clientSecret) {
	return new Client(authToken, clientId, clientSecret)
}

function logError(log, error) {
	throw new ClientError(error)
}

function refreshToken(url, clientId, clientSecret, refreshToken) {
	// Console.log(`refreshToken(${refreshToken})`);
	const opts = {
		url,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`, 'ascii').toString('base64')
		},
		body: `grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
	}
	return axios(opts).then(res => {
		return res.data
	})
}
