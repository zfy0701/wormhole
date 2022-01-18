import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as spy_listen from "./spy_listen";
import * as spy_worker from "./spy_worker";
import * as spy_rest from "./spy_rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";

setDefaultWasm("node");

var configFile: string = process.env.SPY_RELAY_CONFIG
  ? process.env.SPY_RELAY_CONFIG
  : ".env.sample";

console.log("loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

// Set up the logger.
helpers.initLogger();
logger.info("spy_relay using config file [" + configFile + "]");

// Set up the Prometheus metrics counter
var promPort = 8081;
if (process.env.PROM_PORT) {
  promPort = parseInt(process.env.PROM_PORT);
}
logger.info("prometheus client listening on port " + promPort);
const promClient = new PromHelper("spy_relay", promPort);

// Load the relay config data.
var runListen: boolean = true;
var runWorker: boolean = true;
var runRest: boolean = true;
var foundOne: boolean = false;

var error: boolean = false;
for (let idx = 0; idx < process.argv.length; ++idx) {
  if (process.argv[idx] === "--listen_only") {
    if (foundOne) {
      logger.error('May only specify one of "--listen_only" or "--relay_only"');
      error = true;
      break;
    }

    logger.info("spy_relay is running in listen only mode");
    runWorker = false;
    foundOne = true;
  }

  if (process.argv[idx] === "--relay_only") {
    if (foundOne) {
      logger.error(
        'May only specify one of "--listen_only", "--relay_only" or "--rest_only"'
      );
      error = true;
      break;
    }

    logger.info("spy_relay is running in relay only mode");
    runListen = false;
    runRest = false;
    foundOne = true;
  }
}

if (
  !error &&
  helpers.init(runListen || runRest) &&
  spy_listen.init(runListen) &&
  spy_worker.init(runWorker) &&
  spy_rest.init(runRest)
) {
  if (runListen) spy_listen.run(promClient);
  if (runWorker) spy_worker.run(promClient);
  if (runRest) spy_rest.run();

  if (process.env.READINESS_PORT) {
    const readinessPort: number = parseInt(process.env.READINESS_PORT);
    const Net = require("net");
    const readinessServer = new Net.Server();
    readinessServer.listen(readinessPort, function () {
      logger.info("listening for readiness requests on port " + readinessPort);
    });

    readinessServer.on("connection", function (socket: any) {
      //logger.debug("readiness connection");
    });
  }
}
