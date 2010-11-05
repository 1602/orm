var redis_lib = require('./redis-client/lib/redis-client.js'),
    sys = require("sys");

redis_lib.debugMode = false;
var redis = redis_lib.createClient();

exports.debugMode = false;
exports.useCache = false;

function cast_type_from_db(Model, attr, data) {
    switch (Model.attributes[attr]) {
        case 'int':
        data = parseInt(data, 10);
        break;
        case 'datetime':
        data = new Date(data);
        break;
        case 'string':
        data = data.toString();
        break;
    }
    return data;
}

// function construct(constructor, args) {
    // function F() {
        // return constructor.apply(this, args);
    // }
    // F.prototype = constructor.prototype;
    // return new F();
// }

// function prepare_arguments(args) {
    // var arr = [];
    // for (var i in args) {
        // arr.push(args[i]);
    // }
    // arr.pop();
    // return arr;
// }

function add_persistence_methods(Model, model_name) {

    Model.connection = redis;
    Model.redis = redis_lib;
    Model.prototype.connection = redis;
    Model.attributes.created_at = 'datetime';

    Model.create = function (params, callback) {
        var callback = arguments[arguments.length - 1];
        if (exports.debugMode)
            sys.debug("[create new " + model_name + "]");

        var self = new Model; // construct(Model, prepare_arguments(arguments));
        for (var i in params) {
            self[i] = params[i];
        }
        redis.incr('ids:' + model_name.toLowerCase(), function (err, id) {
            if (!err) {
                if (exports.debugMode)
                    sys.debug("[fetched next id for " + model_name + ":" + id + "]");
                self.id = id;
                self.created_at = new Date;
                self.save(function () {
                    if (self && self.initialize) {
                        self.initialize();
                    }
                    callback.apply(self, [id]);
                });
            } else if (exports.debugMode) {
                sys.debug('[can not fetch next id for ' + model_name + ']');
            }
        });
    };

    Model.prototype.update_attribute = function accessor(attr, value, callback) {
        var self = this;

        if (exports.debugMode) {
            sys.debug('[called set method ' + attr + ' of ' + model_name + ']');
        }
        if (Model.attributes[attr]) {
            redis.hset(model_name.toLowerCase() + ':' + this.id, attr, value.toString(), function (err) {
                self[attr] = value;
                if (typeof callback == 'function') {
                    callback.apply(self, [err]);
                }
            });
        } else {
            if (typeof callback == 'function') {
                callback(true);
            }
        }
    };

    Model.prototype.save = function (callback) {
        var wait = 0, error = false, callback_applied = false;
        for (var attr in Model.attributes) {
            if (Model.attributes.hasOwnProperty(attr) && typeof this[attr] !== 'undefined') {
                if (typeof callback == 'function') {
                    ++wait;
                    this.update_attribute(attr, this[attr], function (err) {
                        --wait;
                        error = error || err;
                        if (wait === 0) {
                            callback_applied = true;
                            callback.apply(this, [error]);
                        }
                    });
                } else {
                    this.update_attribute(attr, this[attr]);
                }
            }
        }
    };

    Model.prototype.reload = function (callback) {
        if (!this.id) {
            if (typeof callback == 'function') {
                callback.apply(this, [true]);
            }
            return;
        }
        var self = this;
        redis.hgetall(model_name.toLowerCase() + ':' + this.id, function (err, hash) {
            for (var attr in hash) {
                this[attr] = cast_type_from_db(Model, attr, hash[attr]);
            }
            callback.apply(this, [err]);
        });
    };

    // // define accessors for each attribute
    // for (var attr in Model.attributes) {
    //     Model.prototype[attr] = function accessor(value, callback) {
    //         var self = this;

    //         // setter
    //         if (typeof value !== 'undefined' && typeof value !== 'function') {
    //             if (exports.debugMode) {
    //                 sys.debug('[called set method ' + attr + ' of ' + model_name + ']');
    //             }
    //             if (accessor.cache) {
    //                 accessor.cache[this.id] = value;
    //             }
    //             redis.hset(model_name.toLowerCase() + ':' + this.id, attr, value.toString(), callback);
    //             return;
    //         }

    //         // getter
    //         if (exports.debugMode) {
    //             sys.debug('[called get method ' + attr + ' of ' + model_name + ']');
    //         }

    //         if (accessor.cache && typeof accessor.cache[this.id] !== 'undefined') {
    //             if (exports.debugMode) {
    //                 sys.debug('[using cached value]');
    //             }
    //             value(null, accessor.cache[this.id]);
    //         } else {
    //             if (exports.debugMode) {
    //                 sys.debug('[fetch value from storage]');
    //             }
    //             redis.hget(model_name.toLowerCase() + ':' + this.id, attr, function (err, data) {
    //                 if (!err) {
    //                     data = cast_type_from_db(Model, attr, data);
    //                     if (accessor.cache) {
    //                         accessor.cache[self.id] = data;
    //                     }
    //                     if (value) {
    //                         value(err, null);
    //                     }
    //                 }
    //             });
    //         }
    //     };
    //     if (exports.useCache) {
    //         Model.prototype[attr].cache = {};
    //     }
    // }

    // define object batch loader
    Model.find = function (id, callback) {
        if (exports.debugMode) {
            sys.debug('[fetch hash from storage]');
        }
        redis.hgetall(model_name.toLowerCase() + ':' + id, function (err, hash) {
            var obj = null;
            if (!err) {
                for (var attr in hash) {
                    if (!obj) {
                        obj = new Model;
                    }
                    obj[attr] = cast_type_from_db(Model, attr, hash[attr]);
                }
            }
            if (obj && obj.initialize) {
                obj.initialize();
            }
            if (typeof callback == 'function') callback.apply(obj, [err || obj ? null : true]);
        });
    };

    Model.exists = function (id, callback) {
        redis.exists(model_name.toLowerCase() + ':' + id, function (err, exists) {
            if (typeof callback == 'function') {
                callback(exists);
            }
        });
    };

    Model.prototype.destroy = function (callback) {
        var self = this;
        redis.del(model_name.toLowerCase() + ':' + this.id, function (err, succ) {
            delete self;
            callback(err, succ);
        });
    };
}

// add persistence methods for all models
exports.mix_persistence_methods = function (model_or_collection, model_name) {
    if (typeof model_or_collection == 'function') {
        add_persistence_methods(model_or_collection, model_name);
    } else {
        for (var model in model_or_collection) {
            if (typeof model_or_collection[model] == 'function') {
                add_persistence_methods(model_or_collection[model], model);
            }
        }
    }
};
