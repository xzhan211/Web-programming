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
    //@TODO
    this.state = {value: ''};
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
  }

  handleSubmit(event) {
    alert('A name was submitted: ' + this.state.value);
    event.preventDefault();
  }


  //@TODO


  render() {
    //@TODO
    return (
    <form onSubmit={this.handleSubmit}>
        <label>
          <span className="label">Search Terms:</span>
          <span className="control">
            <input id="q" name="q" value={this.state.value} onChange={this.handleChange} />
            </span>
        </label>
    </form>


    );
  }

}

module.exports = Search;
