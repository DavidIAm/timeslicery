import React, {
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
  }, [audioPlayer, clock]);

  useClock("blurPause", setBlurPause, []);
  useClock("playbackRate", setPlaybackRate, []);
  useClock("togglePlay", (f) => console.log("the toggle play", f), []);
  useClock("togglePlay", togglePlay, []);

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
  useEffect(() => {
    clock.on("setLoop", setLoop);
    return (): void => void clock.off("setLoop", setLoop);
  }, [clock]);

  useEffect(() => {
    if (!audioPlayer) return;
    if (!loop.looping) return;
    if (!loop.start) return;
    if (!loop.end) return;
    if (!play) return;
    let interval: number;
    let timeout = window.setTimeout(() => {
      timeout = 0 || 0;
      audioPlayer.currentTime = loop.start || 0;
      console.log("loop initial backToStart");
      interval = window.setInterval(() => {
        console.log("loop backToStart");
        audioPlayer.currentTime = loop.start || 0;
      }, (((loop.end || 0) - (loop.start || 0)) * 1000) / playbackRate);
    }, ((loop.end - audioPlayer.currentTime) * 1000) / playbackRate);
    return (): void => {
      console.log("loop clear");
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [audioPlayer, play, playbackRate, loop]);

  useEffect(() => {
    if (!audioPlayer) return;
    const setStart = (time: number) => {
      console.log("setting time with setStart");
      audioPlayer.currentTime = time;
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

  const jumpToHandler = useCallback(
    (c: Caption) => {
      clock.emit("time", c.start);
      if (!audioPlayer) return;
      if (typeof c.start === "undefined") {
        console.warn("jump h andle undefined?");
        return;
      }
      if (
        audioPlayer.currentTime >= c.start &&
        audioPlayer.currentTime <= c.end
      )
        return;
      console.log("jumping!", c.start);
      audioPlayer.currentTime = c.start;
    },
    [audioPlayer, clock]
  );

  useEffect(() => {
    clock.on("jumpToCaption", jumpToHandler);
    return (): void => void clock.off("jumpToCaption", jumpToHandler);
  }, [jumpToHandler, clock]);

  const emitTime = useCallback((t) => clock.emit("time", t), [clock]);

  return (
    <>
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
