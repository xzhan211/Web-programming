//-*- mode: rjsx-mode;

'use strict';

const React = require('react');

class Content extends React.Component {

  /** called with properties:
   *  app: An instance of the overall app.  Note that props.app.ws
   *       will return an instance of the web services wrapper and
   *       props.app.setContentName(name) will set name of document
   *       in content tab to name and switch to content tab.
   *  name:Name of document to be displayed.
   */
  constructor(props) {
    super(props);
    this.state = { content: '' };
  }

  async componentDidMount() {
    await this._fetchContent();
  }

  async componentDidUpdate(prevProps) {
    if (this.props.name !== prevProps.name) {
      await this._fetchContent();
    }
  }

  render() {
    return (
      <section>
        <h1>{this.props.name}</h1>
        {this.state.content}
      </section>
    );
  }

  async _fetchContent() {
    let [ name, content ] = [ this.props.name, '' ];
    if (name) {
      content = await getContent(this.props.app.ws, name);
    }
    this.setState({content});
  }

}

module.exports = Content;

async function getContent(ws, name) {
  try {
    const content = await ws.getContent(name);
    return <pre>{content.content}</pre>;
  }
  catch (err) {
    return <span className="error">{err.message || err.toString()}</span>
  }
}
