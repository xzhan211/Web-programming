<!DOCTYPE html>
<html>
  <head>
    <title>Documents Collections Search</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Documents Collection Search</h1>
    <ul>
    </ul>
    <form method="GET" action="{{{base}}}/search.html">
        {{#errorsU}}
            <ul>
                <li class="error">{{errorsU}}</li>
            </ul>
        {{/errorsU}}
        <p>
	        Please fill in one or more search terms in the field below:
        </p>
	    <label>
            <span class="label">Search Terms:</span>
            <input id="query" name="q" value="{{value}}">
        </label>
        <br/>

        {{#errorsD}}
            <span class="error">{{errorsD}}</span><br/>
        {{/errorsD}}

        <input id="submit" name="submit" type="submit" value="search"
        class="control">
    </form>


    {{#contents}}
        <h2>Search Results</h2>
    {{/contents}}

    {{#contents.results}}
        <p class="result">
        <a class="doc-name" href="http://localhost:4444/docs/{{name}}">{{name}}</a><br>
        {{#lines}}
            {{{.}}}<br>
        {{/lines}}
    {{/contents.results}}
<br>
    {{#previous}}
        <a id="previous" href="{{previous}}">Previous</a>
    {{/previous}}

    {{#next}}
        <a id="next" href="{{next}}">Next</a>
    {{/next}}
    {{>footer}}
  </body>
</html>
