import React, { useContext } from "react";
import { Caption } from "./Caption";
import { EditContext } from "./Transcript";

export const Line: React.FC<Caption & { current: boolean }> = (caption) => {
  const { startRaw, endRaw, voice, text, align, current } = caption;
  const { clock } = useContext(EditContext);
  return (
    <div
      style={{
        textAlign: "left",
        ...(current ? { backgroundColor: "gray" } : {}),
      }}
      onClick={() => clock.emit("jumpToCaption", caption)}
    >
      <span>
        {startRaw} --&gt; {endRaw} {align || ""}
      </span>
      <p style={{ marginBlockStart: "0" }}>
        &lt;v {voice}&gt; {text}
      </p>
    </div>
  );
};
