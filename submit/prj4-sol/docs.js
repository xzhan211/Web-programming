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

  //console.log(port);
  //console.log(base);
  //console.log(model);

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
  //@TODO add appropriate routes
  const base = app.locals.base;
  app.get('/', doRedirect(app));
  app.get(`${base}/search.html`, searchContent(app));
  app.get(`${base}/add.html`, createForm(app));
  app.post(`${base}/add`, upload.single('file'), addContent(app));
  app.get(`${base}/:name`, getContent(app));
}
// something wrong here



/*************************** Action Routines ***************************/

//@TODO add action routines for routes + any auxiliary functions.
function doRedirect(app){
    return async function(req, res){
        res.redirect(`http://localhost:${app.locals.port}${app.locals.base}`);
    };
};

function getContent(app){
    return async function(req, res){
        //console.log("I am in Get part");
        let model;
        const name = req.params.name;
        try{
            const text = await app.locals.model.get(name);
            //console.log(text);
            model = {base: app.locals.base, text: text, name:name};
        }catch(err){
            //console.error(err);
            console.log('error happened!!');
        }
        //console.log(req);
        //console.log(req.pathname);
        const html = doMustache(app, 'content', model);
        res.send(html);
    };
};


function searchContent(app) {
    return async function(req, res) {
        console.log("I am in Search part");
        const isSubmit = req.query.submit !== undefined;
        let contents = [];
        let errors = undefined;
        const search = getNonEmptyValues(req.query);
        const exist = !(search.start === undefined);
        let q_old = '';
        //console.log(req.query);
        const localUrl = relativeUrl(req);

        if (exist || isSubmit) {
            if (Object.keys(search).length <= 1) {
	            errors = 'please specify one-or-more search terms';
                console.log('In search function, nothing input');
            }
            if (!errors) {
	            q_old = search.q;
                const q_new = q_old.replace(/\s+/gi, '%20');
                try {
                    if(exist === false){
	                    contents = await app.locals.model.search(q_new);
                    }else{
	                    contents = await app.locals.model.search(q_new, search.start);
                    }
                    //console.log('from left >>> ', contents);
	            }catch (err) {
                    console.log('error happened in search from web services');
                    errors = 'Errors resulting from the underlying web services.';
	            }
	            if (!errors && contents.totalCount === 0) {
	                errors = 'no document containing "' + q_old + '" found; please retry';
	            }else if(!errors && contents.totalCount > 0){
                    let q_set = q_old.split(/\s+/);
                    let q_element;
                    let reg;
                    for(q_element of q_set){
                        reg = new RegExp(`(${q_element})`, 'i');
                        contents.results.map(x => x.lines = x.lines.map(y => y.replace(reg, "<span class='search-term'>$1")));
                        contents.results.map(x => x.lines = x.lines.map(y => y.replace(reg, "$1</span>")));
                    }
                }
            }
        }


        let model = { base: app.locals.base, value: q_old };
        let template = 'search';
        if (!errors && (exist || isSubmit) && contents.totalCount > 0) {
            const linkSet = contents.links;
            let pre = '';
            let nxt = '';
            if(linkSet.length === 1){
                //console.log('BBBBB');
                model = { base: app.locals.base, value: q_old, contents: contents };
            }else if(linkSet.length === 3){
                //console.log('CCCCC');
                nxt = linkSet[1].href.replace(/.+\?/, 'http://localhost:4444/docs/search.html?');
                pre = linkSet[2].href.replace(/.+\?/, 'http://localhost:4444/docs/search.html?');
                nxt = nxt.replace(/(&count=).+/,'');
                pre = pre.replace(/(&count=).+/,'');
                model = { base: app.locals.base, value: q_old, contents: contents, previous: pre, next: nxt };
            }else if(linkSet.length === 2){
                if(linkSet[1].rel === 'next'){
                    //console.log('DDDDD');
                    nxt = linkSet[1].href.replace(/.+\?/, 'http://localhost:4444/docs/search.html?');
                    nxt = nxt.replace(/(&count=).+/,'');
                    model = { base: app.locals.base, value: q_old, contents: contents, next: nxt };
                }else if(linkSet[1].rel === 'previous'){
                    //console.log('EEEEE');
                    pre = linkSet[1].href.replace(/.+\?/, 'http://localhost:4444/docs/search.html?');
                    pre = pre.replace(/(&count=).+/,'');
                    model = { base: app.locals.base, value: q_old, contents: contents, previous: pre };
                }
            }
        }
        //else if(isSubmit && contents.totalCount === 0){
        else if(errors){

            if(Object.keys(search).length <= 1)
                model = { base: app.locals.base, value: q_old, errorsD: errors };
            else
                model = { base: app.locals.base, value: q_old, errorsU: errors };

        }
        const html = doMustache(app, template, model);
        res.send(html);
  };
};


function createForm(app){
    return async function(req, res){
        console.log("I am in createForm part");
        const model = { base: app.locals.base};
        const html = doMustache(app, 'add', model);
        res.send(html);
    };
};

function addContent(app){
    return async function(req, res){
        let errors = undefined;
        console.log("I am in addContent part");
        //console.log("*************>> ", req.file);

        let name = '';
        let content = '';
        let docs = [];
        if(req.file !== undefined){
            name = req.file.originalname.replace('.txt', '');
            content = req.file.buffer.toString('utf8');
            docs = [name, content];
        }else{
            errors = 'please select a file containing a document to upload';
        }

        if (!errors) {
            try {
	            let test = await app.locals.model.add(docs);
	            //console.log('test >> ', test);
                if(test === undefined){
                    errors = 'Error happened in web server';
                }else{
                    res.redirect(`${app.locals.base}/${name}`);
                }
            }catch (err) {
	            errors = 'Error happened in web server';
            }
        }

        if(errors) {
            const model = { base: app.locals.base, errors : errors};
            const html = doMustache(app, 'add', model);
            res.send(html);
        }
    };
};

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
