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
import { format, useClock, useKeyboard } from "./Util";
import "./Button.css";

export const LiveClock: React.FC = () => {
  const { clock } = useContext(EditContext);
  const [time, setTime] = useState<number>(0);
  useEffect(() => {
    clock.on("time", setTime);
    return (): void => void clock.off("time", setTime);
  }, [clock]);
  return <>{format(time)}</>;
};

export const EditBox: React.FC<{ caption: Caption }> = ({ caption }) => {
  const { voice, text, foreSize, backSize, uuid } = caption || {
    start: 0,
    end: 0,
    voice: "Empty",
    text: "Empty",
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

  const emitter = useCallback(
    (event: string, ...args) =>
      () =>
        clock.emit(event, ...args),
    [clock]
  );
  useEffect(
    () => void emitter("cueState", cueState)(),
    [clock, emitter, cueState]
  );
  useClock("voiceSet", setVoiceSet, []);
  useClock(
    "cueStart",
    () => {
      setPlayLoopCue(PLC.CUE);
      setCueState(CUE_STATE.CUE_START);
      clock.emit("jumpToCaption", caption);
      clock.emit("saveNewUndoPoint");
      clock.emit("togglePlay", true);
      setCueState(CUE_STATE.CUE_IN);
    },
    []
  );
  useClock(
    "cueCancel",
    () => {
      clock.emit("togglePlay", false);
      setCueState(CUE_STATE.CUE_OFF);
      setPlayLoopCue(PLC.PAUSE);
    },
    []
  );

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
  ) || <></>;

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

  const updateInLength = useCallback(
    (time) => {
      if (!caption?.start) return;
      setStateMessage(`Caption Length: ${format(time - caption.start)}`);
    },
    [caption?.start]
  );
  const [lastOutTime, setLastOutTime] = useState<number>(0);
  const updateOutLength = useCallback(
    (time) => {
      if (!caption?.end) return;
      setStateMessage(`Gap Length: ${format(time - lastOutTime)}`);
    },
    [caption?.end, lastOutTime]
  );
  const [playCurrentTime, setTime] = useState<number>(0);
  useEffect(() => {
    if (!clock) return;
    const cleanup: (() => void)[] = [];
    switch (cueState) {
      case CUE_STATE.CUE_OFF:
        break;
      case CUE_STATE.CUE_START:
        clock.emit("jumpToCaption", caption);
        clock.emit("saveNewUndoPoint");
        clock.emit("togglePlay", true);
        setCueState(CUE_STATE.CUE_GAP);
        break;

      // while in cue_gap when cueIn, send newStartFor next
      case CUE_STATE.CUE_GAP:
        clock.on("time", setTime);
        const onAction = () => {
          if (caption.nextCaption) {
            clock.emit("newStartFor", {
              note: "human cue out",
              uuid: caption.nextCaption,
              time: playCurrentTime,
            });
          }
        };
        clock.on("cueIn", onAction);
        clock.on("time", updateInLength);
        cleanup.push((): void => {
          clock.off("time", setTime);
          clock.off("time", updateOutLength);
          clock.off("cueIn", onAction);
        });
        //        clock.emit("cueOut", caption.uuid);
        break;

      // while cue in - on CueIn set start of next, set end for last
      // on cueOut, set end of current
      case CUE_STATE.CUE_IN:
        const onInInAction = () => {
          clock.emit("newStartFor", {
            note: "human cue in",
            uuid: caption.nextCaption,
            time: playCurrentTime + 0.001,
          });
          clock.emit("newEndFor", {
            note: "human cue in",
            uuid: caption.uuid,
            time: playCurrentTime,
          });
        };
        const onInOutAction = () => {
          setLastOutTime(playCurrentTime);
          clock.emit("newEndFor", {
            note: "human cue in",
            uuid: caption.uuid,
            time: playCurrentTime,
          });
          setCueState(CUE_STATE.CUE_GAP);
        };
        clock.on("time", setTime);
        clock.on("cueIn", onInInAction);
        clock.on("cueOut", onInOutAction);
        clock.on("time", updateInLength);
        cleanup.push((): void => {
          clock.off("time", setTime);
          clock.off("time", updateInLength);
          clock.off("cueIn", onInInAction);
          clock.off("cueOut", onInOutAction);
        });
        break;

      case CUE_STATE.CUE_CANCEL:
        break;
      case CUE_STATE.CUE_SAVE:
        clock.emit("playLoopCue", "pause");
        clock.emit("restoreToUndoPoint");
        clock.emit("togglePlay", false);
        setPlayLoopCue(PLC.PAUSE);
        setCueState(CUE_STATE.CUE_OFF);
    }
    if (cleanup.length) {
      return (): void => cleanup.forEach((cb) => cb());
    }
  }, [
    cueState,
    clock,
    caption,
    updateInLength,
    updateOutLength,
    lastOutTime,
    playCurrentTime,
  ]);

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
  useEffect(() => {
    clock.emit("PlayLoopCue", playLoopCue);
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
  useEffect(() => void emitter("setLoop", loopState)(), [loopState, emitter]);

  useEffect(() => {
    if (!editBlock) return;
    if (!keyboard) return;
    const emit = (event: KeyboardEvent) => {
      const { code } = event;
      keyboard.emit("Keyboard", { zone: "edit", event });
      keyboard.emit(`edit${code}`, event);
      console.log("edit", event);
      event.stopPropagation();
    };
    editBlock.addEventListener("keyup", emit);
  }, [editBlock, keyboard]);

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
          <select name="voice" ref={(t) => setSpeaking(t)} defaultValue={voice}>
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
            <button onClick={emitter("moveUp")}>Prev</button>
          </div>
          <div>
            <LiveClock />
          </div>
          <div className={"rightwards"}>
            <button onClick={emitter("moveDown")}>Next</button>
          </div>
          <div className={"leftwards"}>
            <button onClick={emitter("insertBack", caption?.uuid)}>
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
                        onClick={emitter("cueOut")}
                      >
                        Out
                      </button>
                    </div>
                    <div className="hint">Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={emitter("cueIn")}>In</button>
                    </div>
                    <div className={"hint"}>Space</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={emitter("cueSave")}>Save</button>
                    </div>
                    <div className={"hint"}>Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={emitter("cueCancel")}>Cancel</button>
                    </div>
                    <div className={"hint"}>Escape</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button onClick={emitter("cueStart")}>Cue</button>
                <button
                  onClick={emitter(playLoopCue === PLC.PLAY ? "pause" : "play")}
                >
                  {playLoopCue === PLC.PLAY ? "Pause" : "Play"}
                </button>
              </>
            )}
          </div>
          <div className={"rightwards"}>
            <button onClick={emitter("insertAfter", caption?.uuid)}>
              &gt; Insert &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button
              disabled={(backSize || 0) < 0.1}
              onClick={emitter("gapBefore", uuid)}
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
              onClick={emitter("gapAfter", uuid)}
            >
              &gt; Gap &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button onClick={emitter("cutToPrev", 1.5)}>
              &lt; Cut to Prev&lt;
            </button>
          </div>
          <div>
            <button onClick={emitter("playbackRate", 1.5)}>Fast</button>/
            <button onClick={emitter("playbackRate", 1)}> Normal</button>/
            <button onClick={emitter("playbackRate", 0.5)}>Slow</button>
          </div>
          <div className={"rightwards"}>
            <button onClick={emitter("cutToNext", caption?.uuid)}>
              &gt; Cut to Next &gt;
            </button>
          </div>
          <div className={"rightwards"}>{backSize?.toFixed(0)}ms</div>
          <div style={{ padding: "0", margin: "0" }}>
            <textarea
              style={{ fontSize: "1em" }}
              ref={setTextArea}
              cols={40}
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
