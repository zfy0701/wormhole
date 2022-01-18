In order to compile spy_relay you need to do:

```
npm install redis
```

In order to run spy_relay successfully you need to do:

```
docker pull redis
```

The above will grab the docker for redis.
In order to run that docker use a command similar to:

```
docker run --rm -p6379:6379 --name redis-docker -d redis
```

To run the redis GUI do the following:

```
sudo apt-get install snapd
sudo snap install redis-desktop-manager
cd /var/lib/snapd/desktop/applications; ./redis-desktop-manager_rdm.desktop
```

To build the spy / guardian docker container:

```
cd spy_relay
docker build -f Dockerfile -t guardian .
```

To run the docker image in TestNet:

```
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' -p 7073:7073 guardian
```

To run spy_relay:

```
npm run spy_relay
```

## Spy Listener Environment variables

- SPY_SERVICE_HOST - host & port string to connect to the spy
- SPY_SERVICE_FILTERS - Addresses to monitor (Bridge contract addresses) array of ["chainId","emitterAddress"]. Emitter addresses are native strings.
- SPY_NUM_WORKERS - Number for worker threads monitoring the spy
- REDIS_HOST - ip / host for the REDIS instance.
- REDIS_PORT - port number for redis.
- REST_PORT - port that the REST entrypoint will listen on.
- READINESS_PORT - port for kubernetes readiness probe
- WORKER_TARGET_CHAINS - chains where relay is supported. Array of numbers
- LOG_LEVEL - log level, such as debug
- SUPPORTED_TOKENS - Origin assets that will attempt to be relayed. Array of ["chainId","address"], address should be a native string.
