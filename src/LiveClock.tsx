import React, { useContext, useEffect, useState } from "react";
import { EditContext } from "./Transcript";
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
