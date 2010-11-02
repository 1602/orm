About
=====

ORM is simple Object-redis-mapper, which provides simple object interface to redis data storage.
It adds some methods to the selected model: create, find, exists, etc..

Check out test to learn how to use this lib.

Prerequisites
=============

Redis server version 2.0.3
node version 0.2.2
nodeunit (for running tests)

Installation
============

    git clone git://github.com/1602/orm.git vendor/orm
    git submodule update --init

Usage
=====

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
    require('../vendor/orm.js').mix_persistence_methods(models);

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
    cd vendor/orm
    nodeunit test/orm.js
