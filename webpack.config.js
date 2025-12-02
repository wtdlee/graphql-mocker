const path = require("path");

module.exports = {
  mode: "development",
  devtool: "inline-source-map",

  entry: {
    background: "./src/app/background.ts",
    popup: "./src/ui/popup.tsx",
    content: "./src/app/content.ts",
    appHook: "./src/app/appHook.ts",
  },

  output: {
    path: path.resolve(__dirname, "dist/js"),
    filename: "[name].js",
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },

  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
};
