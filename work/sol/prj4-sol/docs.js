'use strict';

const express = require('express');
const upload = require('multer')();
const fs = require('fs');
const mustache = require('mustache');
const Path = require('path');
const { URL } = require('url');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.model = model;
  process.chdir(__dirname);
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app, TEMPLATES_DIR);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  const base = app.locals.base;
  app.get(`/`, doHome(app));
  app.get(`${base}/search.html`, doSearch(app));
  app.get(`${base}/add.html`, doAdd(app));
  app.post(`${base}/add`, upload.single('file'), doAdd(app));
  app.get(`${base}/:name`, doGet(app));
}

/*************************** Action Routines ***************************/

function doAdd(app) {
  return async function(req, res) {
    const isSubmit = req.body && req.body.submit !== undefined;
    let [errors, addError] = [ [], ];
    if (isSubmit) {
      try {
	const originalName = req.file && req.file.originalname;
	if (originalName) {
	  const name = Path.basename(originalName, '.txt');
	  const content = req.file.buffer.toString('utf8');
	  const wsResult = await app.locals.model.addContent(name, content);
	  res.redirect(relativeUrl(req, `../${name}`));
	  return;
	}
	else {
	  addError = 'please select a file containing a document to upload';
	}
      }
      catch (err) {
	console.error(err);
	errors = [err.message || err.toString()];
      }
    }
    const viewModel = { base: app.locals.base, errors, addError }
    const html = doMustache(app, 'add', viewModel);
    res.send(html);
  };
}

function doGet(app) {
  return async function(req, res) {
    let model, template;
    const name = req.params.name;
    const base = app.locals.base;
    try {
      const json = await app.locals.model.getContent(name);
      model = {	name, content: json.content, base };
    }
    catch (err) {
      console.error(err);
      model = { base, errors: [ err.message || err.toString() ] };
    }
    const html = doMustache(app, 'content', model);
    res.send(html);
  };
};

function doHome(app) {
  return async function(req, res) {
    res.redirect(`${app.locals.base}`);
  };
}

function doSearch(app) {
  return async function(req, res) {
    let results = {};
    let errors, searchError = undefined;
    const isSubmit =
      req.query && Object.keys(req.query) && Object.keys(req.query).length;
    const search = getNonEmptyValues(req.query);
    let {q, start} = search;
    if (isSubmit) {
      if (q === undefined) {
	searchError = 'please specify one-or-more search terms';
      }
      if (!searchError) {
	try {
	  const wsResults = await app.locals.model.searchDocs(q, start);
	  if (wsResults) results = searchViewModel(req, search.q, wsResults)
	}
	catch (err) {
	  console.error(err);
	  errors = [ err.message || err.toString() ];
	}
	if (results.results && results.results.length === 0) {
	  errors = [ `no document containing "${q}" found; please retry` ];
	}
      }
    }
    const base = app.locals.base;
    const self = 'search.html';
    const model = Object.assign({}, results,
				{base, q, errors, searchError, self});
    const html = doMustache(app, 'search', model);
    res.send(html);
  };
};


function searchViewModel(req, searchTerms, results) {
  const out = {};
  const words = new Set(searchTerms.toLowerCase().split(/\W+/));
  out.results = results.results.map(result => {
    const lines = result.lines.map(line => {
      return line.replace(/\w+/g, w => {
	const isSearch = words.has(w.toLowerCase());
	return (isSearch) ? `<span class="search-term">${w}</span>` : w;
      });
    });
    const href = relativeUrl(req, `../${result.name}`);
    return Object.assign({}, result, { lines, href });
  });
  results.links.forEach(link => {
    if (link.rel === 'next' || link.rel === 'previous') {
      const params = { q: searchTerms, start: link.start };
      out[link.rel] = relativeUrl(req, '', params);

    }
  });
  return out;
}

/************************ General Utilities ****************************/

/** return object containing all non-empty values from object values */
function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    const v = values[k];
    if (v && v.trim().length > 0) out[k] = v.trim();
  });
  return out;
}


/** Return a URL relative to req.originalUrl.  Returned URL path
 *  determined by path (which is absolute if starting with /). For
 *  example, specifying path as ../search.html will return a URL which
 *  is a sibling of the current document.  Object queryParams are
 *  encoded into the result's query-string and hash is set up as a
 *  fragment identifier for the result.
 *
 */
function relativeUrl(req, path='', queryParams={}, hash='') {
  const url = new URL('http://dummy.com');
  url.protocol = req.protocol;
  url.hostname = req.hostname;
  url.port = req.socket.address().port;
  url.pathname = req.originalUrl.replace(/(\?.*)?$/, '');
  if (path.startsWith('/')) {
    url.pathname = path;
  }
  else if (path) {
    url.pathname += `/${path}`;
  }
  url.search = '';
  Object.entries(queryParams).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  url.hash = hash;
  return url.toString();
}

/************************** Template Utilities *************************/


/** Return result of mixing view-model view into template templateId
 *  in app templates.
 */
function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

/** Add contents all dir/*.ms files to app templates with each 
 *  template being keyed by the basename (sans extensions) of
 *  its file basename.
 */
function setupTemplates(app, dir) {
  app.templates = {};
  for (let fname of fs.readdirSync(dir)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

