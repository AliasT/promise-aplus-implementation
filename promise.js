// https://www.ituring.com.cn/article/66566
// prettier-ignore
// 重要过程：
// 1. executor 的两个参数 resolve， 只能调用一次
// 2. 已经fulfill 无法变更到其他状态

const PENDING = 0;
const FULFILLED = 1;
const REJECTED = 2;

function MyPromise(executor) {
  if (!new.target) {
    throw TypeError("Promise must be called with new operator");
  }

  const self = this;
  // prettier-ignore
  let state = PENDING, value = null, processing = false, sTasks = [], eTasks = [];
  

  const once = (method) => (value) => {
    if (processing) return;
    return (processing = true), method(value);
  };

  try {
    // once: 作为exector的函数参数：resolve和reject只能执行一次
    executor(once(fulfill), once(reject));
  } catch (error) {
    // executor 执行的过程中发生的错误将导致 promise rejection
    if (!processing) reject(error);
  }

  function fulfill(thenable) {
    // resolve 对象不能是 promise 本身
    if (self === thenable) reject(TypeError());
    
    // promise 的状态一旦确定，将不能改变
    if (state === REJECTED || state === FULFILLED) return;
    
    // 如果 resolve 的是一个 promise 实例，将以该 promise 的结果 resolve 当前promise
    if (thenable instanceof self.constructor)
      return thenable.then.call(thenable, fulfill, reject);

    if (
      (typeof thenable === "object" && thenable != null) ||
      typeof thenable === "function"
    ) {
      let then;
      try {
        // 直接使用 thenable.then 会多次触发 Getter
        then = thenable.then;
      } catch (error) {
        // 取 then 的时候报错，如果 promise 的状态此时仍是 pending，返回以该错误为 reason 的新 promise
        if (state === PENDING) {
          return new self.constructor((_, reject) => reject(error)).then(
            fulfill,
            reject
          );
        }
      }
      // 如果 then 是一个thenable，构造一个 promise，以 resolve 和 reject 作为参数
      if (typeof then === "function")
        return new self.constructor(then.bind(thenable)).then(fulfill, reject);
    }

    (value = thenable), (state = FULFILLED), runSuccess();
  }

  function reject(reason) {
    // 不能迁移至其他任何状态
    if (state === REJECTED || state === FULFILLED) return;

    (value = reason), (state = REJECTED), runError();
  }

  function runSuccess() {
    setTimeout(() => {
      while (sTasks.length > 0) sTasks.shift().call(null, value);
    });
  }

  function runError() {
    setTimeout(() => {
      while (eTasks.length > 0) eTasks.shift().call(null, value);
    });
  }

  this.then = function (onFulfilled, onRejected) {
    // then 的调用将总是产生一个新的 promise
    const deferred = self.constructor.deferred();

    sTasks.push((value) => {
      if (typeof onFulfilled === "function") {
        try {
          value = onFulfilled(value);
        } catch (error) {
          return deferred.reject(error);
        }
      }

      deferred.resolve(value);
    });

    eTasks.push((reason) => {
      if (typeof onRejected === "function") {
        try {
          return deferred.resolve(onRejected(reason));
        } catch (error) {
          reason = error;
        }
      }

      deferred.reject(reason);
    });

    if (state === FULFILLED) runSuccess();
    else if (state === REJECTED) runError();

    return deferred.promise;
  };

  // 虽然执行效果和使用 then 的第二个参数相同，
  // 但是链式调用额外生成了一个新的 promise
  this.catch = self.then.bind(null, null);

  // 忽略 callback 的类型
  // 均以 undefined 作为参数执行 callback
  // 实际情况来看，回调执行顺序和 finally 与 then 的调用顺序有关
  this.finally = function onFinally(callback) {
    return this.then(
      (value) => (callback(), value),
      () => callback()
    );
  };
}

function wrap(Constructor) {
  Constructor.deferred = () => {
    let resolve, reject;

    const promise = new Constructor((resolve1, reject1) => {
      (resolve = resolve1), (reject = reject1);
    });

    return { resolve, reject, promise };
  };

  Constructor.resolve = function (value) {
    const deferred = Constructor.deferred();
    return deferred.resolve(value), deferred.promise;
  };

  Constructor.reject = function (reason) {
    const deferred = Constructor.deferred();
    return deferred.reject(reason), deferred.promise;
  };

  return Constructor;
}

module.exports = wrap(MyPromise);
