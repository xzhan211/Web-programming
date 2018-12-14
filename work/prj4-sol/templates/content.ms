<!DOCTYPE html>
<html>
  <head>
    <title>{{name}}</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    {{#text}}
        <h1 class="doc-name">{{name}}</h1>
        <ul>
        </ul>
        <pre class="content">{{content}}</pre>
    {{/text}}
    {{>footer}}
  </body>
</html>
