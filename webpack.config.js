var debug = process.env.NODE_ENV !== "production";
var webpack = require('webpack');
var path = require('path');

module.exports = {
  context: path.join(__dirname, "public"),
  entry: "./js/client.js",
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 8080,
    historyApiFallback: true, // SPAの場合、必要
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        use: [{
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react', '@babel/preset-env']
          }
        }]
      },
      {
        test: /\.css$/, // CSSローダーの設定
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // 出力先を 'dist' ディレクトリに変更
    filename: "client.min.js",
    publicPath: '/' // 公開パスをルートに設定
  },
  plugins: debug ? [] : [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new (require('terser-webpack-plugin'))() // UglifyJsPluginの代わりにterser-webpack-pluginを使用
  ],
  optimization: {
    minimize: !debug,
    minimizer: [new (require('terser-webpack-plugin'))()],
  },
};
