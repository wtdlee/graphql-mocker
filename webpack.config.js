const path = require('path');

module.exports = (env, argv) => {
  const mode = argv.mode || 'development';
  const isDev = mode === 'development';

  return {
    mode,
    devtool: isDev ? 'inline-source-map' : 'source-map',

    entry: {
      background: './src/app/background.ts',
      popup: './src/ui/popup.tsx',
      content: './src/app/content.ts',
      appHook: './src/app/appHook.ts',
    },

    output: {
      path: path.resolve(__dirname, 'dist/js'),
      filename: '[name].js',
      clean: true,
    },

    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {
            transpileOnly: true,
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },

    optimization: {
      minimize: !isDev,
    },

    performance: {
      hints: isDev ? false : 'warning',
      maxAssetSize: 512000,
      maxEntrypointSize: 512000,
    },
  };
};
