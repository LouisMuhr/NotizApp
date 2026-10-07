// package.json ist die einzige Versionsquelle (Settings-Screen liest sie ebenfalls).
// Alles andere kommt aus app.json.
module.exports = ({ config }) => ({
  ...config,
  version: require('./package.json').version,
});
