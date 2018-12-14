const {inspect} = require('util'); //for debugging

'use strict';

class DocFinder {
  /** Constructor for instance of DocFinder. */
  constructor() {
    //@TODO
    this.noiseWordsSet = new Set();
    this.articlesMap = new Map(); // {article name : original string content}
    this.allMap = new Map(); // {article : {words: {cnt: xxx, offset: xxx}}
    this.allWordsSet = new Set(); // all words from articles
    this.linesMap = new Map(); // {artile: {offset: line content}}
  }

  /** Return array of non-noise normalized words from string content.
   *  Non-noise means it is not a word in the noiseWords which have
   *  been added to this object.  Normalized means that words are
   *  lower-cased, have been stemmed and all non-alphabetic characters
   *  matching regex [^a-z] have been removed.
   */
  words(content) {
    //@TODO
    return this._wordsLow(content).map(pair => pair[0]);// pair[1]: offset(useless here)
  }

  /** Add all normalized words in noiseWords string to this as
   *  noise words.
   */
  addNoiseWords(noiseWords) {
    //@TODO
    this.noiseWordsSet = noiseWords.split('\n');
  }

  _wordsLow(content){
    let matchItem;
    var array = [];
    while (matchItem = WORD_REGEX.exec(content)) {//spilt word by white space
      const [word, offset] = [matchItem[0], matchItem.index];
      array.push([word, offset]);
    }
    return array;
  }

  /** Add document named by string name with specified content to this
   *  instance. Update index in this with all non-noise normalized
   *  words in content string.
   */
  addContent(name, content) {
    //@TODO
    this.articlesMap.set(name, content);// read original article data, dirty.
    this._getLineInfo(name);
    this._getArticleInfo(name);//
  }

  // create Map {article name: {word: [cnt, offset]}}
  _getArticleInfo(name){
    var str1 = this.articlesMap.get(name);
    var wordCountMap = new Map();
    var wordOffsetMap = new Map();
    var array = [];      
    let matchItem;
    while(matchItem = WORD_REGEX.exec(str1)){
      const [word, offset] = [normalize(matchItem[0]), matchItem.index];
      if(this.noiseWordsSet.includes(word))
        continue;
      else if(wordCountMap.has(word))
        wordCountMap.set(word, wordCountMap.get(word)+1);
      else{
        wordCountMap.set(word, 1);
        wordOffsetMap.set(word, offset); 
      }
      this.allWordsSet.add(word);//using for completion function
    }
      
    for(var word of wordOffsetMap.keys()){
      //test
      //console.log(`>> ${word} ::: ${wordCountMap.get(word)} ::: ${wordOffsetMap.get(word)}`);
      const [key, value] =
        [word, [wordCountMap.get(word), wordOffsetMap.get(word)]];
      array.push([key, value]); 
    }
    const tempMap = new Map(array);
    this.allMap.set(name, tempMap);
  }


  // create Map {article name : {offset: {line: content}}
  _getLineInfo(content){
    var str = this.articlesMap.get(content);// original dirty data
    var linesArray = str.split('\n');
    //console.log('length : ', linesArray.length);
    var regex = new RegExp('\r|\n', 'g');
    var array;
    var pairLine = [];
    var i = 0;
    while((array = regex.exec(str)) !== null){
      //console.log('>>> ', array.index);
      const [key, value] = [array.index, linesArray[i++]];
      pairLine.push([key, value]);
    }
    const tempMap = new Map(pairLine);// relation between pair and object
    this.linesMap.set(content, tempMap);
  }

  /** Given a list of normalized, non-noise words search terms,
   *  return a list of Result's  which specify the matching documents.
   *  Each Result object contains the following properties:
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  Note
   *            that if a line contains multiple search terms, then it will
   *            occur only once in lines.
   *  The Result's list must be sorted in non-ascending order by score.
   *  Results which have the same score are sorted by the document name
   *  in lexicographical ascending order.
   *
   */
  find(terms) {
    //@TODO
    var ansList = [];
    var originalNormilizedWords = terms.map(x => normalize(x));
    var tempArray = [];
    var normalizedWordArray = [];  
    for(var existWord of originalNormilizedWords){
      if(this.allWordsSet.has(existWord))
        normalizedWordArray.push(existWord);
    }//remove the no-exist words
    //console.log('>>>>>>>>>> ', normalizedWordArray);//debug, available words

    for(const sname of this.allMap.keys()){ //key is article name
      var sumScore = 0;
      tempArray = []; 
      for(const word of normalizedWordArray){
        if(this.allMap.get(sname).has(word)){
          var scoreAndOffset = this.allMap.get(sname).get(word);
          var sscore = scoreAndOffset[0];
          var offset = scoreAndOffset[1];
          sumScore += sscore;
          tempArray.push(offset);
        }
      }// use search words in each article
      tempArray = tempArray.sort(function(a,b) {return a-b});//sort the offset, good for lines display.
      var linesSum = '';
      var offSetLine = new Set();
      offSetLine.clear(); 
      for(const os of tempArray){
        var singleLine =  '';
        for(const osl of this.linesMap.get(sname).keys()){
          if(os < osl){
            if(!offSetLine.has(osl)){
              singleLine = this.linesMap.get(sname).get(osl);
              offSetLine.add(osl); 
              linesSum = linesSum + singleLine + '\n';//combine lines together for display.
              singleLine = '';
            }
            break;
          }
        }
      }
      if(sumScore > 0){ 
        ansList.push(
          /*
          {
            name: sname,
            score: sumScore,
            lines: linesSum
          }
          */ //same function with Result class, just for fun..
          new Result(sname, sumScore, linesSum)
        );
      }
    }

    /*
    ansList.sort(function(a, b){
      var numA = Number(a.score);
      var numB = Number(b.score);
      if(numA > numB)
        return -1;
      else if(numA < numB)
        return 1;
      else if(numA === numB){
        if(a.name < b.name)
          return -1;
        else if(a.name > b.name)
          return 1;
      }
    });
    */ //same function with compareResults, code by myself...for fun...
     
    ansList.sort(compareResults); 
    
    return ansList;
  }

  /** Given a text string, return a ordered list of all completions of
   *  the last word in text.  Returns [] if the last char in text is
   *  not alphabetic.
   */
  complete(text) {
    //@TODO
    var res = [];
    var goodText = normalize(text);
    for(let item of this.allWordsSet.values()){
      if(item.match(goodText))
        res.push(item);
    }
    return res.sort();
  }


} //class DocFinder

module.exports = DocFinder;

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple class which packages together the result for a
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


