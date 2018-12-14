#!/usr/bin/env node

'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const process = require('process');
const url = require('url');
const queryString = require('querystring');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;


//Main URLs
const DOCS = '/docs';
const COMPLETIONS = '/completions';

//Default value for count parameter
const COUNT = 5;

/** Listen on port for incoming requests.  Use docFinder instance
 *  of DocFinder to access document collection methods.
 */
function serve(port, docFinder) {
  const app = express();
  app.locals.port = port;
  app.locals.finder = docFinder;
  setupRoutes(app);
  const server = app.listen(port, async function() {
    console.log(`PID ${process.pid} listening on port ${port}`);
  });
  return server;
}

module.exports = { serve };

function setupRoutes(app) {
  app.use(cors());            //for security workaround in future projects
  app.use(bodyParser.json()); //all incoming bodies are JSON

  //@TODO: add routes for required 4 services

  app.get(`${DOCS}/:id`, getContent(app));
  app.get(`${COMPLETIONS}` , getCompletions(app));
  app.get(`${DOCS}` , searchContent(app));
  app.post(`${DOCS}`, addContent(app));
  app.use(doErrors()); //must be last; setup for server errors   
}

//@TODO: add handler creation functions called by route setup
//routine for each individual web service.  Note that each
//returned handler should be wrapped using errorWrap() to
//ensure that any internal errors are handled reasonably.
function getContent(app){
  return errorWrap(async function(req, res){
    try{
      const id = req.params.id;
      const results = await app.locals.finder.docContent(id);
      //console.log('>>>> %s', results);
      if (results.length === 0) {
        throw{};
      }else{
        const hrefAddr = baseUrl(req, DOCS);
        res.json({
          'content' : results,
          'links' : [{
            'rel' : 'self',
            'href' : `${hrefAddr}/${id}`
          }]
        });
      }
    }catch(err){
      res.json({
        'code': NOT_FOUND,
        'message': 'Cannot find anything by your searching'
      });
    }
  });
}
// example: $ curl -s 'http://localhost:1235/completions?text=the+hunting+of+the+sna' | jq .
function getCompletions(app){
  return errorWrap(async function(req, res){
    try{
      const text = req.query.text;
      //console.log('>>> %s', text);
      const results = await app.locals.finder.complete(text);
      if (text === undefined) {
        throw{};
      }else{
        res.json(results);
      }
    }catch(err){
      res.json({
        'BAD_PARAM': 'BAD_PARAM',
        'message': "required query parameter \'text\' is missing"
      });
    }
  });
}
// example: $ curl -s 'http://localhost:1235/docs?q=beaver%20daylight' | jq .
function searchContent(app){
  return errorWrap(async function(req, res){
    let errorCode = 0; 
    try{
      const params = req.query;
      const text = params.q;
      const count = parseInt(params.count || 5);
      const start = parseInt(params.start || 0);  
      const results = await app.locals.finder.find(text);
      const len = results.length;
      const end = count + start;
      const part = results.slice(start, end); 
      const hrefAddr = baseUrl(req, DOCS);
      part.map(obj => obj.href = hrefAddr+'/'+obj.name);
      console.log(params);

      const reg = /(^[1-9][0-9]*)|(0)/; 
      if(!params.hasOwnProperty('q')){
        errorCode = 1;
        throw{};
      }
      if(params.hasOwnProperty('start')){
        if(!reg.test(params.start)){
          errorCode = 2;
          throw{};
        }
      }
      if(params.hasOwnProperty('count')){
        if(!reg.test(params.count)){
          errorCode = 3;
          throw{};
        }
      }

      const links = [];
      const paramsString = combineParam(text); 
      
      // self 
      const relSelf = {
        'rel': 'self',
        'href': `${hrefAddr}?q=${paramsString}&start=${start}&count=${count}`
      };
      links.push(relSelf);
      
      // previous
      let previous = start - count;
      let relPrv = {};
      if(len !== 0 && start !== 0){
        if(previous < 0)
          previous = 0;
        relPrv = {
          'rel': 'previous',
          'href': `${hrefAddr}?q=${paramsString}&start=${previous}&count=${count}`
        };
        links.push(relPrv);
      }
       
      // next
      const next = start + count;
      let relNext = {};
      if(len !== 0 && next <= len-1){
        relNext = {
          'rel': 'next',
          'href': `${hrefAddr}?q=${paramsString}&start=${next}&count=${count}`
        };
        links.push(relNext);
      }

      res.json({
        'results' : part,
        'totalCount' : len,
        'links' : links 
      });

    }catch(err){
      let errMessage = '';
      if(errorCode === 1)
        errMessage = "required query parameter \"q\" is missing"; 
      else if(errorCode === 2)
        errMessage = "bad query parameter \"start\"";
      else if(errorCode === 3)
        errMessage = "bad query parameter \"count\"";
      res.json({
        'code': 'BAD_PARAM',
        'message': errMessage 
      });
    }
  });
}

function combineParam(str){
  let ans = '';
  let arr = str.split(/\s+/); 
  for(const p of arr){
    ans += '%20'+ p;
  }
  return ans.slice(3);
}

//Add Content
function addContent(app){
  let errorCode = 0; 
  return errorWrap(async function(req, res){
    try{
      const body = req.body;
      
      if(!body.hasOwnProperty('name')){
        errorCode = 1;
        throw{};
      }
      if(!body.hasOwnProperty('content')){
        errorCode = 2;
        throw{};
      }
      
      await app.locals.finder.addContent(body.name, body.content);
      const hrefAddr = baseUrl(req, DOCS)+'/'+body.name;
      res.json({
        "href": hrefAddr 
      });
    }catch(err){
      let errMessage = '';
      if(errorCode === 1)
        errMessage = "required body parameter \"name\" is missing"; 
      else if(errorCode === 2)
        errMessage = "required body parameter \"content\" is missing";
      res.json({
        'code': 'BAD_PARAM',
        'message': errMessage 
      });
    }
  });
}



/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}
