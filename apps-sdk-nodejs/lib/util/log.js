'use strict'

const {createLogger, format, transports} = require('winston')

const {printf} = format
const myFormat = printf(({level, message}) => {
	const timestamp = new Date().toISOString()
	return `${timestamp} ${level}: ${message}`
})

/**
 * Simple wrapper around the console for logging various kinds of information
 */
module.exports = class Log {
	constructor(logger, jsonSpace = null, enableEvents = false) {
		this._eventsEnabled = enableEvents
		this._jsonSpace = jsonSpace
		if (!logger) {
			this._logger = createLogger({
				level: 'debug',
				transports: [
					new transports.Console({
						format: myFormat
					})
				]
			})
		}
	}

	event(evt, suffix = '') {
		if (this._eventsEnabled) {
			try {
				this._logger.log('debug', `${evt.lifecycle}${suffix ? `/${suffix}` : ''} REQUEST: ${JSON.stringify(evt, null, this._jsonSpace)}`)
			} catch (error) {
				this._logger.log('error', `${evt.lifecycle}${suffix ? `/${suffix}` : ''} Error logging request: ${error}`)
			}
		}
	}

	response(data) {
		if (this._eventsEnabled) {
			try {
				this._logger.log('debug', `RESPONSE: ${JSON.stringify(data, null, this._jsonSpace)}`)
			} catch (error) {
				this._logger.log('error', `Error logging response: ${error}`)
			}
		}
	}

	debug(msg) {
		this._logger.debug(msg)
	}

	info(msg) {
		this._logger.info(msg)
	}

	warn(msg) {
		this._logger.warn(msg)
	}

	error(msg) {
		this._logger.error(msg)
	}

	exception(error) {
		if (error.stack) {
			this._logger.error(error.stack)
		} else {
			this._logger.error(error.toString())
		}
	}

	enableEvents(jsonSpace, enabled = true) {
		this._eventsEnabled = enabled
		this._jsonSpace = jsonSpace
	}
}
