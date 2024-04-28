// This include more packages, should cover all you need.

// Generated using webpack-cli https://github.com/webpack/webpack-cli
import path from 'path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import webpack from 'webpack'
import { config as configDotEnv } from 'dotenv'
import { fileURLToPath } from 'url'
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dotenv = configDotEnv({
  path: './.env'
})

const config = {
  // multiple entries
  entry: {
    bundle: './src/main.js',
    main: {
      import: './src/main.js',
      library: {
        type: 'global'
      }
    }
  },
  // dynamic output
  output: {
    globalObject: 'this',
    publicPath: '/dist/',
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  experiments: {
    outputModule: true
  },
  devServer: {
    open: true,
    host: 'localhost',
    client: {
      overlay: {
        warnings: false,
        errors: true
      }
    },
    historyApiFallback: {
      index: '/dist/index.html'
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(dotenv.parsed)
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html'
    }),
    new CleanWebpackPlugin({
      dangerouslyAllowCleanPatternsOutsideProject: true
    }),
    new NodePolyfillPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.(?:js|mjs|cjs)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }]
            ],
            plugins: ['@babel/plugin-proposal-class-properties']
          }
        }
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: 'minify-html-literals-loader'
          }
        ]
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(ts|tsx)$/i,
        loader: 'ts-loader',
        exclude: ['/node_modules/']
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        type: 'asset'
      }

      // Add your rules for custom modules here
      // Learn more about loaders from https://webpack.js.org/loaders/
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      fs: false,
      net: false,
      tls: false
      // 'crypto-browserify': require.resolve('crypto-browserify') // if you want to use this module also don't forget npm i crypto-browserify
    }
  }
}

export default config
