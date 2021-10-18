import React, {
  Reducer,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Caption, CUE_STATE, PLC } from "./Caption";
import { EditContext } from "./Transcript";
import { v4 } from "uuid";
import { useClock, useKeyboard } from "./Util";
import "./Button.css";
import { useCutProcessor } from "./UseCutProcessor";
import { useCueProcessor } from "./UseCueProcessor";
import { LiveClock } from "./LiveClock";

export const EditBox: React.FC<{
  caption: Caption;
  prev?: Caption;
  next?: Caption;
}> = ({ caption, prev, next }) => {
  const { voice, text, foreSize, backSize } = caption || {
    start: 0,
    end: 0,
    voice: "EMPTY_VOICE_VALUE",
    text: "",
    foreSize: 0,
    backSize: 0,
    index: -1,
  };
  const { clock, keyboard } = useContext(EditContext);
  const [textArea, setTextArea] = useState<HTMLTextAreaElement | null>();
  const [speaking, setSpeaking] = useState<HTMLSelectElement | null>();
  const [voiceSet, setVoiceSet] = useState<Set<string>>(new Set<string>([]));
  const [stateMessage, setStateMessage] = useState<string>();
  const [modeDisplay, setModeDisplay] = useState<string>();
  const [playLoopCue, setPlayLoopCue] = useState<PLC>(PLC.PAUSE);
  const [hovering, setHovering] = useState<boolean>(false);
  const [cueState, setCueState] = useState<CUE_STATE>(CUE_STATE.CUE_OFF);
  const [editBlock, setEditBlock] = useState<HTMLDivElement | null>(null);
  const [newText, setNewText] = useState<string>("");

  useEffect(() => {
    console.log("Change cuestate", cueState);
    clock.emit("cueState", cueState);
  }, [clock, cueState]);
  useClock("voiceSet", setVoiceSet, []);
  useEffect(() => {
    console.log("Change playLoopCue", playLoopCue);
    clock.emit("playLoopCue", playLoopCue);
  }, [clock, playLoopCue]);

  const keyboardHandler = useCallback(({ key }) => console.log("Key", key), []);
  useEffect(() => {
    if (!speaking) return;
    speaking.value = voice || "space left blank";
  }, [voice, speaking]);

  useEffect(() => {
    if (!textArea) return;
    textArea.disabled = cueState !== CUE_STATE.CUE_OFF;
    textArea.value = text || "space left blank";
  }, [text, textArea, cueState]);

  const VoiceSetList = useMemo(
    () => (
      <>
        {Array.from(voiceSet.values())
          .sort()
          .map((speaking) => (
            <option key={v4()} value={speaking}>
              {speaking}
            </option>
          ))}
      </>
    ),
    [voiceSet]
  );

  useKeyboard("linesPeriod", keyboardHandler, []);
  useKeyboard("linesComma", keyboardHandler, []);
  useKeyboard("linesKeyB", keyboardHandler, []);

  useEffect(() => {
    if (!clock) return;
    if (cueState === CUE_STATE.CUE_OFF) return;
    const cancel = () => setCueState(CUE_STATE.CUE_CANCEL);
    const save = () => setCueState(CUE_STATE.CUE_SAVE);
    const cuein = () => setCueState(CUE_STATE.CUE_IN);
    const cuegap = () => setCueState(CUE_STATE.CUE_GAP);
    keyboard.on("editEscape", cancel);
    keyboard.on("editEnter", save);
    keyboard.on("editSpace", cuein);
    keyboard.on("editDelete", cuegap);
    return (): void => {
      keyboard.off("editEscape", cancel);
      keyboard.off("editEnter", save);
      keyboard.off("editSpace", cuein);
      keyboard.off("editDelete", cuegap);
    };
  }, [cueState, keyboard, clock]);

  const [cues, subs] = useCueProcessor(cueState, caption, next, prev);
  useEffect(() => {
    if (!clock) return;
    if (!cues) return;
    const forward = (n: string, ...args: any) => {
      console.log("EmitForCue", n, ...args);
      clock.emit(n, ...args);
    };
    const flist = subs.map((en): [string, (...a: any) => void] => [
      en,
      (...args: any) => cues.emit(en, ...args),
    ]);
    flist.forEach(([en, func]) => clock.on(en, func));
    cues.on("forEventBus", forward);
    cues.on("setCueState", setCueState);
    cues.on("setPlayLoopCue", setPlayLoopCue);
    cues.on("setStateMessage", setStateMessage);
    return (): void => {
      subs.forEach((en) => clock.on(en, (...args) => cues.emit(en, ...args)));
      flist.forEach(([en, func]) => clock.off(en, func));
      cues.off("forEventBus", forward);
      cues.off("setCueState", setCueState);
      cues.off("setPlayLoopCue", setPlayLoopCue);
      cues.off("setStateMessage", setStateMessage);
    };
  }, [cues, clock, setCueState, setPlayLoopCue, setStateMessage, subs]);

  useEffect(() => {
    const checkPlay = (playing: boolean): void => {
      cueState === CUE_STATE.CUE_OFF
        ? setPlayLoopCue(playing ? PLC.PLAY : PLC.PAUSE)
        : void 0;
    };
    clock.on("playState", checkPlay);
    return (): void => void clock.off("playState", checkPlay);
  }, [cueState, clock]);

  useEffect(() => {
    clock.emit("editBoxHover", hovering);
  }, [hovering, clock]);

  type LoopType = {
    looping: boolean;
    start?: number;
    end?: number;
  };
  const [loopState, setLoopState] = useReducer<Reducer<LoopType, LoopType>>(
    (a, { looping, start, end }) =>
      looping !== a.looping || a.start !== start || a.end !== end
        ? { looping, start, end }
        : a,
    { looping: false }
  );

  useCutProcessor(playLoopCue, caption, next, prev);

  useEffect(() => {
    if (!caption) return;
    setStateMessage(void 0);
    switch (playLoopCue) {
      case PLC.PAUSE:
        setModeDisplay("Pause");
        break;
      case PLC.PLAY:
        setModeDisplay(hovering ? "Play Loop" : "Play Through");
        const { start, end } = caption;
        if (hovering) setLoopState({ looping: true, start, end });
        else setLoopState({ looping: false });
        break;
      case PLC.ENTRY:
        setModeDisplay("Entry");
        break;
      case PLC.CUE:
        setModeDisplay("Cue Loading");
        setLoopState({ looping: false });
        break;
    }
  }, [playLoopCue, caption, hovering, clock]);

  useEffect(() => void clock.emit("loopState", loopState), [loopState, clock]);

  useEffect(() => {
    if (!editBlock) return;
    if (!keyboard) return;
    const emit = (event: KeyboardEvent) => {
      const { code } = event;
      keyboard.emit("Keyboard", { zone: "edit", event });
      keyboard.emit(`edit${code}`, event);
      console.log("edit", "EDITKEYBOARD", code);
    };
    editBlock.addEventListener("keydown", emit);
  }, [editBlock, keyboard]);
  useEffect(() => setNewText(text), [text]);
  // when newText is changed, then if you hit enter, it commits it
  useEffect(() => {
    if (!caption) return;
    if (!clock) return;
    if (newText === "") return;
    if (newText === text) return;
    const keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      clock.emit("newTextFor", newText, "human edit", caption);
      if (e.shiftKey) clock.emit("moveTo", caption.nextCaption?.index);
    };
    keyboard.on("editEnter", keyHandler);
    return (): void => void keyboard.off("editEnter", keyHandler);
  }, [newText, clock, keyboard, caption, text]);

  return (
    <>
      <div
        tabIndex={3}
        ref={setEditBlock}
        onMouseLeave={() => setHovering(false)}
        onMouseEnter={() => {
          setHovering(true);
          textArea?.focus();
        }}
      >
        <div>
          <label htmlFor="voice">Voice</label>
          <select
            name="voice"
            ref={(t) => setSpeaking(t)}
            onChange={({ target: { value } }) =>
              clock.emit("newVoiceFor", value, "human edit", caption)
            }
            defaultValue={voice}
          >
            {VoiceSetList}
          </select>
        </div>
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "auto auto auto",
          }}
        >
          <div className={"leftwards"}>
            <button
              disabled={!prev}
              onClick={() => clock.emit("moveTo", prev?.index)}
            >
              Prev
            </button>
          </div>
          <div>
            <LiveClock />
          </div>
          <div className={"rightwards"}>
            <button
              disabled={!next}
              onClick={() => clock.emit("moveTo", next?.index)}
            >
              Next
            </button>
          </div>
          <div className={"leftwards"}>
            <button onClick={() => clock.emit("insertBack", caption?.uuid)}>
              &lt; Insert &lt;
            </button>
          </div>
          <div>
            {playLoopCue === PLC.CUE ? (
              <>
                <div
                  className={"hintedButtonBox"}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <div>
                    <div>
                      <button
                        disabled={cueState === CUE_STATE.CUE_GAP}
                        onClick={() => clock.emit("cueOut")}
                      >
                        Out
                      </button>
                    </div>
                    <div className="hint">Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={() => clock.emit("cueIn")}>In</button>
                    </div>
                    <div className={"hint"}>Space</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={() => clock.emit("cueSave")}>
                        Save
                      </button>
                    </div>
                    <div className={"hint"}>Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={() => clock.emit("cueCancel")}>
                        Cancel
                      </button>
                    </div>
                    <div className={"hint"}>Escape</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => clock.emit("cueStart")}>Cue</button>
                <button
                  onClick={() =>
                    clock.emit(playLoopCue === PLC.PLAY ? "pause" : "play")
                  }
                >
                  {playLoopCue === PLC.PLAY ? "Pause" : "Play"}
                </button>
              </>
            )}
          </div>
          <div className={"rightwards"}>
            <button onClick={() => clock.emit("insertAfter", caption?.uuid)}>
              &gt; Insert &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button
              disabled={(backSize || 0) < 0.1}
              onClick={() => clock.emit("gapBefore", caption)}
            >
              &lt; Gap &lt;
            </button>
          </div>
          <div>
            {stateMessage ? <>{stateMessage}</> : <>{modeDisplay} Mode</>}
          </div>
          <div className={"rightwards"}>
            <button
              disabled={(foreSize || 0) < 1.001}
              onClick={() => clock.emit("gapAfter", caption)}
            >
              &gt; Gap &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button
              disabled={[PLC.PAUSE].includes(playLoopCue) || !prev}
              onClick={() => clock.emit("withTime", "cutToPrev")}
            >
              &lt; Cut &lt;
            </button>
          </div>
          <div>
            <button onClick={() => clock.emit("playbackRate", 1.5)}>
              Fast
            </button>
            /
            <button onClick={() => clock.emit("playbackRate", 1)}>
              {" "}
              Normal
            </button>
            /
            <button onClick={() => clock.emit("playbackRate", 0.5)}>
              Slow
            </button>
          </div>
          <div className={"rightwards"}>
            <button
              disabled={[PLC.PAUSE].includes(playLoopCue) || !next}
              onClick={() => clock.emit("withTime", "cutToNext")}
            >
              &gt; Cut &gt;
            </button>
          </div>
          <div className={"rightwards"}>{backSize?.toFixed(0)}ms</div>
          <div style={{ padding: "0", margin: "0" }}>
            <textarea
              style={{ fontSize: "1em" }}
              ref={setTextArea}
              cols={40}
              onChange={({ target: { value } }) => setNewText(value)}
              onKeyPressCapture={console.log}
              onKeyDown={console.log}
              defaultValue={""}
            />
          </div>
          <div className={"leftwards"}>{foreSize?.toFixed(0)}ms</div>
        </div>
      </div>
    </>
  );
};
