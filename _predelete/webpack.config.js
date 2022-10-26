const path = require('path');
const {TsconfigPathsPlugin} = require("tsconfig-paths-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const {merge} = require("webpack-merge")
const webpack = require("webpack")
var common = {
    entry: {
        app: './src/app.tsx'
    },
    output: {
        filename: 'sketchbook.min.js',
        library: 'Sketchbook',
        libraryTarget: 'umd',
        path: path.resolve(__dirname, "build")
    },
    resolve: {
        // alias: {
        //   cannon: path.resolve(__dirname, './src/lib/cannon/cannon.js')
        // },
        extensions: [ '.tsx', '.ts', '.js', '.jsx' ],
        plugins: [
            new TsconfigPathsPlugin()
        ]
    },
    module: {
        rules: [
        {
            test: /\.[tj]sx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.css$/,
            use: [
                { loader: 'style-loader', options: { injectType: 'singletonStyleTag' } },
                { loader: 'css-loader' },
            ]
        }
      ]
    },
    performance: {
        hints: false
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Sketchbook"
            //template: 'src/index.html'
        })
    ]
};


var dev = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        // progress: true,
        liveReload: false
    },
});

var production = merge(common, {
    mode: 'production',
    plugins: [
        new webpack.BannerPlugin({
          banner:
          `Sketchbook 0.4 (https://github.com/swift502/Sketchbook)\nBuilt on three.js (https://github.com/mrdoob/three.js) and cannon.js (https://github.com/schteppe/cannon.js)`,
        }),
    ]
});

module.exports = production