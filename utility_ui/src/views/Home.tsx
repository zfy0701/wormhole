import { AppBar, Button, Divider, Typography } from "@material-ui/core";
import { useCallback, useState } from "react";
import { CLUSTER } from "../utils/consts";
import RegisterChain from "./RegisterChain";

const REGISTER_CHAIN = "Submit Register Chain VAAs";

function Home() {
  const [displayedView, setDisplayedView] = useState<string | null>(null);

  const setRegisterChain = useCallback(() => {
    setDisplayedView(REGISTER_CHAIN);
  }, []);

  const clear = useCallback(() => {
    setDisplayedView(null);
  }, []);

  const backHeader = (
    <>
      <div style={{ padding: ".5rem", textAlign: "center" }}>
        <Typography variant="h5">{displayedView}</Typography>
        <Button onClick={clear} variant="contained" color="default">
          Back
        </Button>
      </div>
      <Divider />
    </>
  );

  const content =
    displayedView === null ? (
      <div style={{ textAlign: "center", padding: "1rem" }}>
        <Typography variant="h5">
          Which action would you like to perform?
        </Typography>
        <div style={{ margin: "2rem" }}>
          <Button
            style={{ margin: ".5rem" }}
            variant="contained"
            onClick={setRegisterChain}
          >
            {REGISTER_CHAIN}
          </Button>
        </div>
      </div>
    ) : displayedView === REGISTER_CHAIN ? (
      <>
        {backHeader}
        <RegisterChain />
      </>
    ) : null;

  return (
    <>
      {CLUSTER === "mainnet" ? null : (
        <AppBar position="static" color="secondary">
          <Typography style={{ textAlign: "center" }}>
            Caution! You are using the {CLUSTER} build of this app.
          </Typography>
        </AppBar>
      )}
      {content}
    </>
  );
}

export default Home;
