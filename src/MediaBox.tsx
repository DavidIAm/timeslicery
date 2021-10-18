import React, {
  Reducer,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { EditContext } from "./Transcript";
import { Caption } from "./Caption";
import ReactAudioPlayer from "react-audio-player";
import { useClock } from "./Util";

export type LoopState = {
  looping: Boolean;
  start?: number;
  end?: number;
};

const listenInterval = 200;

export const MediaBox: React.FC<{ audio: string }> = ({ audio }) => {
  const { clock } = useContext(EditContext);

  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>();
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [blurPause, setBlurPause] = useState(false);
  const [loop, setLoop] = useState<LoopState>({ looping: false });
  const [bipPlayer, setBipPlayer] = useState<HTMLAudioElement>();

  const timeUpdateReducer = useCallback(
    (now, { set, info }) => {
      if (set) {
        const time = audioPlayer ? (audioPlayer.currentTime = set) : now;
        setTimeout(() => {
          clock.emit("setSelectedTime", set);
          clock.emit("time", time);
        }, 0);
        return time;
      }
      if (info) return info;
      return now;
    },
    [clock, audioPlayer]
  );
  const [, currentTimeUpdate] = useReducer<
    Reducer<number, { set?: number; info?: number }>
  >(timeUpdateReducer, 0);

  const [play, togglePlay] = useReducer<
    (p: boolean, f: boolean) => boolean,
    boolean
  >(
    (p, force) => (force === true || force === false ? force : !p),
    false,
    (t) => t
  );

  //useEffect(() => console.log("clock change"), [clock]);
  //useEffect(() => console.log("playbackRate change"), [playbackRate]);
  //useEffect(() => console.log("audioPlayer change"), [audioPlayer]);
  //useEffect(() => console.log("play change"), [play]);
  //useEffect(() => console.log("blurPause change"), [blurPause]);

  useEffect(() => {
    if (!audioPlayer) return;
    if (!clock) return;
    clock.emit("newAudioPlayer", audioPlayer);
    const withTime = (name: string, ...args: any) =>
      clock.emit(name, audioPlayer.currentTime, ...args);
    clock.on("withTime", withTime);
    return (): void => void clock.off("withTime", withTime);
  }, [audioPlayer, clock]);

  const tellTime = useCallback(() => {
    if (!audioPlayer) return;
    clock.emit("time", audioPlayer.currentTime);
  }, [clock, audioPlayer]);

  useClock("blurPause", setBlurPause, []);
  useClock("playbackRate", setPlaybackRate, []);
  useClock("togglePlay", (f) => console.log("the toggle play", f), []);
  useClock("togglePlay", togglePlay, []);
  useClock("tellTime", tellTime, []);

  useEffect(() => {
    if (!clock) return;
    if (!audioPlayer) return;
    if (blurPause) {
      audioPlayer.pause();
      clock.emit("time", audioPlayer.currentTime);
      return;
    }
    play ? audioPlayer.play() : audioPlayer.pause();
    clock.emit("time", audioPlayer.currentTime);
    clock.emit("playState", play);
  }, [audioPlayer, play, blurPause, clock]);

  useEffect(() => {
    if (!audioPlayer) return;
    audioPlayer.playbackRate = playbackRate;
  }, [audioPlayer, playbackRate]);

  // the loop toggle
  useClock("loopState", setLoop, []);

  useEffect(() => {
    if (!audioPlayer) return;
    if (!loop.looping) return;
    if (typeof loop.start === "undefined") return;
    if (!loop.end) return;
    if (!play) return;
    let interval: number;
    let timeout = window.setTimeout(() => {
      timeout = 0 || 0;
      currentTimeUpdate({ set: loop.start || 0 });
      console.log("loop initial backToStart");
      bipPlayer!.play().then(() => clock.emit("playing"));
      interval = window.setInterval(() => {
        console.log("loop backToStart");
        currentTimeUpdate({ set: loop.start || 0 });
      }, (((loop.end || 0) - (loop.start || 0)) * 1000) / playbackRate);
    }, ((loop.end - audioPlayer.currentTime) * 1000) / playbackRate);
    return (): void => {
      console.log("loop clear");
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [audioPlayer, play, playbackRate, loop, bipPlayer, clock]);

  useEffect(() => {
    if (!audioPlayer) return;
    const setStart = (time: number) => {
      console.log("setting time with setStart");
      currentTimeUpdate({ set: time });
    };
    const doPlay = () => togglePlay(true);
    const doPause = () => togglePlay(false);
    clock.on("playFrom", setStart);
    clock.on("play", doPlay);
    clock.on("pause", doPause);
    return (): void => {
      clock.off("playFrom", setStart);
      clock.off("play", doPlay);
      clock.off("pause", doPause);
    };
  }, [clock, audioPlayer]);

  const jumpToCaption = useCallback(
    (c: Caption) => {
      if (!c) {
        console.warn("jump to undefined");
        return;
      }
      if (!audioPlayer) return;
      if (audioPlayer.currentTime >= c.start && audioPlayer.currentTime < c.end)
        return;
      if (typeof c.start === "undefined") return;
      console.log("jumping!", c.start, audioPlayer.currentTime);
      currentTimeUpdate({ set: c.start });
    },
    [audioPlayer]
  );

  useEffect(() => {
    clock.on("jumpToCaption", jumpToCaption);
    return (): void => void clock.off("jumpToCaption", jumpToCaption);
  }, [jumpToCaption, clock]);

  const emitTime = useCallback(
    (t) => {
      currentTimeUpdate({ info: t });
      clock.emit("time", t);
    },
    [clock]
  );

  return (
    <>
      <ReactAudioPlayer
        ref={(e) => {
          if (e && e?.audioEl && e.audioEl.current)
            setBipPlayer(e?.audioEl.current);
        }}
        volume={0.5}
        src={"/MouseClick.wav"}
      />
      <ReactAudioPlayer
        ref={(e) => {
          if (e && e?.audioEl && e.audioEl.current)
            setAudioPlayer(e?.audioEl.current);
        }}
        listenInterval={listenInterval}
        volume={0.1}
        onListen={emitTime}
        onVolumeChanged={console.log}
        src={audio}
        controls
      />
    </>
  );
};
