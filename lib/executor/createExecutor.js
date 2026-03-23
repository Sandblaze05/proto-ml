const GraphExecutor = require('./graphExecutor');
const runtimeFactories = require('../runtimeFactories');

function createDefaultExecutor() {
  return new GraphExecutor(runtimeFactories);
}

module.exports = { createDefaultExecutor };
