import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { EditContext } from "./Transcript";
import EventEmitter from "events";
import { UrlBox } from "./UrlBox";

function App() {
  const keyboard = useMemo(() => new EventEmitter(), []);
  const clock = useMemo(() => new EventEmitter(), []);

  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement>();
  useEffect(() => {
    if (!clock) return;
    if (!setAudioPlayer) return;
    clock.on("setAudioPlayer", setAudioPlayer);
    return (): void => void clock.off("setAudioPlayer", setAudioPlayer);
  }, [clock, setAudioPlayer]);

  const editContextValue = useMemo(
    () => ({ audioPlayer, clock, keyboard }),
    [clock, keyboard, audioPlayer]
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
