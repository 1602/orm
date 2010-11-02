var models = {
    Player: function Player(game_id) {
        this.game_id = game_id;

        Player.attributes = {
            game_id: 'int'
        }
    }
}

require('../lib/orm.js').mix_persistence_methods(models);
models.Player.connection.select(9);
models.Player.connection.flushdb();

models.useCache = true;
models.debugMode = false;

var group_name = false;
function it(should, test_case) {
    if (group_name) {
        exports[group_name][should] = test_case;
    } else {
        exports[should] = test_case;
    }
}

function context(name, tests) {
    exports[name] = {};
    group_name = name;
    tests();
    group_name = false;
}

// class methods

context('class', function () {

    it('should create player', function (test) {

        test.expect(4);

        models.Player.create(15, function (id) {

            test.strictEqual(this.game_id, 15,
            'Parameter passed to constructor should be applied');

            test.strictEqual(this.constructor, models.Player,
            'User should have id');

            test.ok(this.id,
            'User should have id');

            test.ok(id,
            'Newly created id should pass to callback');

            test.done();
        });
    });

    it('should remember when time of object creation', function (test) {
        models.Player.create(function () {
            test.ok(this.created_at, 'Time accesible as attribute');
            this.created_at = false;
            this.reload(function () {
                test.ok(this.created_at, 'Time stored in database');
                test.done();
            });
        });
    });

    it('should check existance of record', function (test) {
        models.Player.create(function (player_id) {
            models.Player.exists(player_id, function (exists) {
                test.ok(exists, 'Player exists');
                test.done();
            });
        });
    });

    it('should load player when it exists', function (test) {
        models.Player.create(function (id) {
            var player_id = id;
            this.update_attribute('game_id', 11, function () {
                models.Player.find(player_id, function (err) {

                    test.ok(!err,
                    'Error should not be raised');

                    test.strictEqual(this.game_id, 11,
                    'Game id should be updated');

                    test.strictEqual(this.constructor, models.Player,
                    'Callback called on object\'s context');

                    test.done();
                });
            });
        });
    });

    it('should not load player when it not exists', function (test) {

        test.expect(2);

        models.Player.find(0, function (err) {
            test.notEqual(this.constructor, models.Player,
            'Should be null');

            test.ok(err,
            'Should be error');

            test.done();
        });
    });
});

context('instance methods', function () {

    it('should save all attributes', function (test) {

        test.expect(2);

        models.Player.create(function (player_id) {
            this.game_id = 77;
            this.save(function (err) {
                test.ok(!err, 'No errors required');

                models.Player.find(player_id, function (err) {
                    test.strictEqual(this.game_id, 77,
                    'Attribute value should be stored');

                    test.done();
                });
            });
        });
    });

    it('should reload attributes', function (test) {

        test.expect(2);

        models.Player.create(function (player_id) {
            this.update_attribute('game_id', 100, function (err) {
                this.game_id = 0;
                this.reload(function (err) {
                    test.ok(!err, 'No errors required');

                    test.strictEqual(this.game_id, 100,
                    'Correct value should be restored');
                    test.done();
                });
            });
        });
    });

    it('should destroy record', function (test) {
        models.Player.create(function (player_id) {
            var player = this;
            models.Player.exists(player_id, function (exists) {
                test.ok(exists, 'Player exists');
                player.destroy(function (err, success) {
                    test.ok(!err, 'No errors required');
                    test.ok(success, 'Success returned');
                    models.Player.exists(player_id, function (exists) {
                        test.ok(!exists, 'Object not exists');
                        test.done();
                    });
                });
            });
        });
    });
});

// it('should work really fast', function (test) {
//     test.expect(1);
// 
//     var n = 0;
//     for (var i = 0; i < 10000; i++) {
//         (function (i) {
//             ++n;
//             models.Player.create(function (player_id) {
//                 --n;
//                 if (n === 0) {
//                     test.ok(true);
//                     models.Player.connection.flushdb();
//                     test.done();
//                 }
//             });
//         })(i);
//     }
// });
