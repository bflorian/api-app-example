(async function() {
	const AWS = require('aws-sdk');


	const ContextStore = require('./index')
	const cs = new ContextStore({
		table: {
			name: 'test3',
			hashKey: 'pk',
			sortKey: {
				AttributeName: 'sk',
				AttributeType: 'S',
				AttributeValue: 'context',
				KeyType: 'RANGE'
			}
		}
	})

	await cs.put({installedAppId: 'xxxx',
		locationId: 'yyyy',
		authToken: 'aaaa',
		refreshToken: 'bbbb',
		config: {page: 1, name: 'foo'}})

	await cs.put({installedAppId: 'xyz1',
		locationId: 'yyyy',
		authToken: 'aaaa',
		refreshToken: 'bbbb',
		config: {page: 2, name: 'foo'},
		state: {stuff: 'pdq', whatever: 'xyz', count: 2}
	})


	let data = await cs.get('xxxx')
	console.log(JSON.stringify(data, null, 2))
	data = await cs.get('xyz1')
	console.log(JSON.stringify(data, null, 2))

	await cs.update('xyz1', {
		authToken: 'aaaa2',
		refreshToken: 'bbbb2'})

	data = await cs.get('xyz1')
	console.log(JSON.stringify(data, null, 2))

	await cs.update('xyz1', {state: {
			"count": 2,
			"whatever": "xyz XYZ",
			"stuff": "pdq ABC"
		}})

	data = await cs.get('xyz1')
	console.log(JSON.stringify(data, null, 2))

})();
