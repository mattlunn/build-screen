## Overview

 - The `client` project is a React frontend, created using the [`create-react-app`](https://github.com/facebookincubator/create-react-app) tool.
 - The `server` project is a Node application, using `express`.
 
## Setup

 - Clone the repository to your local machine
 - Copy `server/config-sample.json` to `server/config.json`, and edit it as appropriate. 
 - Change the `proxy` port within `client/package.json` to match the `webPort` set in `config.json`.

## Running the App

### Running as Dev
 - Run `node index` from within the `server` directory to start the server.
 - Run `npm run start` from within the `client` directory to start the front end. It should automatically open up a browser window, and "hot reload" should be enabled when editing any of the React files.

### Running in Prod
 - Run `npm run build` from within the `client` directory. This will produce the built & minified CSS and JS files within `client/build`.
 - Run `node index` from within the `server` directory to start the server.
 
Pass a comma separated list of projects as a `projects` query string parameter. The format of each project should be "TFS_ID:PROJECT_NAME", where "TFS_ID" is the ID of the TFS instance defined in `config.json` and "PROJECT_NAME" is the name (or GUID) of the TFS project. You can also customise the refresh period by passing a `refresh` query string parameter (in seconds; default is 60). E.g, if I am running on port 3333;
 
     http://localhost:3333/?projects=104610:A,0b064f:B,104610:C&refresh=120
     
... would show the build status of projects A, B and C, and refresh the statuses every 2 minutes.

## Known Issue

Files in the `common` folder are not currently transpiled by Babel. This is because the `include` property of the Babel loader, located within `config/webpack.config.dev.js` of the `react-scripts` node module (part of the `create-react-app` setup) only references the `client/src` folder. This basically means the app will not work in IE. Currently, the easiest fix is to manually modify `client/node_modules/react-scripts/config/webpack.config.(dev|prod).js`, and add `require('path').resolve(__dirname + '\\..\\..\\..\\..\\common')` to the `include` property of the "Process JS with Babel" step). You may also need to clear `client\node_modules\.cache\babel-loader`. A long term solution would be to either a) bail out of the `create-web-app` environment and edit the config property properly. b) keep the `common` files ES2015 compliant. c) duplicate the files within `client/src` and `server`.
