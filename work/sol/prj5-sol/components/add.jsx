//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Add extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   */
  constructor(props) {
    super(props);
    this.setFile = this.setFile.bind(this);
    this.state = { error: '' };
  }

  async setFile(event) {
    const file = event.target.files[0];
    if (file && file.name) {
      try {
        const content = await readFile(file);
        const name = file.name.replace(/.txt$/, '');
        await this.props.app.ws.addContent(name, content);
        this.setState({ error: '' });
        this.props.app.setContentName(name);
      }
      catch (err) {
        this.setState({error: err.message || err.toString()});
      }
    }
  }

  render() {
    return (
      <form>
        <label className="label">
          Choose File:
          <input className="control" type="file" onChange={this.setFile}/>
        </label>
        <div className="error">{this.state.error}</div>
      </form>
    );
  }

}

module.exports = Add;

/** Return contents of file (of type File) read from user's computer.
 *  The file argument is a file object corresponding to a <input
 *  type="file"/>
 */
async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>  resolve(reader.result);
    reader.readAsText(file);
  });
}
