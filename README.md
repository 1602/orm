About
=====

ORM is simple Object-redis-mapper, which provides simple object interface to redis data storage.
It adds some methods to the selected model: create, find, exists, etc..

Check out test to learn how to use this lib.

Prerequisites
=============

 1. Redis server version 2.0.3
 2. node version 0.2.2
 3. nodeunit (for running tests)

Installation
============

Install usin NPM

    npm install node-redis-mapper

Or from sources on github

    mkdir vendor
    git clone git://github.com/1602/orm.git vendor/orm

Usage
=====

    var m = require('node-redis-mapper').apply_to_models(__dirname + '/app/models/');

or

    // load models namespace
    var models = require('./lib/your_models');
    // or define model
    var models = {
        User: function User() {
            User.attributes = {
                name: 'string',
                email: 'string',
                birthdate: 'datetime'
            };
        }
    };

    // add persistence
    require('node-redis-mapper').mix_persistence_methods(models);

    models.User.create(function () {
        var user = this;
        console.log(user.created_at);
        user.name = 'John Doe';
        user.email = 'john@example.com';
        user.save(function (err) {
            if (!err) {
                console.log('User saved');
            } else {
                console.log('Could not save user');
            }
        });
    });

    models.User.connection.select(10);

Test
====

    # please note, tests by default running on database 9
    nodeunit test/orm.js

Contributing
============

Contributions to the project are most welcome, so feel free to fork and improve. When submitting a pull request, please ensure that JSLint coding style is met.
