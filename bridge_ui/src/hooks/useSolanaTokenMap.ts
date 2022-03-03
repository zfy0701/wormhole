import { Dispatch } from "@reduxjs/toolkit";
import { ENV, TokenInfo, TokenListProvider } from "@solana/spl-token-registry";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DataWrapper } from "../store/helpers";
import { selectSolanaTokenMap } from "../store/selectors";
import {
  errorSolanaTokenMap,
  fetchSolanaTokenMap,
  receiveSolanaTokenMap,
} from "../store/tokenSlice";
import { CLUSTER } from "../utils/consts";
import {TokenExtensions} from "@solana/spl-token-registry/src/lib/tokenlist";
import {CHAIN_ID_SOLANA} from "@certusone/wormhole-sdk";

const environment = CLUSTER === "testnet" ? ENV.Testnet : ENV.MainnetBeta;

const useSolanaTokenMap = (): DataWrapper<TokenInfo[]> => {
  const tokenMap = useSelector(selectSolanaTokenMap);
  const dispatch = useDispatch();
  const shouldFire =
    tokenMap.data === undefined ||
    (tokenMap.data === null && !tokenMap.isFetching);

  useEffect(() => {
    if (shouldFire) {
      getSolanaTokenMap(dispatch);
    }
  }, [dispatch, shouldFire]);

  return tokenMap;
};

const getSolanaTokenMap = (dispatch: Dispatch) => {
  dispatch(fetchSolanaTokenMap());

  new TokenListProvider().resolve().then(
    (tokens) => {
      var tokenList = tokens.filterByChainId(environment).getList();
      var i =  {
        chainId: CHAIN_ID_SOLANA,
        address: "52Y4nFRc8cH6YsKWwcYRj3HjApyU9EKGdwJGR9HdFXBJ",
        name: "Music",
        decimals: 10,
        symbol: "MUL"
        // readonly logoURI?: string;
        // readonly tags?: string[];
        // readonly extensions?: TokenExtensions;
      }
      tokenList.push(i)

      i =  {
        chainId: CHAIN_ID_SOLANA,
        address: "5GYUUQwZzPKK3Thwn5jpbTBPX6cgBTPYzN1Q9EvXWkBq",
        name: "WETH",
        decimals: 10,
        symbol: "WETH"
        // readonly logoURI?: string;
        // readonly tags?: string[];
        // readonly extensions?: TokenExtensions;
      }
      tokenList.push(i)

      dispatch(receiveSolanaTokenMap(tokenList));
    },
    (error) => {
      console.error(error);
      dispatch(errorSolanaTokenMap("Failed to retrieve the Solana token map."));
    }
  );
};

export default useSolanaTokenMap;
