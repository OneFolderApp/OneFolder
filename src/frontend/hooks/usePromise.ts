import { useEffect, useRef, useState } from 'react';

export type Result<T, E> = { ok: T } | { err: E };
export const createOk = <T, E>(ok: T): Result<T, E> => ({ ok });
export const createErr = <T, E>(err: E): Result<T, E> => ({ err });

export type Poll<T> = { tag: 'ready'; value: T } | { tag: 'pending' };
export const createPending = <T>(): Poll<T> => ({ tag: 'pending' });
export const createReady = <T>(value: T): Poll<T> => ({ tag: 'ready', value });

export type Query<S extends any[], T> = (...args: [...S]) => Promise<T>;

export function usePromise<T, E, S extends any[]>(
  ...args: [...S, Query<S, T>]
): Poll<Result<T, E>> {
  const fetch = useRef<Query<S, T>>(args.pop() as Query<S, T>);
  const sources = args as unknown as S;
  const [future, setFuture] = useState<Poll<Result<T, E>>>(createPending);

  useEffect(() => {
    let isEffectRunning = true;
    const promise = fetch.current.apply(null, sources);
    promise
      .then((value: T) => {
        if (isEffectRunning) {
          setFuture(createReady(createOk(value)));
        }
      })
      .catch((err: E) => {
        if (isEffectRunning) {
          setFuture(createReady(createErr(err)));
        }
      });

    // Only set to pending state if the future was not resolved until the next frame.
    let handle: number = requestAnimationFrame(() => {
      handle = requestAnimationFrame(() =>
        setFuture((f) => (isEffectRunning && f === future ? createPending() : f)),
      );
    });

    return () => {
      isEffectRunning = false;
      cancelAnimationFrame(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, sources);

  return future;
}
