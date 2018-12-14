<!DOCTYPE html>
<html>
  <head>
    <title>Add Document</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Add Document</h1>
    <ul>
      {{#errors}}
        <li class="error">{{.}}</li>
      {{/errors}}
    </ul>
    <form action="{{{base}}}/add" method="POST" enctype="multipart/form-data">
      <label>
        <span class="label">Choose file:</span>
        <input id="file" name="file" type="file">
      </label>
      <br/>
      {{#addError}}
	<span class="error">{{addError}}</span><br/>
      {{/addError}}
      <input id="submit" name="submit" type="submit"
             value="add" class="control">
    </form>
    {{>footer}}
  </body>
</html>
