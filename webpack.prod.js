import { merge } from 'webpack-merge'
import common from './webpack.common.js'
import WorkboxWebpackPlugin from 'workbox-webpack-plugin'

export default merge(common, {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new WorkboxWebpackPlugin.GenerateSW()
  ]
})
