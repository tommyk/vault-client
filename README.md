# vault-client
A node client for HashiCorp's [vault](https://www.vaultproject.io/). In addition
to supporting basic http interaction with a vault api, it will also manage:

 - authentication & reauthentication based on token `lease_duration`
 - including the current access token on every request as the `X-Vault-Token` header
 - caching & renewing secrets based on `lease_duration`
 - notifying subscribers of secret renewals



## Installing
```bash
npm install --save vault-client
```



## Getting Started
```javascript
const Vault = require('vault-client');
const client = new Vault({
    url: 'https://vault.example.com'
});

async.series([
    // first, we need to authenticate with vault
    function login(next) {
        vault.login({
            backend: 'userpass',
            options: {
                username: 'bob',
                password: 'password1'
            }
        }, next);
    },

    // let's add some secrets
    function addSecrets(next) {
        const secrets = [{
            path: '/secret/foo',
            data: {
                foo: 'bar'
            }
        },{
            path: '/secret/bar',
            data: {
                bar: 'baz'
            }
        }];
        async.each(secrets, function(secret, done) {
            vault.post(secret.path, secret.data, done);
        }, next);
    },

    // next, we can fetch a single secret from vault
    function get(next) {
        vault.get('/secret/foo', function(err, data) {
            console.log(data);
            // {
            //   "data": {
            //     "foo": "bar"
            //   },
            //   "lease_duration": 2592000,
            //   "renewable": false
            // }
            next(err);
        });
    },

    // or, we can choose to watch a single secret. the vault client
    // will cache the fetched secret locally, and will handle renewing
    // the secret if a lease_duration is included in the response metadata
    function(next) {
        vault.watch({
            address: 'foo', // store the secret in the cache at path "foo"
            path: '/secret/foo'
        }, function(err, data) {
            const foo = vault.secret('foo');
            console.log(JSON.stringify(foo));
            // { "foo": "bar" }
            next(err, data);
        });

        // we can listen for secret renewals at the "foo" address by attaching
        // a listener to the "secret:<address>" event
        vault.on('secret:foo', function(data) {
            console.log(JSON.stringify(data))
            // { "foo": "goo" }
        });
    },

    // we can also choose to watch multiple secrets. again, the vault client
    // will handle renewing each secret based on its lease_duration.
    function(next) {
        vault.watch([{
            address: '.', // the root address, secret will be merged into the root
            path: '/secret/foo'
        }, {
            address: 'bar',
            path: '/secret/bar'
        }], function(err, data) {
            console.log(JSON.stringify(vault.secret()))
            // { "bar": { "bar": "baz" }, "foo": "bar" }
        });
    }
]);
```



## API
### Vault(options)
Creates a new `vault` client.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| options* | `{Object}` | options |
| options.url* | `{String}` | the base url of the vault server |
| options.retry | `{Object}` | global retry settings for failed network requests. see [node-retry](https://github.com/tim-kos/node-retry) for more info

###### Example
```javascript
const Vault = require('vault-client');
const vault = new Vault({
    url: 'https://localhost:8200/v1'
});
```

### vault.secret([address])
Fetch a copy of a partial branch of secret cache. If no address is specified, a copy of the entire cache will be returned.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| address | `{String}` | an path of the cache to retrieve |

###### Example
```javascript
const secrets = vault.secret();
console.log(JSON.stringify(secrets));
// returns a copy of the internal store
// {
//      "foo": "bar",
//      "bar": { "bar": "baz" },
//      "super": { "nested": { "secret": "s3cr3t" }}
// }

const nested = vault.secret('some.nested.secret');
console.log(nested)
// returns a copy of a branch of the store
// "s3cr3t"
```


### vault.watch(secrets, [options], [cb])
Fetches one or more secrets from vault and caches them internally. If a secret includes a `lease_duration` greater than 0, this method will handle renewing them periodically. Failed attempts will be automatically retried using [node-retry](https://github.com/tim-kos/node-retry) |

###### Params
| param | type | description |
| :--- | :---: | :--- |
| secrets* | `{Object,Object[]}` | |
| secrets.$.address* | `{String}` | the caching address to use for the fetched secret's data |
| secrets.$.path* | `{String}` | the relative url of the secret in vault |
| options | `{Object}` |  |
| options.retry | `{Object}` | optional [node-retry](https://github.com/tim-kos/node-retry) settings for retrying failed attempts |
| cb | `{Function}` | node style callback |

###### Example
```javascript
const secrets = [
    { address: '.', path: '/secret/foo' },
    { address: 'bar', path: '/secret/bar' },
    { address: 'super', path: '/secret/super' }
];

vault.watch(secrets, function(err, data) {
    // do something once all secrets have been successfully retrieved.
});

vault.on('secret:foo', function(secret) {
    // execute when secret is first retrieved and every time secret is renewed
});
```


### vault.delete(url, [config], [cb])
Issues a DELETE request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |


### vault.head(url, [config], [cb])
Issues a HEAD request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |


### vault.get(url, [config], [cb])
Issues a GET request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |

###### Example
```javascript
// node style
vault.get('/secrets/foo', {
    timeout: 1000
}, function(err, results) {
    console.log(results);
})

// promise style
vault.get('/secrets/foo', {
    timeout: 1000
}).then(function(res) {
    // res is an axios res object
}).catch(function(err) {
    // catch any errors
});
```


### vault.login(options, [callback])
Create a new session with vault server and periodically refresh it.  
*currently the 'userpass' backend is the only supported backend*

###### Params
| param | type | description |
| :--- | :---: | :--- |
| options* | `{Object} | login options |
| options.backend* | `{String}` | the backend to use. currently supported backends: userpass |
| options.options* | `{Object}` | backend specific options |
| options.retry | `{Object}` | in the event of network errors, the client will continue attempting the login using [node-retry](https://github.com/tim-kos/node-retry) |


### vault.patch(url, [data], [config], [cb])
Issues a PATCH request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| data | `{Object}` | request data |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |


### vault.post(url, [data], [config], [cb])
Issues a POST request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| data | `{Object}` | request data |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |


### vault.put(url, [data], [config], [cb])
Issues a PUT request to vault. If the client is authenticated, the request will include the current client_token via the `X-VAULT-TOKEN` header.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| data | `{Object}` | request data |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |






## Events
| name | callback | description |
| :--- | :--- | :--- |
| error | `function(err)` | all errors will bubble to here |
| error:login | `function(err)` | login errors |



## Auth Backends
Following are backend specific login options

### userpass
```js
{
    backend: 'userpass',
    options: {
        username: '<vault-userpass-username>',
        password: '<vault-userpass-password>'
    }
}
```



## Todo
- [ ] add support for additional auth backends



## Testing
run the test suite  (*requires docker-compose v1.7+*)
```bash
docker-compose up
```

run coverage
```bash
docker-compose run client npm run coverage
```



## Contributing
1. [Fork it](https://github.com/cludden/vault-client/fork)
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request



## License
Copyright (c) 2016 Chris Ludden
Licensed under the [MIT License](LICENSE.md);
