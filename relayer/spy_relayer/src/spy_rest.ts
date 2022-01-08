import { createClient } from "redis";
import axios from "axios";
import { connectToRedis } from "./spy_worker";
import * as helpers from "./helpers";
import { logger } from "./helpers";

export function init(runRest: boolean): boolean {
  if (!runRest) return true;
  if (!process.env.REST_PORT) return true;

  return true;
}

export async function run() {
  if (!process.env.REST_PORT) return;

  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  var restPort: number = parseInt(process.env.REST_PORT);

  app.listen(restPort, () =>
    logger.info("listening on REST port %d!", restPort)
  );

  (async () => {
    const rclient = await connectToRedis();

    app.get("/query/:chain_id/:emitter_address/:sequence", async (req, res) => {
      var key: helpers.StoreKey = {
        chain_id: parseInt(req.params.chain_id),
        emitter_address: req.params.emitter_address,
        sequence: parseInt(req.params.sequence),
      };

      await rclient.select(helpers.INCOMING);
      var result = await rclient.get(helpers.storeKeyToJson(key));
      if (result) {
        logger.info(
          "REST query of [" +
            helpers.storeKeyToJson(key) +
            "] found entry in incoming store, returning: %o",
          result
        );
      } else {
        await rclient.select(helpers.WORKING);
        var result = await rclient.get(helpers.storeKeyToJson(key));
        logger.info(
          "REST query of [" +
            helpers.storeKeyToJson(key) +
            "] looked for entry in incoming store, returning: %o",
          result
        );
      }

      res.json(result);
    });

    app.get("/", (req, res) =>
      res.json([
        "/query/<chain_id>/<emitter_address>/<sequence>",
        "/relayvaa/<vaaInBase64>",
        "/relayseq/<chainId>/<seqNum>",
        "/relaytid/<chainId>/<transId>",
      ])
    );
  })();
}
