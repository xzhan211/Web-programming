const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const {inspect} = require('util'); //for debugging

'use strict';

/** This class is expected to persist its state.  Hence when the
 *  class is created with a specific database url, it is expected
 *  to retain the state it had when it was last used with that URL.
 */ 
class DocFinder {

  /** Constructor for instance of DocFinder. The dbUrl is
   *  expected to be of the form mongodb://SERVER:PORT/DB
   *  where SERVER/PORT specifies the server and port on
   *  which the mongo database server is running and DB is
   *  name of the database within that database server which
   *  hosts the persistent content provided by this class.
   */
  constructor(dbUrl) {
    //TODO
    var n = dbUrl.split('\/');
    this.dbName = n[n.length - 1];
    this.url = dbUrl;
    this.contentTable = 'orignContent';
    this.noiseSet = 'noiseSet';
    this.indexTable = 'indexTable';
    this.noiseWordsSet = new Set();
    this.indexes = new Map();
    //map of completions
    this.completions = new Map();
    this.flag = 0;
  }

  /** This routine is used for all asynchronous initialization
   *  for instance of DocFinder.  It must be called by a client
   *  immediately after creating a new instance of this.
   */
  async init() {
    //TODO
    this.client = await mongo.connect(this.url, {useNewUrlParser: true});
    this.db = this.client.db(this.dbName);
  }

  /** Release all resources held by this doc-finder.  Specifically,
   *  close any database connections.
   */

  /** Author: XY Z
   *  below close db, create main index.
   *  At first, I create index map in add content function.
   *  When import new atricles, add content function will be called several times.
   *  So, I decide to create main index in close function.
   *  Because close function is only called by one time.
   */
  async close() {
    //TODO 
   
    // using this.flag to check if add content function has been called
    // flag == 1 means add content function is called.
    // if add content function is called, main index table should be create/update
    if(this.flag === 1){
      const dbTable2 = this.db.collection(this.indexTable);
      try {
        const keyArr = this.indexes.keys();
        // checkFlag is using for check if the main index table exist.
        // if existed, we should read the data from db, then modify it, write back db finally.
        // if doesn't exist, no need to read data from db, directly create(insert) should be fine.
        // In this way, it is very fast. But, make sure store most of data in db in first time.
        // In other case, like update data, data size should be relatively small.
        const check = await dbTable2.find();
        const checkFlag = await check.hasNext();

        for(const key of keyArr){
          const articles = this.indexes.get(key);
          const artKeyArr = articles.keys();
        
          let arr = [];
          for(const akey of artKeyArr){
            const numAndOffset = articles.get(akey);
            const element = {name: akey, info: numAndOffset};
            arr.push(element);
          }
          
          if(checkFlag === false){
            await dbTable2.insertOne({
              word: key,    
              articles: arr  
            });
          }else{
            let target = await dbTable2.findOne({word:key});
            if(target===null){
              await dbTable2.insertOne({
                word: key,    
                articles: arr  
              });
            }else{
              for(const a of arr){
                //console.log(a);
                target.articles.push(a);
              }
              await dbTable2.updateOne(
                {word: key}, 
                {
                  $set:
                  {articles: target.articles}
                }, 
                {upsert: true}
              ); 
            }
          }
        }

      }catch (err) {
        if (isDuplicateError(err)) {
          console.log('dup error!');
        }else{
          throw err;
        }
      }
    }
    await this.client.close();
  }

  /** Clear database */
  async clear() {
    //TODO
    await this.db.dropDatabase();
    //console.log(">>> clear!!");
  }

  /** Return an array of non-noise normalized words from string
   *  contentText.  Non-noise means it is not a word in the noiseWords
   *  which have been added to this object.  Normalized means that
   *  words are lower-cased, have been stemmed and all non-alphabetic
   *  characters matching regex [^a-z] have been removed.
   */
  async words(contentText) {
    //TODO
    return this._wordsLow(contentText).map((pair) => pair[0]);
  }

  _wordsLow(content) {
      const words = [];
      let match;
      while (match = WORD_REGEX.exec(content)) {
        const word = normalize(match[0]);
        if (word && !this.noiseWordsSet.has(word)) {
          words.push([word, match.index]);
        }
      }
      return words;
    }

  /** Add all normalized words in the noiseText string to this as
   *  noise words.  This operation should be idempotent.
   */
  async addNoiseWords(noiseText) {
    //TODO
    const noiseWordsSet = noiseText.split('\n');
    const noiseTable = this.db.collection(this.noiseSet);
    try{
      await noiseTable.insertOne({
        _id: 1,
        item: 'polarizing_filter',
        tags:[]
      });
      for(const word of noiseWordsSet){
        await noiseTable.updateOne({_id: 1}, {$addToSet: { tags: word }}); 
      } 
    }catch(err){
      console.log('insert noise words error!');
      throw err;
    }
  }

  /** Add document named by string name with specified content string
   *  contentText to this instance. Update index in this with all
   *  non-noise normalized words in contentText string.
   *  This operation should be idempotent.
   */ 
  async addContent(name, contentText) {
    //TODO
    //Load noise set from db first.
    const dbTableNoise = this.db.collection(this.noiseSet);
    try{
      const ret = await dbTableNoise.findOne({_id:1});
      this.noiseWordsSet = new Set(ret.tags);
      //console.log('noiseSet size >> %d', this.noiseWordsSet.size);
    }catch(err){
      console.log('');
    }
      

    //read original contentText
    //console.log(">>> %s", name);
    const dbTable = this.db.collection(this.contentTable);
    try {
      const ret = await dbTable.insertOne(
        {
          'name': name, 
          'content': contentText 
        });
    }catch (err) {
      if (isDuplicateError(err)) {
        console.log('dup error!');
      }else{
        throw err;
      }
    }
    // create main index in Map
    //{id: xxxx, word: xxxx, articles: [{name: xxx, info: [num, offset]},...]}
    
    if (!contentText.endsWith('\n')) contentText += '\n';
    const temp = this._wordsLow(contentText);
    for(let i=0; i<temp.length; i++){
      const [word, offset] = temp[i];
      let wordIndex = this.indexes.get(word);
      if (!wordIndex) this.indexes.set(word, wordIndex = new Map());
      let wordInfo = wordIndex.get(name);
      if (!wordInfo) wordIndex.set(name, wordInfo = [0, offset]);
      wordInfo[0]++; 
    }
    //console.log(this.indexes);

    // below part move to close(), it is much faster.
    /*
    if(this.flag === 1){
      const dbTable2 = this.db.collection(this.indexTable);
      try {
        const keyArr = this.indexes.keys();
        for(const key of keyArr){
          const articles = this.indexes.get(key);
          const artKeyArr = articles.keys();
        
        
          let arr = [];
          //console.log('>>>>>>>>>>');
          //console.log(artKeyArr);
          for(const akey of artKeyArr){
            const numAndOffset = articles.get(akey);
            const element = {name: akey, info: numAndOffset};
            arr.push(element);
          }
          await dbTable2.insertOne({
            word: key,    
            articles: arr  
          });
        }
      }catch (err) {
        if (isDuplicateError(err)) {
          console.log('dup error!');
        }else{
          throw err;
        }
      }
    }
    */


    //below part is update method
    /*
    const dbTable2 = this.db.collection(this.indexTable);
    try {
      const keyArr = this.indexes.keys();
      for(const key of keyArr){
        const articles = this.indexes.get(key);
        const artKeyArr = articles.keys();
        
        if(!this.indexes.has(key)){
          await dbTable2.insertOne({
            word: key,
            articles:[]
          });
        }
        for(const akey of artKeyArr){
          const numAndOffset = articles.get(akey);
          const element = {name: akey, info: numAndOffset};
          await dbTable2.updateOne({word: key}, {$addToSet: {articles: element}}, {upsert: true}); 
        }
      }
    }catch (err) {
      if (isDuplicateError(err)) {
        console.log('dup error!');
      }else{
        throw err;
      }
    }
    */
    this.flag = 1;
  }

  /** Return contents of document name.  If not found, throw an Error
   *  object with property code set to 'NOT_FOUND' and property
   *  message set to `doc ${name} not found`.
   */
  async docContent(name) {
    //TODO
    const dbTable = this.db.collection(this.contentTable);
    let ret = '';
    try{
      const temp = await dbTable.findOne({'name': name});
      ret = temp.content;
      //console.log(ret.content);
    }catch(err){
      console.log('doc %s not found', name);
    }
    return ret;
  }
  
  /** Given a list of normalized, non-noise words search terms, 
   *  return a list of Result's  which specify the matching documents.  
   *  Each Result object contains the following properties:
   *
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  The 
   *            lines must have the same relative order as in the source
   *            document.  Note that if a line contains multiple search 
   *            terms, then it will occur only once in lines.
   *
   *  The returned Result list must be sorted in non-ascending order
   *  by score.  Results which have the same score are sorted by the
   *  document name in lexicographical ascending order.
   *
   */
  async find(terms) {
    //TODO
    const docs = await this._findDocs(terms);
    const results = [];
    //console.log(docs);
    
    for (const [name, wordInfos] of docs.entries()) {
      const dbTable = this.db.collection(this.contentTable);
      let contents = '';
      try{
        contents = await dbTable.findOne({'name': name});
      }catch(err){
        console.log('doc %s not found', name);
      } 
      const score =
      wordInfos.reduce((acc, wordInfo) => acc + wordInfo[0], 0);
      const offsets = wordInfos.map(wordInfo => wordInfo[1]);
      results.push(new OffsetResult(name, score, offsets).result(contents.content));
    }
    results.sort(compareResults);
    
    return results;
  }

  /** Given a text string, return a ordered list of all completions of
   *  the last normalized word in text.  Returns [] if the last char
   *  in text is not alphabetic.
   */
  async complete(text) {
    //TODO
    await this._makeCompletions();
    if (!text.match(/[a-zA-Z]$/)) return [];
    let ans = [];
    try{
      const word = text.split(/\s+/).map(w=> normalize(w)).slice(-1)[0];
      ans = this.completions.get(word[0]).filter((w) => w.startsWith(word));
    }catch(err){
      //console.log('no completions'); 
    }
    return ans;
  }

  /** Add each word in this.indexes starting with character c to list
   *  this.completions[c].
   */

  async _makeCompletions() {
    const completions = new Map();
    const dbTable = this.db.collection(this.indexTable); 
    try{

      const temp = await dbTable.find({},{projection:{word:1,_id:0}}).toArray();
      //console.log(temp);
      //console.log(typeof(temp));
      for(const w of temp){
        //console.log(w.word); 
        const c = w.word[0];
        if (!completions.get(c)) completions.set(c, []);
        completions.get(c).push(w.word);
      }
    }catch(err){
      console.log('_makeCompletions error!!');
    }
    for (const [c, words] of completions) { words.sort(); }
    this.completions = completions;
  }


  //Add private methods as necessary
  async _findDocs(terms) {
    const docs = new Map();
    const dbTable = this.db.collection(this.indexTable);
    for(const term of terms){
      try{
        const ret = await dbTable.findOne({'word': term});
        for(const r of ret.articles){
          let docIndex = docs.get(r.name);
          if(!docIndex) docs.set(r.name, docIndex = []);
          docIndex.push(r.info);
        }
      }catch(err){
        //console.log('no results');
      }
    }
    return docs;
  }
} //class DocFinder

module.exports = DocFinder;

//Add module global functions, constants classes as necessary
//(inaccessible to the rest of the program).

//Used to prevent warning messages from mongodb.
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple utility class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */ 
class Result {
  constructor(name, score, lines) {
    this.name = name; this.score = score; this.lines = lines;
  }

  toString() { return `${this.name}: ${this.score}\n${this.lines}`; }
}

/** Compare result1 with result2: higher scores compare lower; if
 *  scores are equal, then lexicographically earlier names compare
 *  lower.
 */
function compareResults(result1, result2) {
  return (result2.score - result1.score) ||
    result1.name.localeCompare(result2.name);
}

/** Normalize word by stem'ing it, removing all non-alphabetic
 *  characters and converting to lowercase.
 */
function normalize(word) {
  return stem(word.toLowerCase()).replace(/[^a-z]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
  return word.replace(/\'s$/, '');
}


//--------self add------
function isDuplicateError(err) {
  return (err.code === 11000);
}

/** Like Result, except that instead of lines it contains a list of
 *  offsets at which the search terms occur within the document.
 */

class OffsetResult {
  constructor(name, score, offsets) {
    this.name = name; this.score = score; this.offsets = offsets;
  }
  /** Convert this to a Result by using this.offsets to extract
   *  lines from contents.
   */
  result(contents) {
    const starts = new Set();
    this.offsets.forEach(o => starts.add(contents.lastIndexOf('\n', o) + 1));
    let lines = '';
    for (const i of Array.from(starts).sort((a, b) => a-b)) {
      lines += contents.substring(i, contents.indexOf('\n', i) + 1);
    }
    return new Result(this.name, this.score, lines);
  }
}
