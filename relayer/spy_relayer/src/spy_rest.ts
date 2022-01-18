import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import { Request, Response } from "express";
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

  const restPort: number = parseInt(process.env.REST_PORT);

  app.listen(restPort, () =>
    logger.info("listening on REST port %d!", restPort)
  );

  (async () => {
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

        const [vc] = helpers.validateVaa(Buffer.from(parsedVAA.payload));
        if (vc === "success") {
          //TODO see if it has already been redeemed
          logger.info(
            "storing rest request for key [" + storeKeyStr + "] in redis"
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
      res.json(["/relayvaa/<vaaInBase64>"])
    );
  })();
}
