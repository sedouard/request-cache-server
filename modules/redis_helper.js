var redis = require('redis');
var bluebird = require('bluebird');
var conf = require('./config');
var debug = require('debug')('GitTrack-Cache:redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
var redisClient = null;
var connect = function () {

  if (redisClient && redisClient.connected) {
    return new Promise(resolve => resolve(redisClient));
  }

  redisClient = redis.createClient(conf.get('REDIS_URL'));

  return new Promise((resolve, reject) => {
    redisClient.on('connect', () => {
      debug('Sucessfully connected to redis');
      return resolve(redisClient);
    });
    redisClient.on('error', (err) => {
      debug('Error connecting to redis');
      console.error(err);
      return reject(err);
    });
  });
};

module.exports = {
  connect: connect
};
