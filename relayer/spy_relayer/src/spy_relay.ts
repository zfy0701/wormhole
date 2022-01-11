import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as spy_listen from "./spy_listen";
import * as spy_worker from "./spy_worker";
import * as spy_rest from "./spy_rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";

setDefaultWasm("node");

var configFile: string = process.env.SPY_RELAY_CONFIG
  ? process.env.SPY_RELAY_CONFIG
  : ".env.sample";

console.log("loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

// Set up the logger.
helpers.initLogger();
logger.info("spy_relay using config file [" + configFile + "]");

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
  helpers.init() &&
  spy_listen.init(runListen) &&
  spy_worker.init(runWorker) &&
  spy_rest.init(runRest)
) {
  if (runListen) spy_listen.run();
  if (runWorker) spy_worker.run();
  if (runRest) spy_rest.run();
}
