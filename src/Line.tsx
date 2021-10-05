import React, { useCallback, useContext, useEffect, useState } from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";
import { format } from "./Util";

export const Line: React.FC<Caption & { current: boolean }> = (caption) => {
  const { end, startRaw, endRaw, voice, text, align, current, index } = caption;
  const { clock } = useContext(EditContext);

  const [lendRaw, setlendRaw] = useState(endRaw);
  const updateWithFormat = useCallback(
    () => (t: number) => setlendRaw(format(t)),
    []
  );
  useEffect(() => {
    clock.on("time", updateWithFormat);
    return (): void => void clock.off("time", updateWithFormat);
  }, [clock, updateWithFormat]);

  return (
    <div
      style={{
        textAlign: "left",
        ...(current ? { backgroundColor: "gray" } : {}),
      }}
      onClick={() => clock.emit("jumpToCaption", caption)}
    >
      <span>
        {startRaw} --&gt; {lendRaw} {align || ""}
      </span>
      <button
        onClick={(e) => {
          clock.emit("cutInHalf", index);
          setlendRaw(format(caption.start + (caption.end - caption.start) / 2));
        }}
      >
        HALF
      </button>
      <button
        onMouseDown={() => clock.emit("drawOutStart", caption)}
        onMouseUp={() => clock.emit("drawOutDone", caption)}
      >
        EXTEND
      </button>
      <p style={{ marginBlockStart: "0" }}>
        &lt;v {voice}&gt; {text}
      </p>
    </div>
  );
};
