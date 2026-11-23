import React from "react";
import { Global } from "@emotion/react";
import { reset } from "./styles/reset";
import Router from "./router";

import Maintenance from "./assets/images/maintenance.png"

function App() {
    return (
        <>
            { <><Global styles={reset} /><Router /></> }
        </>
    );
}

export default App;
