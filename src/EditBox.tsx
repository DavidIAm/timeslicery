import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";
import { v4 } from "uuid";
import { format } from "./Util";

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
  const { start, end, voice, text, foreSize, backSize } = caption || {
    start: 0,
    end: 0,
    voice: "Empty",
    text: "Empty",
    foreSize: 0,
    backSize: 0,
    index: -1,
  };
  const { clock } = useContext(EditContext);
  const [textArea, setTextArea] = useState<HTMLTextAreaElement | null>();
  const [speaking, setSpeaking] = useState<HTMLSelectElement | null>();
  const [voiceSet, dispatchVoice] = useReducer(
    (set: Set<string>, newSet: Set<string>) => newSet,
    new Set<string>(["empty"])
  );
  const keyboardHandler = useCallback(({ key }) => console.log("Key", key), []);
  useEffect(() => {
    if (!speaking) return;
    speaking.value = voice || "space left blank";
  }, [voice, speaking]);
  useEffect(() => {
    if (!textArea) return;
    textArea.value = text || "space left blank";
  }, [text, textArea]);

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
    const sendVoice = (set: Set<string>) => dispatchVoice(set);
    clock.on("setVoices", sendVoice);
    clock.on("Period", keyboardHandler);
    clock.on("Comma", keyboardHandler);
    clock.on("KeyB", keyboardHandler);
    return (): void => {
      clock.off("setVoices", sendVoice);
      clock.off("Period", keyboardHandler);
      clock.off("Comma", keyboardHandler);
      clock.off("KeyB", keyboardHandler);
    };
  }, [dispatchVoice, keyboardHandler, clock]);
  const [looping, setLooping] = useState<boolean>(false);
  useEffect(() => {
    clock.emit("setLoop", looping);
  }, [looping, clock]);
  return (
    <>
      <div
        tabIndex={2}
        onMouseLeave={() => setLooping(false)}
        onMouseEnter={() => setLooping(true)}
      >
        <div>
          <div>
            <input
              name={"start"}
              value={start}
              type={"text"}
              onChange={(e) => clock.emit("setStart", parseInt(e.target.value))}
            />{" "}
            --&gt;
            <input
              name={"end"}
              type={"text"}
              value={end}
              onChange={(e) => clock.emit("setEnd", parseInt(e.target.value))}
            />
          </div>
        </div>
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
            <button onClick={() => clock.emit("insertBack", caption.index)}>
              &lt; Insert &lt;
            </button>
          </div>
          <div>
            <button onClick={() => clock.emit("delete", caption.index)}>
              Delete
            </button>
          </div>
          <div className={"rightwards"}>
            <button onClick={() => clock.emit("insertFore", caption.index)}>
              &gt; Insert &gt;
            </button>
          </div>
          <div className={"leftwards"}>
            <button
              disabled={(backSize || 0) < 0.1}
              onClick={() => clock.emit("gapBefore", caption.index)}
            >
              &lt; Gap &lt;
            </button>
          </div>
          <div>{looping ? "Loop" : "Play"} Mode</div>
          <div className={"rightwards"}>
            <button
              disabled={(foreSize || 0) < 0.1}
              onClick={() => clock.emit("gapAfter", caption.index)}
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
            <button onClick={() => clock.emit("cutToNext", caption)}>
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
              onFocus={() => clock.emit("setLoop", true)}
              onBlur={() => clock.emit("setLoop", false)}
              defaultValue={""}
            />
          </div>
          <div className={"leftwards"}>{foreSize?.toFixed(0)}ms</div>
        </div>
      </div>
    </>
  );
};
