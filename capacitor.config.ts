const config = {
  appId: 'com.xludo.game',
  appName: 'X Ludo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1A0D07',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1A0D07',
      showSpinner: false,
    },
  },
};

export default config;
