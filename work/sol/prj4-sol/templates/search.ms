<!DOCTYPE html>
<html>
  <head>
    <title>Documents Collections Search</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Documents Collection Search</h1>
    <ul>
      {{#errors}}
        <li class="error">{{.}}</li>
      {{/errors}}
    </ul>
    <form method="GET" action="{{{base}}}/search.html">
      <p>
        Please fill in one or more search terms in the field below:
      </p>
      <label>
        <span class="label">Search Terms:</span>
          <input id="query" name="q" value="{{q}}">
	</label>
	<br/>
	{{#searchError}}
	  <span class="error">{{searchError}}</span><br/>
	{{/searchError}}
      </label>
      <input id="submit" name="submit" type="submit"
             value="search" class="control">
    </form>
    {{#results.length}}
      <h2>Search Results</h2>
      {{#results}}
        <p class="result">
	  <a class="doc-name" href="{{href}}">{{name}}</a><br>
	  {{#lines}}{{{.}}}<br>{{/lines}}
	</p>
      {{/results}}
      {{#previous}}
        <a id="previous" href="{{previous}}">Previous</a>
      {{/previous}}
      {{#next}}<a id="next" href="{{next}}">Next</a>{{/next}}
    {{/results.length}}
    {{>footer}}
  </body>
</html>
