import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as spy_listen from "./spy_listen";
import * as spy_worker from "./spy_worker";
import * as spy_rest from "./spy_rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { loadChainConfig } from "./configureEnv";

setDefaultWasm("node");

var configFile: string;
if (process.env.SPY_RELAY_CONFIG) {
  configFile = process.env.SPY_RELAY_CONFIG;
} else if (process.env.NODE_ENV === "tilt") {
  configFile = ".env.tilt";
} else {
  configFile = ".env.sample";
}

console.log(
  "node environment is [%s], loading config file [%s]",
  process.env.NODE_ENV,
  configFile
);
require("dotenv").config({ path: configFile });

// Set up the logger.
helpers.initLogger();
logger.info(
  "spy_relay running in node environment [" +
    process.env.NODE_ENV +
    "] using config file [" +
    configFile +
    "]"
);

// Load the relay config data.
if (loadChainConfig()) {
  var runListen: boolean = true;
  var runWorker: boolean = true;
  var runRest: boolean = true;
  var foundOne: boolean = false;

  var error: boolean = false;
  for (let idx = 0; idx < process.argv.length; ++idx) {
    if (process.argv[idx] === "--listen_only") {
      if (foundOne) {
        logger.error(
          'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
        );
        error = true;
        break;
      }
      runWorker = false;
      runRest = false;
      foundOne = true;
    }

    if (process.argv[idx] === "--worker_only") {
      if (foundOne) {
        logger.error(
          'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
        );
        error = true;
        break;
      }
      runListen = false;
      runRest = false;
      foundOne = true;
    }

    if (process.argv[idx] === "--rest_only") {
      if (foundOne) {
        logger.error(
          'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
        );
        error = true;
        break;
      }
      runListen = false;
      runWorker = false;
      foundOne = true;
    }
  }

  if (
    !error &&
    spy_listen.init(runListen) &&
    spy_worker.init(runWorker) &&
    spy_rest.init(runRest)
  ) {
    if (runListen) spy_listen.run();
    if (runWorker) spy_worker.run();
    if (runRest) spy_rest.run();
  }
}
