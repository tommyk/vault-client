'use strict';

const async = require('async');
const joi = require('joi');

module.exports = {
    /**
     * Login with username and password
     * @param  {Object} vault
     * @param  {Object} options
     * @param  {String} options.password
     * @param  {String} options.username
     * @param  {Function} cb
     */
    login(vault, options, cb) {
        async.waterfall([
            function validateOptions(fn) {
                const schema = joi.object({
                    roleId: joi.string().required(),
                    secretId: joi.string().required()
                }).unknown('true');
                joi.validate(options, schema, fn);
            },

            function authenticate(validated, fn) {
                vault.post(`/auth/approle/login`, {
                    role_id: validated.roleId, secret_id: validated.secretId
                }, function(err, data) {
                    if (err) {
                        if (err.status === 400) {
                            err.status = 401;
                        }
                        fn(err);
                    } else {
                        fn(null, data.auth);
                    }
                });
            }
        ], cb);
    }
};
