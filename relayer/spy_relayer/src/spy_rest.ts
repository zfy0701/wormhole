import { createClient } from "redis";
import axios from "axios";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { Request, Response } from "express";

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

  const restPort: number = parseInt(process.env.REST_PORT);

  app.listen(restPort, () =>
    logger.info("listening on REST port %d!", restPort)
  );

  (async () => {
    const rclient = await helpers.connectToRedis();

    app.get(
      "/query/:chain_id/:emitter_address/:sequence",
      async (req: Request, res: Response) => {
        const key: helpers.StoreKey = {
          chain_id: parseInt(req.params.chain_id),
          emitter_address: req.params.emitter_address,
          sequence: parseInt(req.params.sequence),
        };
        //TODO better handle rclient being unavailable & ensure non-null.
        if (!rclient) {
          res.status(500);
          return;
        }

        await rclient.select(helpers.INCOMING);
        let result = await rclient.get(helpers.storeKeyToJson(key));
        if (result) {
          logger.info(
            "REST query of [" +
              helpers.storeKeyToJson(key) +
              "] found entry in incoming store, returning: %o",
            result
          );
        } else {
          await rclient.select(helpers.WORKING);
          result = await rclient.get(helpers.storeKeyToJson(key));
          logger.info(
            "REST query of [" +
              helpers.storeKeyToJson(key) +
              "] looked for entry in incoming store, returning: %o",
            result
          );
        }

        res.json(result);
      }
    );

    app.get("/relayvaa/:vaa", async (req: Request, res: Response) => {
      try {
        const vaaBuf = Buffer.from(req.params.vaa, "base64");
        const { parse_vaa } = await importCoreWasm();
        const parsedVAA = parse_vaa(vaaBuf);
        const storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
        const storeKeyStr = helpers.storeKeyToJson(storeKey);
        const storePayload = helpers.initPayloadWithVAA(vaaBuf);

        logger.info(
          "received a rest request to relay vaa: [" +
            vaaBuf.toString("hex") +
            "]"
        );

        const [vc, fee] = helpers.validateVaa(Buffer.from(parsedVAA.payload));
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

    app.get("/", (req: Request, res: Response) =>
      res.json([
        "/query/<chain_id>/<emitter_address>/<sequence>",
        "/relayvaa/<vaaInBase64>",
        "/relayseq/<chainId>/<seqNum>",
        "/relaytid/<chainId>/<transId>",
      ])
    );
  })();
}
