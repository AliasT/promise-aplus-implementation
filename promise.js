// https://www.ituring.com.cn/article/66566

// 重要过程：
// 1. executor 的两个参数 resolve， 只能调用一次
// 2. 已经fulfill 无法变更到其他状态

const promisesAplusTests = require("promises-aplus-tests");

const PENDING = 0;
const FULFILLED = 1;
const REJECTED = 2;

function MyPromise(executor) {
  if (!new.target) {
    throw TypeError('Promise must be called with new operator')
  }

  const self = this;

  let state = PENDING,
    value = null,
    processing = false,
    sTasks = [],
    eTasks = [];

  const once = (method) => (value) => {
    if (processing) return;
    return (processing = true), method(value);
  };

  try {
    executor(once(fulfill), once(reject));
  } catch (error) {
    if (!processing) reject(error);
  }

  function fulfill(thenable) {
    // resolve 对象不能是 promise 本身
    if (self === thenable) reject(TypeError());
    if (state === REJECTED || state === FULFILLED) return;

    if (thenable instanceof self.constructor)
      return thenable.then.call(thenable, fulfill, reject);

    if (
      (typeof thenable === "object" && thenable != null) ||
      typeof thenable === "function"
    ) {
      let then;
      try {
        // 直接使用 thenable.then 会多次触发 getter
        then = thenable.then;
      } catch (error) {
        if (state === PENDING) {
          return new self.constructor((_, reject) => reject(error)).then(
            fulfill,
            reject
          );
        }
      }
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

  this.catch = self.then.bind(null, null);
}

function wrap(Constructor) {
  Constructor.deferred = () => {
    let resolve, reject;

    const promise = Constructor((resolve1, reject1) => {
      resolve = resolve1;
      reject = reject1;
    });

    return {
      resolve,
      reject,
      promise,
    };
  };

  return Constructor;
}

exports.wrap = wrap;
exports.MyPromise = wrap(MyPromise);

if (require.main === module) {
  promisesAplusTests(exports.MyPromise, function (err) {});
}
