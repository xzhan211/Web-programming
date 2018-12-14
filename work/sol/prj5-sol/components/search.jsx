//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Search extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   */
  constructor(props) {
    super(props);
    this.state = {
      q: '',
      searchTerms: '',
      results: [],
      completions: [],
      error: '',
    };

    this.onChange = this.onChange.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
  }

  async onChange(event) {
    const q = event.target.value;
    this.setState({ q });
    try {
      this.setState({ completions: await this.props.app.ws.completions(q) });
    }
    catch (err) {
      this.setState({ error: err.message || err.toString() });
    }
  }

  async onBlur(event) {
    await this._doSearch();
  }

  async onSubmit(event) {
    event.preventDefault();
    await this._doSearch();
  }


  render() {
    const autoCompleteProps = {
      name: 'q',
      value: this.state.q,
      onBlur: this.onBlur,
    };
    const options =
      this.state.completions.map((c, i) => <option key={i}>{c}</option>);
    const form = (
      <form key="form" onSubmit={this.onSubmit}>
        <label>
          <span className="label">Search Terms:</span>
          <span className="control">
            <input id="q" name="q" value={this.state.q}
                   onChange={this.onChange} onBlur={this.onBlur}/>
            <br/>
          </span>
        </label>
      </form>
    );
    const results =
      this.state.results.map((result, i) => {
        return <Result app={this.props.app}
                       searchTerms={this.state.searchTerms}
                       result={result} key={i}/>;
      });
    return [
      form,
      <div key="result">{results}</div>,
      <span className="error">{this.state.error}</span>
    ];
  }

  async _doSearch() {
    const searchTerms = this.state.q.trim();
    let [ results, error ] = [ [], '' ];
    if (searchTerms) {
      try {
        const result = await this.props.app.ws.searchDocs(searchTerms);
        results = result.results || [];
        if (results.length === 0) {
          error = `No results for ${this.state.q}`;
        }
      }
      catch (err) {
        error = err.message || err.toString();
      }
    }
    this.setState({searchTerms, results, error});
  }

}

module.exports = Search;

class Result extends React.Component {

  constructor(props) {
    super(props);

    this.onClick = this.onClick.bind(this);
  }

  onClick(event) {
    event.preventDefault();
    this.props.app.setContentName(event.target.innerHTML);
  }

  render() {
    const {name, lines} = this.props.result;
    const emLines = emphasizeLines(this.props.searchTerms, lines);
    return (
      <div className="result">
        <a className="result-name" href={name} onClick={this.onClick}>
          {name}
        </a>
        <br/>
        <p>
          {emLines}
        </p>
      </div>
    );
    return "";
  }

}

function emphasizeLines(searchTerms, lines) {
  const words = new Set(searchTerms.toLowerCase().split(/\W+/));
  const emLines = [];
  let key = 0;
  lines.forEach(line => {
    const regex = /(\W+)|(\w+)/g;
    let match;
    while (match = regex.exec(line)) {
      const text = match[0];
      const isSearch = match[2] && words.has(text.toLowerCase());
      if (isSearch) {
        const emText = (
          <span key={key} className="search-term">
            {text}
          </span>
        );
        key++;
        emLines.push(emText);
      }
      else {
        emLines.push(text);
      }
    }
    emLines.push(<br key={key}/>);
    key++;
  });
  return emLines;
}
