var redis_lib = require('./redis-client/lib/redis-client.js'),
    sys = require("sys");

redis_lib.debugMode = false;
var redis = redis_lib.createClient();

exports.debugMode = false;
exports.useCache = false;

function ucwords(str) {
   str = str.split("_");

   for (i = 0; i < str.length; ++i) {
       str[i] = str[i].substring(0, 1).toUpperCase() + str[i].substring(1).toLowerCase();
   }

   return str.join('');
}

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
        case 'json':
        data = JSON.parse(data.toString());
        break;
        default:
        data = parseInt(data, 10);
        break;
    }
    return data;
}

function cast_type_for_db(Model, attr, data) {
    switch (Model.attributes[attr]) {
        case 'json':
        return JSON.stringify(data);

        case 'datetime':
        case 'string':
        case 'int':
        return data.toString();

        default:
        return data && data.id ? data.id.toString() : data.toString();
    }
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

function add_persistence_methods(Model, model_name, namespace) {

    Model.connection = redis;
    Model.redis = redis_lib;
    Model.prototype.connection = redis;
    Model.attributes.created_at = 'datetime';

    Model.create = function (params) {
        var callback = arguments[arguments.length - 1];
        if (exports.debugMode)
            sys.debug("[create new " + model_name + "]");

        var self = new Model; // construct(Model, prepare_arguments(arguments));
        if (arguments.length == 2) {
            for (var i in params) {
                self[i] = params[i];
            }
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
            console.log('update attrib', this.id, attr, value);
            redis.hset(model_name.toLowerCase() + ':' + this.id, attr, cast_type_for_db(Model, attr, value), function (err) {
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

    Model.prototype.save = function (data, callback) {
        var wait = 0, error = false, callback_applied = false;
        if (typeof data == 'function') {
            callback = data;
            data = {};
        }
        for (var attr in Model.attributes) {
                console.log(attr);
                console.log(this);
            if (Model.attributes.hasOwnProperty(attr) && typeof this[attr] !== 'undefined') {
                console.log(attr);
                console.log(typeof callback);
                if (typeof callback == 'function') {
                    ++wait;
                    if (typeof data[attr] !== 'undefined') {
                        this[attr] = data[attr];
                    }
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

    Model.prototype.get = function (attr, callback) {
        var submodel_name = Model.attributes[attr];
        if (submodel_name == 'string' || submodel_name == 'int' || submodel_name == 'datetime') {
            callback(this[attr]);
            return;
        }
        if (namespace) {
            console.log('getter with namespace');
            console.log(this[attr]);
            namespace[ucwords(submodel_name)].find(this[attr], function () {
                console.log(this);
                console.log(arguments);
                callback(this);
            });
        } else {
            this.connection.hgetall(submodel_name + ':' + this[attr], function (err, hash) {
                var new_hash = {};
                for (var i in hash) {
                    new_hash[i] = cast_type_from_db(Model, i, hash[i].toString());
                }
                callback(new_hash);
            });
        }
    };

    Model.prototype.to_hash = function () {
        var hash = {};
        for (var i in Model.attributes) {
            hash[i] = this[i];
        }
        return hash;
    };

    Model.prototype.reload = function (callback) {
        var self = this;
        if (!this.id) {
            if (typeof callback == 'function') {
                callback.apply(this, [true]);
            }
            return;
        }
        var self = this;
        redis.hgetall(model_name.toLowerCase() + ':' + this.id, function (err, hash) {
            for (var attr in hash) {
                self[attr] = cast_type_from_db(Model, attr, hash[attr]);
            }
            if (self.initialize) self.initialize();
            callback.apply(self, [err]);
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

    /**
     * Find object in database
     * @param {Number} id identifier of record
     * @param {Function} callback(err) Function will be called after search
     * it accepts one argument: error, applies to object
     *
     */
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
                        obj.id = id;
                    }
                    obj[attr] = cast_type_from_db(Model, attr, hash[attr]);
                }
            }
            if (obj && obj.initialize) {
                obj.initialize();
            }
            if (typeof callback == 'function') callback.call(obj, err || obj ? null : true);
        });
    };

    Model.exists = function (id, callback) {
        redis.exists(model_name.toLowerCase() + ':' + id, function (err, exists) {
            if (typeof callback == 'function') {
                callback(exists);
            }
        });
    };

    Model.find_or_create = function (id, callback) {
        Model.exists(id, function (exists) {
            if (exists) {
                Model.find(id, callback);
            } else {
                var obj = new Model;
                obj.id = id;
                obj.created_at = new Date;
                obj.save(callback);
            }
        });
    };

    Model.update_or_create = function (data, callback) {
        Model.exists(data.id, function (exists) {
            if (exists) {
                Model.find(id, function () {
                    this.save(data, function () {
                        callback.call(this);
                    });
                });
            } else {
                Model.create(data, function () {
                    callback.call(this);
                });
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
                add_persistence_methods(model_or_collection[model], model, model_or_collection);
            }
        }
    }
};
