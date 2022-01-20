import http = require("http");
import client = require("prom-client");

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help
// 2) Create a method to set the metric to a value
// 3) Register the metric

export enum PromMode {
  Listen,
  Relay,
  Both,
}

export class PromHelper {
  private register = new client.Registry();
  private walletReg = new client.Registry();
  // private collectDefaultMetrics = client.collectDefaultMetrics;

  // Actual metrics
  private successCounter = new client.Counter({
    name: "successes",
    help: "number of successful relays",
  });
  private failureCounter = new client.Counter({
    name: "failures",
    help: "number of failed relays",
  });
  private completeTime = new client.Histogram({
    name: "complete_time",
    help: "Time is took to complete transfer",
    buckets: [400, 800, 1600, 3200, 6400, 12800],
  });
  private listenCounter = new client.Counter({
    name: "VAAs_received",
    help: "number of VAAs received",
  });
  private alreadyExecutedCounter = new client.Counter({
    name: "already_executed",
    help: "number of transfers rejected due to already having been executed",
  });
  // End metrics

  private server = http.createServer(async (req, res) => {
    // console.log("promHelpers received a request: ", req);
    if (req.url === "/metrics") {
      // Return all metrics in the Prometheus exposition format
      res.setHeader("Content-Type", this.register.contentType);
      res.end(await this.register.metrics());
      // res.write(await this.register.metrics());
      // res.end(await this.walletReg.metrics());
    }
  });

  constructor(name: string, port: number, mode: PromMode) {
    this.register.setDefaultLabels({
      app: name,
    });
    // this.collectDefaultMetrics({ register: this.register });

    // Register each metric
    if (mode === PromMode.Listen || mode == PromMode.Both) {
      this.register.registerMetric(this.listenCounter);
    }
    if (mode === PromMode.Relay || mode == PromMode.Both) {
      this.register.registerMetric(this.successCounter);
      this.register.registerMetric(this.failureCounter);
      this.register.registerMetric(this.alreadyExecutedCounter);
    }
    // End registering metric

    this.server.listen(port);
  }

  // These are the accessor methods for the metrics
  incSuccesses() {
    this.successCounter.inc();
  }
  incFailures() {
    this.failureCounter.inc();
  }
  addCompleteTime(val: number) {
    this.completeTime.observe(val);
  }
  incIncoming() {
    this.listenCounter.inc();
  }
  incAlreadyExec() {
    this.alreadyExecutedCounter.inc();
  }
}
