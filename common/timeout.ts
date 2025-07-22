/**
 * Performs a single promise, but retries when it fails for a specified amount of time.
 * Timeout is doubled after every failed retry
 **/
export async function promiseRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  timeout = 1000,
  err?: any,
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, timeout));

  return !retries
    ? Promise.reject(err)
    : fn().catch((error) => promiseRetry(fn, retries - 1, timeout * 2, error));
}

export function debounce<F extends (...args: any) => any>(func: F, wait: number = 300): F & { cancel: () => void } {
  let timeoutID: number;

  if (!Number.isInteger(wait)) {
    console.log(' Called debounce with an invalid number');
    wait = 300;
  }

  // Create the debounced function
  const debounced = function (this: any, ...args: any[]) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func.apply(this, args), wait) as unknown as number;
  };

  // Add cancel method
  (debounced as any).cancel = function() {
    clearTimeout(timeoutID);
  };

  // Return the enhanced function
  return debounced as any as F & { cancel: () => void };
}

export function throttle(fn: (...args: any) => any, wait: number = 300) {
  let isCalled = false;

  return (...args: any[]) => {
    if (!isCalled) {
      fn(...args);
      isCalled = true;
      setTimeout(() => {
        isCalled = false;
      }, wait);
    }
  };
}

/**
 * Throttle debounce combo. Basically, same as throttle, but also calls fn at the end.
 * https://trungk18.com/experience/debounce-throttle-combination/
 * fixme: the fn is called one extra time at the end, but whatevs, good enough
 * @param fn The function to be called
 * @param wait How long to wait in between calls
 */
export function debouncedThrottle<F extends (...args: any) => any>(fn: F, wait = 300): F & { cancel: () => void } {
  let last: Date | undefined;
  let deferTimer = 0;

  const db = debounce(fn);
  
  // Create the debounced throttle function
  const debouncedThrottleFn = function(this: any, ...args: any) {
    const now = new Date();
    if (last === undefined || now.getTime() < last.getTime() + wait) {
      clearTimeout(deferTimer);
      db.apply(this, args);
      deferTimer = setTimeout(() => {
        last = now;
        fn.apply(this, args);
      }, wait) as any;
    } else {
      last = now;
      fn.apply(this, args);
    }
  };
  
  // Add cancel method
  (debouncedThrottleFn as any).cancel = function() {
    clearTimeout(deferTimer);
    db.cancel();
  };
  
  return debouncedThrottleFn as any as F & { cancel: () => void };
}

export function timeoutPromise<T>(timeMS: number, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    promise.then(resolve, reject);
    setTimeout(reject, timeMS);
  });
}

export function timeout<T>(timeMS: number): Promise<T> {
  return new Promise((resolve) => setTimeout(resolve, timeMS));
}
