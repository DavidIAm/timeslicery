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
import { format } from "./Util";

const listenInterval = 200;

export const MediaBox: React.FC<{ audio: string }> = ({ audio }) => {
  const { clock } = useContext(EditContext);

  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>();
  useEffect(() => {
    if (!audioPlayer) return;
    if (!clock) return;
    clock.emit("newAudioPlayer", audioPlayer);
  }, [audioPlayer, clock]);

  const [blurPause, dispatchBlurPause] = useReducer<
    (p: boolean, f: boolean) => boolean,
    boolean
  >(
    (p, f) => f,
    false,
    (t) => t
  );

  const [play, togglePlay] = useReducer<
    (p: boolean, f: boolean) => boolean,
    boolean
  >(
    (p, force) => (force === true || force === false ? force : !p),
    false,
    (t) => t
  );

  const [playbackRate, setPlaybackRate] = useState<number>(1);
  useEffect(() => {
    const toggler = (force: boolean) => togglePlay(force);
    clock.on("blurPause", dispatchBlurPause);
    clock.on("playbackRate", setPlaybackRate);
    clock.on("togglePlay", toggler);
    return (): void => {
      clock.off("togglePlay", toggler);
      clock.off("playbackRate", setPlaybackRate);
      clock.off("blurPause", dispatchBlurPause);
    };
  }, [audioPlayer, clock]);

  const drawOutStart = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      setLoop(false);
      console.log("STARTING DRAW OUT");
      audioPlayer.currentTime = caption.start;
      audioPlayer.play();
    },
    [audioPlayer]
  );

  const cueIn = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("CUE IN", format(audioPlayer.currentTime));
      clock.emit("newStartFor", caption, audioPlayer.currentTime);
      setLoop(true);
    },
    [clock, audioPlayer]
  );
  const cueOut = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("CUE OUT", format(audioPlayer.currentTime));
      clock.emit("newEndFor", caption, audioPlayer.currentTime);
      setLoop(true);
    },
    [clock, audioPlayer]
  );
  const drawOutDone = useCallback(
    (caption) => {
      if (!audioPlayer) return;
      console.log("ENDING DRAW OUT", format(audioPlayer.currentTime));
      clock.emit("newEndFor", caption, audioPlayer.currentTime);
      audioPlayer.currentTime = caption.start;
      setLoop(true);
    },
    [audioPlayer, clock]
  );
  useEffect(() => {
    clock.on("cueIn", cueIn);
    clock.on("cueOut", cueOut);
    clock.on("drawOutStart", drawOutStart);
    clock.on("drawOutDone", drawOutDone);
    return (): void => {
      clock.off("cueIn", cueIn);
      clock.off("cueOut", cueOut);
      clock.off("drawOutStart", drawOutStart);
      clock.off("drawOutDone", drawOutDone);
    };
  }, [clock, drawOutStart, drawOutDone, cueIn, cueOut]);

  useEffect(() => {
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
  const [loop, setLoop] = useState<Boolean>(false);
  useEffect(() => {
    clock.on("setLoop", setLoop);
    return (): void => void clock.off("setLoop", setLoop);
  }, [audioPlayer, clock]);

  const [caption, setCaption] = useState<Caption>();

  useEffect(() => {
    if (!audioPlayer) return;
    if (!caption) return;
    if (!loop) return;
    let interval: number;
    let timeout = window.setTimeout(() => {
      timeout = 0;
      audioPlayer.currentTime = caption.start;
      interval = window.setInterval(
        () => (audioPlayer.currentTime = caption.start),
        ((caption.end - caption.start) * 1000) / playbackRate
      );
    }, ((caption.end - audioPlayer.currentTime) * 1000) / playbackRate);
    return (): void => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [audioPlayer, caption, playbackRate, loop]);

  useEffect(() => {
    if (!audioPlayer) return;
    const setStart = (time: number) => (audioPlayer.currentTime = time);
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
      setCaption(c);
      clock.emit("time", c.start);
      if (!audioPlayer) return;
      if (
        audioPlayer.currentTime >= c.start &&
        audioPlayer.currentTime <= c.end
      )
        return;
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
        ref={(e) => setAudioPlayer(e?.audioEl.current)}
        listenInterval={listenInterval}
        onListen={emitTime}
        volume={0.5}
        src={audio}
        controls
      />
    </>
  );
};
