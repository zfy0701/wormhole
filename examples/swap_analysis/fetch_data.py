import re
import sys
import json
import argparse
import subprocess 
import pandas as pd 
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport


def read_query_cfg(cfg, exchange):
    with open(cfg) as cfg_data:
        query_cfg = json.load(cfg_data)
        return query_cfg[exchange]


def read_pool_cfg(cfg):
    with open(cfg) as cfg_data:
        pool_cfg = json.load(cfg_data)
        return pool_cfg['pools']


def response_to_df(response, query_type, name_map):
    """Converts query response to a dataframe"""
    try:
        df = pd.DataFrame(response[query_type])
        df["date"] = pd.to_datetime(df['date']*1000000000)
        df["date"] = df["date"].dt.date.astype(str).str.replace('-', '')
        df.rename(
            mapper=name_map, 
            axis=1,
            inplace=True,
        )
        # reorder column names before returning 
        return df[["date", "tvlUSD", "volumeUSD"]]
    except Exception as e:
        print(e)
        return []


def fetch_daily_pool_data(
    pool_addr, 
    daily_query, 
    query_type, 
    name_map
):
    """Fetches pool data for current day by pool_addr from subgraph"""
    # update and execute the query
    query = daily_query % (f'"{pool_addr}"')

    try:
        response = client.execute(gql(query))
    except Exception as e:
        # catch a query exception and bail 
        print(e)
        return []
    
    # parse response and convert to dataframe
    response_df = response_to_df(response, QUERY_TYPE, name_map)
    return response_df


def parse_slippage_string(output):
    """Parses and converts slippage statistics to dataframe"""
    # find each key/value pair by splitting on new line
    info_pair = output.split("\n")
    
    # create a dictionary of key/value pair 
    info_dict = {}

    for pair in info_pair:
        pair_ = pair.split('=')
        if len(pair_) == 2:
            key, value = pair_
            # remove percentage signs from data
            if '%' in value:
                value = value.replace('%', '')

            # could have multiple slippage trials
            # check to see if key exists already
            if key not in info_dict.keys():
                info_dict[key] = value
            else:
                info_dict[key+'2'] = value

    return pd.DataFrame([info_dict])


def fetch_pool_slippage_data(
    pool_addr, 
    swap_token_addr, 
    slippage_args, 
    script_name
):
    """Calls exchange SDK script for slippage statistics"""
    args = [
        "node", 
        script_name, 
        "-p", pool_addr,
        "-i", swap_token_addr,
        "-s", slippage_args
    ]

    # call js script with subprocess
    response = subprocess.run(args, stdout=subprocess.PIPE)
    output = response.stdout.decode("utf-8")

    if len(output) and "Error" not in output: 
        # parse output and convert to dataframe
        return parse_slippage_string(output)
    
    return []


def read_args():
    """Parses user defined arguments"""
    # define arguments 
    parser = argparse.ArgumentParser()
    parser.add_argument("--cfg", help="Path to query CFG")
    parser.add_argument("--exchange", help="Target Exchange for data capture")
    args = parser.parse_args()
    return args


def write_data_to_table(table):
    """Writes data to Bigtable db"""
    raise NotImplementedError


# read in args
args = read_args()
CFG = args.cfg
EXCHANGE = args.exchange

# read in cfg with query information
query_cfg = read_query_cfg(CFG, EXCHANGE)

# variable creation from CFG
STATS_SCRIPT = query_cfg["statsScript"]
POOL_CFG = query_cfg["poolCFG"]
GRAPH_ENDPOINT = query_cfg["endPoint"]
QUERY_TYPE = query_cfg["queryType"]
DAILY_QUERY = query_cfg["dailyQuery"]
NAME_MAP = query_cfg["fieldNameMap"]
DATA_TYPE = query_cfg["dataType"]
HEADERS = query_cfg["headers"]

# read in pool data
pool_cfg = read_pool_cfg(POOL_CFG)

# connect to subgraph endpoint 
sample_transport = RequestsHTTPTransport(
    url=GRAPH_ENDPOINT,
    headers=HEADERS,
    verify=True,
    retries=3
)

client = Client(
    transport=sample_transport
)

# pull data for pools and format the data
for pool in pool_cfg:
    # grab arguments we need for fetching data
    pool_addr = pool["poolAddress"]
    swap_token_addr = pool["wormholeTokenAddress"]
    slippage_args = pool["slippageTrialAmounts"]

    # query for volume/tvl stats 
    volume_df = fetch_daily_pool_data(
        pool_addr, 
        DAILY_QUERY, 
        QUERY_TYPE,
        NAME_MAP
    )

    # check to see if we successfully pulled volume data
    if not len(volume_df):
        print(f"No data found for pool {pool_addr}")
        continue

    # fetch slippage and market data stats for a given AMM
    slippage_df = fetch_pool_slippage_data(
        pool_addr, 
        swap_token_addr, 
        slippage_args,
        STATS_SCRIPT
    )

    # check to see if we successfully pulled slippage data
    if not len(slippage_df):
        print(f"No data found for pool {pool_addr}")
        continue 

    # merge dataframes into one
    data_df = pd.concat([volume_df, slippage_df], axis=1)

    # convert dataframe to dictionary
    data_dict = data_df.to_dict(orient="records")[0]
    print(data_dict)

    # will write df to big table here 
    # write_data_to_table(data_dict)