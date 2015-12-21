var express = require('express');
var router = express.Router();
var denodeify = require('denodeify');
var redisHelper = require('../modules/redis_helper');
var unirest = require('unirest');
var conf = require('../modules/config.js');
var path = require('path');
var debug = require('debug')('GitTrack-Cache:index');
/* GET home page. */
router.all('/*', function(req, res, next) {
  var redisClient;
  redisHelper.connect()
  .then(client => {
    redisClient = client;
    return client.getAsync(req.url)
  })
  .then(reply => {
    if (reply) {
      debug('sending cached response:');
      res.status(200).send(JSON.parse(reply));
      return null;
    }

    return new Promise((resolve, reject) => {
      var requestUrl = conf.get('HOST_PROTOCOL') + path.join(conf.get('HOST'), req.url)
        + '?' + conf.get('QUERY_APPEND');
      debug('making request to: ' + requestUrl)
      unirest.get(requestUrl)
      .headers({
        'User-Agent': 'Mozilla/5.0'
      })
      .end(response => {
        if(response.error) {
          return reject(response.error);
        }
        debug('successfuly made request');
        return resolve(response.body);
      });
    });
    
  })
  .then(result => {

    if (!result) {
      // we sent a cached response already
      return;
    }
    debug('sending response body');
    res.status(200).send(result);
    debug('caching request key: ' + req.url);
    redisClient.setAsync(req.url, JSON.stringify(result))
    .then(() => {
      redisClient.expireAsync(req.url, conf.get('CACHE_TTL_SECS'))
      .then(() => {
        debug('successfuly cached request key: ' + req.url + ' for ' 
          + conf.get('CACHE_TTL_SECS') + ' second TTL');
      });
      
    });
  })
  .catch(err => {
    console.error(err);
    console.error(err.stack);
  });
});

module.exports = router;
