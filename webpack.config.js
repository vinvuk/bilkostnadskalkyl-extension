const path = require('path');
const webpack = require('webpack');
const webDestination = process.env.BKK_WEB_CALCULATOR_URL || 'https://dinbilkostnad.se/bilkostnad/billigaste-bilen';
const webUrl = new URL(webDestination);
if (webUrl.protocol !== 'https:' || (webUrl.hostname !== 'dinbilkostnad.se' && !webUrl.hostname.endsWith('.vercel.app')) || webUrl.pathname !== '/bilkostnad/billigaste-bilen' || webUrl.search || webUrl.hash) throw new Error('Invalid web calculator destination');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    'content/index': './src/content/index.ts',
    'background/background': './src/background/background.ts',
    'panel/panel': './src/panel/panel.ts',
    'popup/popup': './src/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, process.env.BKK_WEB_CALCULATOR_URL ? 'dist-handoff-test' : 'dist'),
    filename: '[name].js',
    clean: true,
    publicPath: '/',
    scriptType: 'text/javascript',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new webpack.DefinePlugin({ __WEB_CALCULATOR_URL__: JSON.stringify(webDestination) }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/overlay/overlay.css', to: 'overlay/overlay.css' },
        { from: 'src/panel/panel.css', to: 'panel/panel.css' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' },
        { from: 'assets', to: 'assets' },
      ],
    }),
  ],
  devtool: 'source-map',
};
