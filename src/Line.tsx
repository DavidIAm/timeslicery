import React, { useCallback, useContext, useEffect, useState } from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";
import { format } from "./Util";

export const Line: React.FC<Caption & { current: boolean }> = (caption) => {
  const { startRaw, endRaw, voice, text, align, current } = caption;
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
      onClick={() => {
        console.log("jump", caption, caption.start, caption.startRaw);
        clock.emit("jumpToCaption", caption);
      }}
    >
      <span>
        {startRaw} --&gt; {lendRaw} {align || ""}
      </span>
      <p style={{ marginBlock: "0" }}>
        &lt;v {voice}&gt; {text}
      </p>
    </div>
  );
};
