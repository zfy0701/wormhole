const main = async () => {
  try {
    const redis = await require("redis");
    console.log("Entering main function");
    const client = redis.createClient({ socket: { host: "redis" } });
    console.log("created a client object");
    await client.connect();
    console.log("successfully connected to the client");
    await client.set("thing", 0);
    console.log("successfully set 0 on the client");
    const thing = await client.get("thing");
    console.log("successfully got thing", thing);
  } catch (e) {
    console.error(e);
  }
  console.log("EXITING MAIN");
};

main();
