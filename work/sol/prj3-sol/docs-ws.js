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
  app.use(bodyParser.json({limit: '5mb'})); //all incoming bodies are JSON
  app.get(DOCS, doFind(app));
  app.get(`${DOCS}/:id`, doGet(app));
  app.post(DOCS, doUpload(app));
  app.get(COMPLETIONS, doCompletions(app));
  app.use(doErrors()); //must be last; setup for server errors   
}

function doFind(app) {
  return errorWrap(async function(req, res, next) {
    const params = findQuery(req.query);
    if (params.q === undefined) {
      res.status(BAD_REQUEST);
      res.json(params);
    }
    else {
      const results = await app.locals.finder.find(params.q);
      const response = findResponse(req, params, results);
      res.json(response);
    }
  });
}

function doUpload(app) {
  return errorWrap(async function(req, res) {
    let isOk = true;
    for (const key of ['name', 'content']) {
      if (req.body[key] === undefined) {
	res.status(BAD_REQUEST);
	res.json({ code: 'BAD_PARAM',
		   message: `required body parameter "${key}" is missing`,
		 });
	isOk = false; break;
      }
    }
    if (isOk) {
      const {name, content} = req.body;
      await app.locals.finder.addContent(name, content);
      const location = `${baseUrl(req, DOCS)}/${name}`;
      res.location(location);
      res.status(CREATED).json({href: location});
    }
  });
}

function doCompletions(app) {
  return errorWrap(async function(req, res) {
    const text = req.query.text;
    if (text === undefined) {
      res.status(BAD_REQUEST);
      res.json({ code: 'BAD_PARAM',
		 message: 'required query parameter "text" is missing',
	       });
    }
    else {
      res.json(await app.locals.finder.complete(text));
    }
  });
}

function doGet(app) {
  return errorWrap(async function(req, res) {
    const id = req.params.id;
    try {
      const content = await app.locals.finder.docContent(id);
      const self = `${baseUrl(req, DOCS)}/${id}`;
      const links = [ { rel: 'self', href: self }];
      res.json({ content, links } );
    }
    catch (err) {
      res.status(NOT_FOUND);
      res.json({ code: err.code, message: err.message} );
    }
  });
}

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
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
  
/** Verify query parameters for find service. */ 
function findQuery(query) {
  let params;
  const q = query.q;
  if (q === undefined) {
    params = {
      code: 'BAD_PARAM',
      message: 'required query parameter "q" is missing',
    };
  }
  else {
    const start = Number(query.start || 0);
    const count = Number(query.count || COUNT);
    const isStartError =  (isNaN(start) || start < 0);
    const isCountError = (isNaN(count) || count < 0);
    if (isStartError || isCountError) {
      const badParam = (isStartError) ? 'start' : 'count';
      params = {
	code: 'BAD_PARAM',
	message: `bad query parameter "${badParam}"`,
      }
    }
    else {
      params = { q, start, count };
    }
  }
  return params;
}

/** Create response for find() service */
function findResponse(req, params, results) {
  const url = `${baseUrl(req, DOCS)}`;
  const nextIndex = params.start + params.count;
  const links = [
    { rel: 'self',
      href: `${url}?${queryString.stringify(params)}`,
      start: params.start,
    }
  ];
  if (nextIndex < results.length) {
    const nextParams = Object.assign({}, params, { start: nextIndex });
    const next = `${url}?${queryString.stringify(nextParams)}`;
    links.push({ rel: 'next', href: next, start: nextIndex });
  }
  if (params.start > 0) {
    let previousIndex = params.start - params.count;
    if (previousIndex < 0) previousIndex = 0;
    const previousParams = Object.assign({}, params, { start: previousIndex });
    const previous = `${url}?${queryString.stringify(previousParams)}`;
    links.push({ rel: 'previous', href: previous, start: previousIndex });
  }
  const selected =
    results.slice(params.start, nextIndex).
    map(r => ({ ...r, href: `${url}/${r.name}` }));
  return {
    results: selected,
    totalCount: results.length,
    links
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
