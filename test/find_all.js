var models = {};
models.Player = function Player() { };
models.Player.attributes = {
    game_id: 'int'
};

require('../lib/orm.js').mix_persistence_methods(models);
exports['should find all records'] = function (test) {
    models.Player.all(function (data) {
        test.ok(data);
        test.done();
    });
};
