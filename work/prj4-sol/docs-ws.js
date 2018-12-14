'use strict';

const axios = require('axios');

function DocsWs(baseUrl) {
  this.docsUrl = `${baseUrl}/docs`;
}

module.exports = DocsWs;

//@TODO add wrappers to call remote web services.

DocsWs.prototype.get = async function(name){
    try{
        console.log('docs-ws get input params: ', name);
        const response = await axios.get(`${this.docsUrl}/${name}`);
        return response.data;
    }catch(err){
        console.log('error happened in docs-ws get');
    }
};


DocsWs.prototype.add = async function(docs) {
  try {
        let obj = {name: docs[0], content: docs[1]};
        console.log('docs-ws add input params: ', obj);
        const response = await axios.post(this.docsUrl, obj);
        return response.data;
  }catch (err) {
        console.log('error happened in docs-ws add');
  }
};

DocsWs.prototype.search = async function(word, start=0){
    try{
        console.log('docs-ws search input params: ', word);
        const response = await axios.get(`${this.docsUrl}?q=${word}&start=${start}`);
        return response.data;
    }catch(err){
        console.log('error happened in docs-ws search');
    }
};
