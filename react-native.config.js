// react-native-receive-sharing-intent wird nur auf Android genutzt (ShareHandler).
// Auf iOS bräuchte es eine eigene Share Extension + URL-Scheme; ohne das bleibt der Pod draußen.
module.exports = {
  dependencies: {
    'react-native-receive-sharing-intent': {
      platforms: { ios: null },
    },
  },
};
