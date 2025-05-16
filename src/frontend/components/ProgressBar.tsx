import React, { CSSProperties, memo, useEffect, useRef, useState } from 'react';

interface ProgressBarProps {
  current?: number;
  total?: number;
  fakeTotal?: number;
  fakeDurationMs?: number;
  fakeResetKey?: string | number;
  height?: CSSProperties['height'];
}

const DEFAULT_MS = 300;

const ProgressBar = memo(
  ({
    current = 0,
    total = 0,
    fakeTotal = 0,
    fakeDurationMs = 5000,
    fakeResetKey,
    height = '10px',
  }: ProgressBarProps) => {
    const [visible, setVisible] = useState(false);
    const [fakeCurrent, setFakeCurrent] = useState(0);
    const [reseting, setReseting] = useState(false);
    const [transitionTime, setTransTime] = useState<number | undefined>(DEFAULT_MS);
    const fakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const totalUnits = total + fakeTotal;
    const realProgress = total > 0 ? (current / total) * 100 : 0;
    const totalProgress = totalUnits > 0 ? ((current + fakeCurrent) / totalUnits) * 100 : 100;

    const resultProgress = realProgress >= 100 ? 100 : totalProgress;

    const waitNextFrame = () => {
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 50);
        });
      });
    };

    //reset fake progress and start it
    useEffect(() => {
      const runFakeProgress = async () => {
        setFakeCurrent(0);
        setReseting(true);
        setVisible(false);

        await waitNextFrame();

        setReseting(false);
        setTransTime(fakeDurationMs);

        await waitNextFrame();

        setVisible(true);
        setFakeCurrent(fakeTotal);
        fakeTimeoutRef.current = setTimeout(() => {
          setTransTime(DEFAULT_MS);
          fakeTimeoutRef.current = null;
        }, fakeDurationMs);
      };

      runFakeProgress();
      return () => {
        if (fakeTimeoutRef.current !== null) {
          clearTimeout(fakeTimeoutRef.current);
          fakeTimeoutRef.current = null;
        }
      };
    }, [fakeResetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // If there are current real progress, reset the transition time to reflect actual progress
    useEffect(() => {
      if (current > 0 && transitionTime !== DEFAULT_MS) {
        setTransTime(DEFAULT_MS);
      }
    }, [current, transitionTime]);

    //hide progress bar after finish or show it if it should be visible
    useEffect(() => {
      if (resultProgress >= 100) {
        const time = total <= 0 && fakeTotal > 0 ? transitionTime : DEFAULT_MS;
        const timeout = setTimeout(() => setVisible(false), time);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => setVisible(true), DEFAULT_MS);
        return () => clearTimeout(timeout);
      }
    }, [fakeTotal, resultProgress, total, transitionTime]);

    const style: CSSProperties = {
      width: `${reseting ? 0 : resultProgress}%`,
      transition: `width ${reseting ? 0 : transitionTime}ms linear`,
    };

    return (
      <div
        className={`progress-bar-container ${visible && !reseting ? '' : 'hidden'}`}
        style={{ height: height }}
      >
        <div
          className={`progress-bar-fill ${visible ? '' : 'no-transition'}`} //
          style={style}
        />
      </div>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
