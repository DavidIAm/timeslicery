import React, {
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
import { format } from "./Util";
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
  const { voice, text, foreSize, backSize, index, uuid } = caption || {
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
  const [voiceSet, dispatchVoice] = useReducer(
    (set: Set<string>, newSet: Set<string>) => {
      console.log("Reduce Voice");
      return newSet;
    },
    new Set<string>(["empty"])
  );
  const keyboardHandler = useCallback(({ key }) => console.log("Key", key), []);
  useEffect(() => {
    if (!speaking) return;
    speaking.value = voice || "space left blank";
  }, [voice, speaking]);

  const [cueState, setCueState] = useState<CUE_STATE>(CUE_STATE.CUE_OFF);
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

  useEffect(() => {
    clock.on("voices", dispatchVoice);
    keyboard.on("linesPeriod", keyboardHandler);
    keyboard.on("linesComma", keyboardHandler);
    keyboard.on("linesKeyB", keyboardHandler);
    return (): void => {
      clock.off("voices", dispatchVoice);
      keyboard.off("linesPeriod", keyboardHandler);
      keyboard.off("linesComma", keyboardHandler);
      keyboard.off("linesKeyB", keyboardHandler);
    };
  }, [dispatchVoice, keyboardHandler, keyboard, clock]);

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

  const [stateMessage, setStateMessage] = useState<string>();
  const [modeDisplay, setModeDisplay] = useState<string>();
  const [playLoopCue, setPlayLoopCue] = useState<PLC>(PLC.PAUSE);
  const [hovering, setHovering] = useState<boolean>(false);

  useEffect(() => {
    switch (cueState) {
      case CUE_STATE.CUE_OFF:
        break;
      case CUE_STATE.CUE_START:
        setPlayLoopCue(PLC.CUE);
        clock.emit("jumpToCaption", caption);
        clock.emit("saveNewUndoPoint");
        clock.emit("togglePlay", true);
        setCueState(CUE_STATE.CUE_GAP);
        break;
      case CUE_STATE.CUE_GAP:
        setStateMessage("CUE GAP");
        clock.emit("cueOut", caption);
        break;
      case CUE_STATE.CUE_IN:
        clock.emit("cueIn", caption);
        setStateMessage("CUE CAPTION IN");
        break;
      case CUE_STATE.CUE_CANCEL:
        clock.emit("togglePlay", false);
        setPlayLoopCue(PLC.PAUSE);
        setCueState(CUE_STATE.CUE_OFF);
        break;
      case CUE_STATE.CUE_SAVE:
        clock.emit("playLoopCue", "pause");
        clock.emit("restoreToUndoPoint");
        clock.emit("togglePlay", false);
        setPlayLoopCue(PLC.PAUSE);
        setCueState(CUE_STATE.CUE_OFF);
    }
  }, [cueState, clock, caption]);

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
        clock.emit("setLoop", { looping: hovering, start, end });
        break;
      case PLC.ENTRY:
        setModeDisplay("Entry");
        break;
      case PLC.CUE:
        setModeDisplay("Cue");
        clock.emit("setLoop", { looping: false });
        break;
    }
  }, [playLoopCue, caption, hovering, clock]);

  const [editBlock, setEditBlock] = useState<HTMLDivElement | null>(null);
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
            <button onClick={(event) => clock.emit("moveUp", event)}>
              Prev
            </button>
          </div>
          <div>
            <LiveClock />
          </div>
          <div className={"rightwards"}>
            <button onClick={(event) => clock.emit("moveDown", event)}>
              Next
            </button>
          </div>
          <div className={"leftwards"}>
            <button onClick={() => clock.emit("insertBack", caption.uuid)}>
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
                        disabled={
                          playLoopCue !== PLC.CUE ||
                          cueState === CUE_STATE.CUE_GAP
                        }
                        onClick={() => setCueState(CUE_STATE.CUE_GAP)}
                      >
                        Out
                      </button>
                    </div>
                    <div className="hint">Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button
                        disabled={playLoopCue !== PLC.CUE}
                        onClick={() => setCueState(CUE_STATE.CUE_IN)}
                      >
                        In
                      </button>
                    </div>
                    <div className={"hint"}>Space</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={() => setCueState(CUE_STATE.CUE_CANCEL)}>
                        Save
                      </button>
                    </div>
                    <div className={"hint"}>Backspace</div>
                  </div>
                  <div>
                    <div>
                      <button onClick={() => setCueState(CUE_STATE.CUE_SAVE)}>
                        Cancel
                      </button>
                    </div>
                    <div className={"hint"}>Escape</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setCueState(CUE_STATE.CUE_START)}>
                  Cue
                </button>
                <button
                  onClick={() => {
                    clock.emit(
                      playLoopCue === PLC.PLAY ? "pause" : "play",
                      index
                    );
                    setPlayLoopCue(
                      playLoopCue === PLC.PLAY ? PLC.PAUSE : PLC.PLAY
                    );
                  }}
                >
                  {playLoopCue === PLC.PLAY ? "Pause" : "Play"}
                </button>
              </>
            )}
          </div>
          <div className={"rightwards"}>
            <button onClick={() => clock.emit("insertAfter", caption.uuid)}>
              &gt; Insert &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button
              disabled={(backSize || 0) < 0.1}
              onClick={() => {
                console.log("click");
                clock.emit("gapBefore", uuid);
              }}
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
              onClick={() => clock.emit("gapAfter", uuid)}
            >
              &gt; Gap &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button onClick={() => clock.emit("cutToPrev", 1.5)}>
              &lt; Cut to Prev&lt;
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
            <button onClick={() => clock.emit("cutToNext", caption.uuid)}>
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
