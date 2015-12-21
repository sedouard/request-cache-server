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
      var response = JSON.parse(reply);
      response._isCached = true;
      return response;
    }

    return new Promise((resolve, reject) => {
      var requestUrl = conf.get('HOST_PROTOCOL') + path.join(conf.get('HOST'), req.url);
      debug('making request to: ' + requestUrl);
      debug('query:');
      debug({
        client_id: conf.get('CLIENT_ID'),
        client_secret: conf.get('CLIENT_SECRET')
      });
      unirest.get(requestUrl)
      .query({
        client_id: conf.get('CLIENT_ID'),
        client_secret: conf.get('CLIENT_SECRET')
      })
      .headers({
        'User-Agent': 'Mozilla/5.0'
      })
      .end(response => {
        if(response.error) {
          debug(response.body);
          return reject(response.error);
        }
        debug('successfuly made request');
        return resolve(response);
      });
    });
    
  })
  .then(result => {

    debug('sending response body');

    //github specific
    if (result.headers.link) {
      debug('sanitizing secrets in headers');
      result.headers.link = result.headers.link.replace(/&client_id=.+?&client_secret=.+?>/g, '>');
    }
    res.status(200).set(result.headers).send(result.body);
    
    if (!result._isCached) {
      debug('caching request key: ' + req.url);
      redisClient.setAsync(req.url, JSON.stringify(result))
      .then(() => {
        redisClient.expireAsync(req.url, parseInt(conf.get('CACHE_TTL_SECS')))
        .then(() => {
          debug('successfuly cached request key: ' + req.url + ' for ' 
            + conf.get('CACHE_TTL_SECS') + ' second TTL');
        });
        
      });
    }
  })
  .catch(err => {
    if (err.status) {
      return res.status(err.status).send(err);
    } else {
      return res.status(500).send(err);
    }
  });
});

module.exports = router;
