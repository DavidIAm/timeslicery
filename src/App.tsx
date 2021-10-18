import React, { useMemo } from "react";
import "./App.css";
import { EditContext } from "./Transcript";
import EventEmitter from "events";
import { UrlBox } from "./UrlBox";

function App() {
  const keyboard = useMemo(() => new EventEmitter(), []);
  const clock = useMemo(() => {
    const c = new EventEmitter();
    c.setMaxListeners(30);
    return c;
  }, []);

  const editContextValue = useMemo(
    () => ({ clock, keyboard }),
    [clock, keyboard]
  );

  return (
    <div tabIndex={1} className="App">
      <header className="App-header">
        <EditContext.Provider value={editContextValue}>
          <UrlBox />
        </EditContext.Provider>
      </header>
    </div>
  );
}

//
// type TruthyEffect = (
//   effect: EffectCallback,
//   truthyDeps?: DependencyList,
//   apathyDeps?: DependencyList
// ) => void;
// const useTruthyEffect: TruthyEffect = (v, d, e: DependencyList = []) => {
//   useEffect(() => {
//     if (d && d.find((d) => !d)) return;
//     return v();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, ...(d ? [...e, ...d] : []));
// };

export default App;
