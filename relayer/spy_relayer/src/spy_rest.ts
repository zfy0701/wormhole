import { createClient } from "redis";
import axios from "axios";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
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
    const rclient = await helpers.connectToRedis();

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

    app.get("/relayvaa/:vaa", async (req, res) => {
      try {
        var vaaBuf = Buffer.from(req.params.vaa, "base64");
        const { parse_vaa } = await importCoreWasm();
        const parsedVAA = parse_vaa(vaaBuf);
        var storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
        var storeKeyStr = helpers.storeKeyToJson(storeKey);
        var storePayload = helpers.initPayloadWithVAA(vaaBuf);

        logger.info(
          "received a rest request to relay vaa: [" +
            vaaBuf.toString("hex") +
            "]"
        );

        var vc;
        var fee: bigint;

        [vc, fee] = helpers.validateVaa(Buffer.from(parsedVAA.payload));
        if (vc === "success") {
          logger.info(
            "storing rest reuest for key [" + storeKeyStr + "] in redis"
          );
          await helpers.storeInRedis(
            storeKeyStr,
            helpers.storePayloadToJson(storePayload)
          );

          res.status(200).json({ message: "Scheduled" });
        } else {
          logger.info(
            "ignoring rest reuest for key [" + storeKeyStr + "]: " + vc
          );

          res.status(400).json({ message: vc });
        }
      } catch (e) {
        logger.error(
          "failed to process rest relay of vaa request, error: %o",
          e
        );
        logger.error("offending request: %o", req);
        res.status(400).json({ message: "Request failed" });
      }
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
