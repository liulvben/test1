// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == 'object' && typeof process.versions == 'object' && typeof process.versions.node == 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary;

if (ENVIRONMENT_IS_NODE) {
  if (typeof process == 'undefined' || !process.release || process.release.name !== 'node') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split('.').slice(0, 3);
  numericVersion = (numericVersion[0] * 10000) + (numericVersion[1] * 100) + (numericVersion[2].split('-')[0] * 1);
  var minVersion = 160000;
  if (numericVersion < 160000) {
    throw new Error('This emscripten-generated code requires node v16.0.0 (detected v' + nodeVersion + ')');
  }

  // `require()` is no-op in an ESM module, use `createRequire()` to construct
  // the require()` function.  This is only necessary for multi-environment
  // builds, `-sENVIRONMENT=node` emits a static import declaration instead.
  // TODO: Swap all `require()`'s with `import()`'s?
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('fs');
  var nodePath = require('path');

  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = nodePath.dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js
read_ = (filename, binary) => {
  // We need to re-wrap `file://` strings to URLs. Normalizing isn't
  // necessary in that case, the path should already be absolute.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  return fs.readFileSync(filename, binary ? undefined : 'utf8');
};

readBinary = (filename) => {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = (filename, onload, onerror, binary = true) => {
  // See the comment in the `read_` function.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  fs.readFile(filename, binary ? undefined : 'utf8', (err, data) => {
    if (err) onerror(err);
    else onload(binary ? data.buffer : data);
  });
};
// end include: node_shell_read.js
  if (!Module['thisProgram'] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  arguments_ = process.argv.slice(2);

  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  process.on('uncaughtException', (ex) => {
    // suppress ExitStatus exceptions from showing an error
    if (ex !== 'unwind' && !(ex instanceof ExitStatus) && !(ex.context instanceof ExitStatus)) {
      throw ex;
    }
  });

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

  Module['inspect'] = () => '[Emscripten Module object]';

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process == 'object' && typeof require === 'function') || typeof window == 'object' || typeof importScripts == 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = read;
  }

  readBinary = (f) => {
    if (typeof readbuffer == 'function') {
      return new Uint8Array(readbuffer(f));
    }
    let data = read(f, 'binary');
    assert(typeof data == 'object');
    return data;
  };

  readAsync = (f, onload, onerror) => {
    setTimeout(() => onload(readBinary(f)));
  };

  if (typeof clearTimeout == 'undefined') {
    globalThis.clearTimeout = (id) => {};
  }

  if (typeof setTimeout == 'undefined') {
    // spidermonkey lacks setTimeout but we use it above in readAsync.
    globalThis.setTimeout = (f) => (typeof f == 'function') ? f() : abort();
  }

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit == 'function') {
    quit_ = (status, toThrow) => {
      // Unlike node which has process.exitCode, d8 has no such mechanism. So we
      // have no way to set the exit code and then let the program exit with
      // that code when it naturally stops running (say, when all setTimeouts
      // have completed). For that reason, we must call `quit` - the only way to
      // set the exit code - but quit also halts immediately.  To increase
      // consistency with node (and the web) we schedule the actual quit call
      // using a setTimeout to give the current stack and any exception handlers
      // a chance to run.  This enables features such as addOnPostRun (which
      // expected to be able to run code after main returns).
      setTimeout(() => {
        if (!(toThrow instanceof ExitStatus)) {
          let toLog = toThrow;
          if (toThrow && typeof toThrow == 'object' && toThrow.stack) {
            toLog = [toThrow, toThrow.stack];
          }
          err(`exiting due to exception: ${toLog}`);
        }
        quit(status);
      });
      throw toThrow;
    };
  }

  if (typeof print != 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console == 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr != 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window == 'object' || typeof importScripts == 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {
// include: web_or_worker_shell_read.js
read_ = (url) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  }

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = (url, onload, onerror) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  }

// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;
checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];legacyModuleProp('arguments', 'arguments_');

if (Module['thisProgram']) thisProgram = Module['thisProgram'];legacyModuleProp('thisProgram', 'thisProgram');

if (Module['quit']) quit_ = Module['quit'];legacyModuleProp('quit', 'quit_');

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] == 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
legacyModuleProp('asm', 'wasmExports');
legacyModuleProp('read', 'read_');
legacyModuleProp('readAsync', 'readAsync');
legacyModuleProp('readBinary', 'readBinary');
legacyModuleProp('setWindowTitle', 'setWindowTitle');
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.");


// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];legacyModuleProp('wasmBinary', 'wasmBinary');

if (typeof WebAssembly != 'object') {
  abort('no native wasm support detected');
}

// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

// Memory management

var HEAP,
/** @type {!Int8Array} */
  HEAP8,
/** @type {!Uint8Array} */
  HEAPU8,
/** @type {!Int16Array} */
  HEAP16,
/** @type {!Uint16Array} */
  HEAPU16,
/** @type {!Int32Array} */
  HEAP32,
/** @type {!Uint32Array} */
  HEAPU32,
/** @type {!Float32Array} */
  HEAPF32,
/** @type {!Float64Array} */
  HEAPF64;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module['HEAP8'] = HEAP8 = new Int8Array(b);
  Module['HEAP16'] = HEAP16 = new Int16Array(b);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(b);
  Module['HEAP32'] = HEAP32 = new Int32Array(b);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(b);
}

assert(!Module['STACK_SIZE'], 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')

assert(typeof Int32Array != 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined,
       'JS engine does not provide full typed array support');

// If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
assert(!Module['wasmMemory'], 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
assert(!Module['INITIAL_MEMORY'], 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = 0x02135467;
  HEAPU32[(((max)+(4))>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)>>2)];
  var cookie2 = HEAPU32[(((max)+(4))>>2)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_assertions.js
// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  
if (!Module["noFSInit"] && !FS.init.initialized)
  FS.init();
FS.ignorePermissions = false;

TTY.init();
SOCKFS.root = FS.mount(SOCKFS, {}, null);
  callRuntimeCallbacks(__ATINIT__);
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // defintion for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */
var isDataURI = (filename) => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');
// end include: URIUtils.js
function createExportWrapper(name) {
  return function() {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    return f.apply(null, arguments);
  };
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
var wasmBinaryFile;
  wasmBinaryFile = 'photon-em.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

function getBinaryPromise(binaryFile) {
  // If we don't have the binary yet, try to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary
      && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch == 'function'
      && !isFileURI(binaryFile)
    ) {
      return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + binaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(() => getBinarySync(binaryFile));
    }
    else if (readAsync) {
      // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
      return new Promise((resolve, reject) => {
        readAsync(binaryFile, (response) => resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))), reject)
      });
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return Promise.resolve().then(() => getBinarySync(binaryFile));
}

function instantiateArrayBuffer(binaryFile, imports, receiver) {
  return getBinaryPromise(binaryFile).then((binary) => {
    return WebAssembly.instantiate(binary, imports);
  }).then((instance) => {
    return instance;
  }).then(receiver, (reason) => {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  });
}

function instantiateAsync(binary, binaryFile, imports, callback) {
  if (!binary &&
      typeof WebAssembly.instantiateStreaming == 'function' &&
      !isDataURI(binaryFile) &&
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      !isFileURI(binaryFile) &&
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      !ENVIRONMENT_IS_NODE &&
      typeof fetch == 'function') {
    return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
      // Suppress closure warning here since the upstream definition for
      // instantiateStreaming only allows Promise<Repsponse> rather than
      // an actual Response.
      // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure is fixed.
      /** @suppress {checkTypes} */
      var result = WebAssembly.instantiateStreaming(response, imports);

      return result.then(
        callback,
        function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err(`wasm streaming compile failed: ${reason}`);
          err('falling back to ArrayBuffer instantiation');
          return instantiateArrayBuffer(binaryFile, imports, callback);
        });
    });
  }
  return instantiateArrayBuffer(binaryFile, imports, callback);
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    

    wasmMemory = wasmExports['memory'];
    
    assert(wasmMemory, "memory not found in wasm exports");
    // This assertion doesn't hold when emscripten is run in --post-link
    // mode.
    // TODO(sbc): Read INITIAL_MEMORY out of the wasm file in post-link mode.
    //assert(wasmMemory.buffer.byteLength === 16777216);
    updateMemoryViews();

    wasmTable = wasmExports['__indirect_function_table'];
    
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(wasmExports['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {

    try {
      return Module['instantiateWasm'](info, receiveInstance);
    } catch(e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
        return false;
    }
  }

  instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult);
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// include: runtime_debug.js
function legacyModuleProp(prop, newName, incomming=true) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get() {
        let extra = incomming ? ' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)' : '';
        abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra);

      }
    });
  }
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

function missingGlobal(sym, msg) {
  if (typeof globalThis !== 'undefined') {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        warnOnce('`' + sym + '` is not longer defined by emscripten. ' + msg);
        return undefined;
      }
    });
  }
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  if (typeof globalThis !== 'undefined' && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        // Can't `abort()` here because it would break code that does runtime
        // checks.  e.g. `if (typeof SDL === 'undefined')`.
        var msg = '`' + sym + '` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line';
        // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
        // library.js, which means $name for a JS name with no prefix, or name
        // for a JS name like _name.
        var librarySymbol = sym;
        if (!librarySymbol.startsWith('_')) {
          librarySymbol = '$' + sym;
        }
        msg += " (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='" + librarySymbol + "')";
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        warnOnce(msg);
        return undefined;
      }
    });
  }
  // Any symbol that is not included from the JS libary is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = "'" + sym + "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)";
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      }
    });
  }
}

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(text) {
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn.apply(console, arguments);
}
// end include: runtime_debug.js
// === Body ===

var ASM_CONSTS = {
  266696: ($0, $1) => { Module['websocket'].subprotocol = UTF8ToString($0); Module['websocket'].url = UTF8ToString($1); }
};


// end include: preamble.js

  /** @constructor */
  function ExitStatus(status) {
      this.name = 'ExitStatus';
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };

  var withStackSave = (f) => {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    };
  
  
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string');
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i); // possibly a lead surrogate
        if (u >= 0xD800 && u <= 0xDFFF) {
          var u1 = str.charCodeAt(++i);
          u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
        }
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce('Invalid Unicode code point ' + ptrToString(u) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };
  
  var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
  
    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */
  var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.  Also, use the length info to avoid running tiny
      // strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation,
      // so that undefined means Infinity)
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      // If building with TextDecoder, we have already computed the string length
      // above, so test loop end condition against that
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte ' + ptrToString(u0) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */
  var UTF8ToString = (ptr, maxBytesToRead) => {
      assert(typeof ptr == 'number');
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
    };
  var demangle = (func) => {
      // If demangle has failed before, stop demangling any further function names
      // This avoids an infinite recursion with malloc()->abort()->stackTrace()->demangle()->malloc()->...
      demangle.recursionGuard = (demangle.recursionGuard|0)+1;
      if (demangle.recursionGuard > 1) return func;
      return withStackSave(() => {
        try {
          var s = func;
          if (s.startsWith('__Z'))
            s = s.substr(1);
          var buf = stringToUTF8OnStack(s);
          var status = stackAlloc(4);
          var ret = ___cxa_demangle(buf, 0, 0, status);
          if (HEAP32[((status)>>2)] === 0 && ret) {
            return UTF8ToString(ret);
          }
          // otherwise, libcxxabi failed
        } catch(e) {
        } finally {
          _free(ret);
          if (demangle.recursionGuard < 2) --demangle.recursionGuard;
        }
        // failure when using libcxxabi, don't demangle
        return func;
      });
    };

  
    /**
     * @param {number} ptr
     * @param {string} type
     */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': abort('to do getValue(i64) use WASM_BIGINT');
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = Module['noExitRuntime'] || true;

  var ptrToString = (ptr) => {
      assert(typeof ptr === 'number');
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    };

  
    /**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': abort('to do setValue(i64) use WASM_BIGINT');
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only
        // populated if an Error object is thrown, so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }
  
  var demangleAll = (text) => {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    };
  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  var warnOnce = (text) => {
      if (!warnOnce.shown) warnOnce.shown = {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  var ___assert_fail = (condition, filename, line, func) => {
      abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    };

  /** @constructor */
  function ExceptionInfo(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - 24;
  
      this.set_type = function(type) {
        HEAPU32[(((this.ptr)+(4))>>2)] = type;
      };
  
      this.get_type = function() {
        return HEAPU32[(((this.ptr)+(4))>>2)];
      };
  
      this.set_destructor = function(destructor) {
        HEAPU32[(((this.ptr)+(8))>>2)] = destructor;
      };
  
      this.get_destructor = function() {
        return HEAPU32[(((this.ptr)+(8))>>2)];
      };
  
      this.set_caught = function(caught) {
        caught = caught ? 1 : 0;
        HEAP8[(((this.ptr)+(12))>>0)] = caught;
      };
  
      this.get_caught = function() {
        return HEAP8[(((this.ptr)+(12))>>0)] != 0;
      };
  
      this.set_rethrown = function(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(((this.ptr)+(13))>>0)] = rethrown;
      };
  
      this.get_rethrown = function() {
        return HEAP8[(((this.ptr)+(13))>>0)] != 0;
      };
  
      // Initialize native structure fields. Should be called once after allocated.
      this.init = function(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor);
      }
  
      this.set_adjusted_ptr = function(adjustedPtr) {
        HEAPU32[(((this.ptr)+(16))>>2)] = adjustedPtr;
      };
  
      this.get_adjusted_ptr = function() {
        return HEAPU32[(((this.ptr)+(16))>>2)];
      };
  
      // Get pointer which is expected to be received by catch clause in C++ code. It may be adjusted
      // when the pointer is casted to some of the exception object base classes (e.g. when virtual
      // inheritance is used). When a pointer is thrown this method should return the thrown pointer
      // itself.
      this.get_exception_ptr = function() {
        // Work around a fastcomp bug, this code is still included for some reason in a build without
        // exceptions support.
        var isPointer = ___cxa_is_pointer_type(this.get_type());
        if (isPointer) {
          return HEAPU32[((this.excPtr)>>2)];
        }
        var adjusted = this.get_adjusted_ptr();
        if (adjusted !== 0) return adjusted;
        return this.excPtr;
      };
    }
  
  var exceptionLast = 0;
  
  var uncaughtExceptionCount = 0;
  var ___cxa_throw = (ptr, type, destructor) => {
      var info = new ExceptionInfo(ptr);
      // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      assert(false, 'Exception thrown, but exception catching is not enabled. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.');
    };

  var PATH = {
  isAbs:(path) => path.charAt(0) === '/',
  splitPath:(filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
  normalizeArray:(parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },
  normalize:(path) => {
        var isAbsolute = PATH.isAbs(path),
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter((p) => !!p), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },
  dirname:(path) => {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },
  basename:(path) => {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },
  join:function() {
        var paths = Array.prototype.slice.call(arguments);
        return PATH.normalize(paths.join('/'));
      },
  join2:(l, r) => {
        return PATH.normalize(l + '/' + r);
      },
  };
  
  var initRandomFill = () => {
      if (typeof crypto == 'object' && typeof crypto['getRandomValues'] == 'function') {
        // for modern web browsers
        return (view) => crypto.getRandomValues(view);
      } else
      if (ENVIRONMENT_IS_NODE) {
        // for nodejs with or without crypto support included
        try {
          var crypto_module = require('crypto');
          var randomFillSync = crypto_module['randomFillSync'];
          if (randomFillSync) {
            // nodejs with LTS crypto support
            return (view) => crypto_module['randomFillSync'](view);
          }
          // very old nodejs with the original crypto API
          var randomBytes = crypto_module['randomBytes'];
          return (view) => (
            view.set(randomBytes(view.byteLength)),
            // Return the original view to match modern native implementations.
            view
          );
        } catch (e) {
          // nodejs doesn't have crypto support
        }
      }
      // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
      abort("no cryptographic support found for randomDevice. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: (array) => { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };");
    };
  var randomFill = (view) => {
      // Lazily init on the first invocation.
      return (randomFill = initRandomFill())(view);
    };
  
  
  
  var PATH_FS = {
  resolve:function() {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path != 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = PATH.isAbs(path);
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter((p) => !!p), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },
  relative:(from, to) => {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      },
  };
  
  
  
  var FS_stdin_getChar_buffer = [];
  
  
  /** @type {function(string, boolean=, number=)} */
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
  }
  var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          // we will read data by chunks of BUFSIZE
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
  
          // For some reason we must suppress a closure warning here, even though
          // fd definitely exists on process.stdin, and is even the proper way to
          // get the fd of stdin,
          // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
          // This started to happen after moving this logic out of library_tty.js,
          // so it is related to the surrounding code in some unclear manner.
          /** @suppress {missingProperties} */
          var fd = process.stdin.fd;
  
          try {
            bytesRead = fs.readSync(fd, buf);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
            // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          } else {
            result = null;
          }
        } else
        if (typeof window != 'undefined' &&
          typeof window.prompt == 'function') {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else if (typeof readline == 'function') {
          // Command line.
          result = readline();
          if (result !== null) {
            result += '\n';
          }
        }
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };
  var TTY = {
  ttys:[],
  init() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process.stdin.setEncoding('utf8');
        // }
      },
  shutdown() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process.stdin.pause();
        // }
      },
  register(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },
  stream_ops:{
  open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
  close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty);
        },
  fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
  read(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },
  write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        },
  },
  default_tty_ops:{
  get_char(tty) {
          return FS_stdin_getChar();
        },
  put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00,
              0x12, 0x0f, 0x17, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]
          };
        },
  ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0;
        },
  ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
  },
  default_tty1_ops:{
  put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  },
  };
  
  
  var zeroMemory = (address, size) => {
      HEAPU8.fill(0, address, address + size);
      return address;
    };
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  var mmapAlloc = (size) => {
      abort('internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported');
    };
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }
        return node;
      },
  getFileDataAsTypedArray(node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },
  expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
      },
  resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
        }
      },
  node_ops:{
  getattr(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw FS.genericErrors[44];
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now()
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  readdir(node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },
  readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
  },
  stream_ops:{
  read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },
  write(stream, buffer, offset, length, position, canOwn) {
          // The data buffer should be a typed array view
          assert(!(buffer instanceof ArrayBuffer));
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) {
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
  llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
  allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr);
          }
          return { ptr, allocated };
        },
  msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        },
  },
  };
  
  /** @param {boolean=} noRunDep */
  var asyncLoad = (url, onload, onerror, noRunDep) => {
      var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : '';
      readAsync(url, (arrayBuffer) => {
        assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
        onload(new Uint8Array(arrayBuffer));
        if (dep) removeRunDependency(dep);
      }, (event) => {
        if (onerror) {
          onerror();
        } else {
          throw `Loading data file "${url}" failed.`;
        }
      });
      if (dep) addRunDependency(dep);
    };
  
  
  var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
      return FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
    };
  
  var preloadPlugins = Module['preloadPlugins'] || [];
  var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      var handled = false;
      preloadPlugins.forEach((plugin) => {
        if (handled) return;
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, onerror);
          handled = true;
        }
      });
      return handled;
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      function processData(byteArray) {
        function finish(byteArray) {
          if (preFinish) preFinish();
          if (!dontCreateFile) {
            FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
          }
          if (onload) onload();
          removeRunDependency(dep);
        }
        if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
          if (onerror) onerror();
          removeRunDependency(dep);
        })) {
          return;
        }
        finish(byteArray);
      }
      addRunDependency(dep);
      if (typeof url == 'string') {
        asyncLoad(url, (byteArray) => processData(byteArray), onerror);
      } else {
        processData(url);
      }
    };
  
  var FS_modeStringToFlags = (str) => {
      var flagModes = {
        'r': 0,
        'r+': 2,
        'w': 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        'a': 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };
  
  var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };
  
  
  
  
  var ERRNO_MESSAGES = {
  0:"Success",
  1:"Arg list too long",
  2:"Permission denied",
  3:"Address already in use",
  4:"Address not available",
  5:"Address family not supported by protocol family",
  6:"No more processes",
  7:"Socket already connected",
  8:"Bad file number",
  9:"Trying to read unreadable message",
  10:"Mount device busy",
  11:"Operation canceled",
  12:"No children",
  13:"Connection aborted",
  14:"Connection refused",
  15:"Connection reset by peer",
  16:"File locking deadlock error",
  17:"Destination address required",
  18:"Math arg out of domain of func",
  19:"Quota exceeded",
  20:"File exists",
  21:"Bad address",
  22:"File too large",
  23:"Host is unreachable",
  24:"Identifier removed",
  25:"Illegal byte sequence",
  26:"Connection already in progress",
  27:"Interrupted system call",
  28:"Invalid argument",
  29:"I/O error",
  30:"Socket is already connected",
  31:"Is a directory",
  32:"Too many symbolic links",
  33:"Too many open files",
  34:"Too many links",
  35:"Message too long",
  36:"Multihop attempted",
  37:"File or path name too long",
  38:"Network interface is not configured",
  39:"Connection reset by network",
  40:"Network is unreachable",
  41:"Too many open files in system",
  42:"No buffer space available",
  43:"No such device",
  44:"No such file or directory",
  45:"Exec format error",
  46:"No record locks available",
  47:"The link has been severed",
  48:"Not enough core",
  49:"No message of desired type",
  50:"Protocol not available",
  51:"No space left on device",
  52:"Function not implemented",
  53:"Socket is not connected",
  54:"Not a directory",
  55:"Directory not empty",
  56:"State not recoverable",
  57:"Socket operation on non-socket",
  59:"Not a typewriter",
  60:"No such device or address",
  61:"Value too large for defined data type",
  62:"Previous owner died",
  63:"Not super-user",
  64:"Broken pipe",
  65:"Protocol error",
  66:"Unknown protocol",
  67:"Protocol wrong type for socket",
  68:"Math result not representable",
  69:"Read only file system",
  70:"Illegal seek",
  71:"No such process",
  72:"Stale file handle",
  73:"Connection timed out",
  74:"Text file busy",
  75:"Cross-device link",
  100:"Device not a stream",
  101:"Bad font file fmt",
  102:"Invalid slot",
  103:"Invalid request code",
  104:"No anode",
  105:"Block device required",
  106:"Channel number out of range",
  107:"Level 3 halted",
  108:"Level 3 reset",
  109:"Link number out of range",
  110:"Protocol driver not attached",
  111:"No CSI structure available",
  112:"Level 2 halted",
  113:"Invalid exchange",
  114:"Invalid request descriptor",
  115:"Exchange full",
  116:"No data (for no delay io)",
  117:"Timer expired",
  118:"Out of streams resources",
  119:"Machine is not on the network",
  120:"Package not installed",
  121:"The object is remote",
  122:"Advertise error",
  123:"Srmount error",
  124:"Communication error on send",
  125:"Cross mount point (not really error)",
  126:"Given log. name not unique",
  127:"f.d. invalid for this operation",
  128:"Remote address changed",
  129:"Can   access a needed shared lib",
  130:"Accessing a corrupted shared lib",
  131:".lib section in a.out corrupted",
  132:"Attempting to link in too many libs",
  133:"Attempting to exec a shared library",
  135:"Streams pipe error",
  136:"Too many users",
  137:"Socket type not supported",
  138:"Not supported",
  139:"Protocol family not supported",
  140:"Can't send after socket shutdown",
  141:"Too many references",
  142:"Host is down",
  148:"No medium (in tape drive)",
  156:"Level 2 not synchronized",
  };
  
  var ERRNO_CODES = {
  };
  
  var FS = {
  root:null,
  mounts:[],
  devices:{
  },
  streams:[],
  nextInode:1,
  nameTable:null,
  currentPath:"/",
  initialized:false,
  ignorePermissions:true,
  ErrnoError:null,
  genericErrors:{
  },
  filesystems:null,
  syncFSRequests:0,
  lookupPath(path, opts = {}) {
        path = PATH_FS.resolve(path);
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        opts = Object.assign(defaults, opts)
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(32);
        }
  
        // split the absolute path
        var parts = path.split('/').filter((p) => !!p);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count + 1 });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },
  getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? `${mount}/${path}` : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
  hashName(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
  hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
  hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
  lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },
  createNode(parent, name, mode, rdev) {
        assert(typeof parent == 'object')
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },
  destroyNode(node) {
        FS.hashRemoveNode(node);
      },
  isRoot(node) {
        return node === node.parent;
      },
  isMountpoint(node) {
        return !!node.mounted;
      },
  isFile(mode) {
        return (mode & 61440) === 32768;
      },
  isDir(mode) {
        return (mode & 61440) === 16384;
      },
  isLink(mode) {
        return (mode & 61440) === 40960;
      },
  isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
  isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
  isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
  isSocket(mode) {
        return (mode & 49152) === 49152;
      },
  flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },
  nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
  mayLookup(dir) {
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },
  mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },
  mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
  MAX_OPEN_FDS:4096,
  nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
  getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
  getStream:(fd) => FS.streams[fd],
  createStream(stream, fd = -1) {
        if (!FS.FSStream) {
          FS.FSStream = /** @constructor */ function() {
            this.shared = { };
          };
          FS.FSStream.prototype = {};
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              /** @this {FS.FSStream} */
              get() { return this.node; },
              /** @this {FS.FSStream} */
              set(val) { this.node = val; }
            },
            isRead: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 1024); }
            },
            flags: {
              /** @this {FS.FSStream} */
              get() { return this.shared.flags; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.flags = val; },
            },
            position : {
              /** @this {FS.FSStream} */
              get() { return this.shared.position; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.position = val; },
            },
          });
        }
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
  closeStream(fd) {
        FS.streams[fd] = null;
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },
  llseek() {
          throw new FS.ErrnoError(70);
        },
  },
  major:(dev) => ((dev) >> 8),
  minor:(dev) => ((dev) & 0xff),
  makedev:(ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },
  getDevice:(dev) => FS.devices[dev],
  getMounts(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },
  syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach((mount) => {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },
  mount(type, opts, mountpoint) {
        if (typeof type == 'string') {
          // The filesystem was not included, and instead we have an error
          // message stored in the variable.
          throw type;
        }
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type,
          opts,
          mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },
  unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach((hash) => {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },
  lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
  mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
  create(path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },
  mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
  symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
  rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existant directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },
  rmdir(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
  readdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },
  unlink(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
  readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.chmod(stream.node, mode);
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.chown(stream.node, uid, gid);
      },
  truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },
  utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },
  open(path, flags, mode) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
        mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path == 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512) && !created) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        });
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
          }
        }
        return stream;
      },
  close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
  isClosed(stream) {
        return stream.fd === null;
      },
  llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
  read(stream, buffer, offset, length, position) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
  write(stream, buffer, offset, length, position, canOwn) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
  allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },
  mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
  msync(stream, buffer, offset, length, mmapFlags) {
        assert(offset >= 0);
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
  munmap:(stream) => 0,
  ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
  readFile(path, opts = {}) {
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error(`Invalid encoding type "${opts.encoding}"`);
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },
  cwd:() => FS.currentPath,
  chdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
  createDefaultDirectories() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },
  createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024), randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomLeft = randomFill(randomBuffer).byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice('/dev', 'random', randomByte);
        FS.createDevice('/dev', 'urandom', randomByte);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },
  createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount() {
            var node = FS.createNode(proc_self, 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
        assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
        assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
        assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
      },
  ensureErrnoError() {
        if (FS.ErrnoError) return;
        FS.ErrnoError = /** @this{Object} */ function ErrnoError(errno, node) {
          // We set the `name` property to be able to identify `FS.ErrnoError`
          // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
          // - when using PROXYFS, an error can come from an underlying FS
          // as different FS objects have their own FS.ErrnoError each,
          // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
          // we'll use the reliable test `err.name == "ErrnoError"` instead
          this.name = 'ErrnoError';
          this.node = node;
          this.setErrno = /** @this{Object} */ function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
  
          // Try to get a maximally helpful stack trace. On Node.js, getting Error.stack
          // now ensures it shows what we want.
          if (this.stack) {
            // Define the stack property for Node.js 4, which otherwise errors on the next line.
            Object.defineProperty(this, "stack", { value: (new Error).stack, writable: true });
            this.stack = demangleAll(this.stack);
          }
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [44].forEach((code) => {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },
  staticInit() {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },
  init(input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },
  quit() {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },
  findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
  analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },
  createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },
  createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data == 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (typeof XMLHttpRequest != 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        /** @constructor */
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = /** @this{Object} */ function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (from, to) => {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
            }
            return intArrayFromString(xhr.responseText || '', true);
          };
          var lazyArray = this;
          lazyArray.setDataGetter((chunkNum) => {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') throw new Error('doXHR failed!');
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest != 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: /** @this {FSNode} */ function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach((key) => {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position)
        };
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        };
        node.stream_ops = stream_ops;
        return node;
      },
  absolutePath() {
        abort('FS.absolutePath has been removed; use PATH_FS.resolve instead');
      },
  createFolder() {
        abort('FS.createFolder has been removed; use FS.mkdir instead');
      },
  createLink() {
        abort('FS.createLink has been removed; use FS.symlink instead');
      },
  joinPath() {
        abort('FS.joinPath has been removed; use PATH.join instead');
      },
  mmapAlloc() {
        abort('FS.mmapAlloc has been replaced by the top level function mmapAlloc');
      },
  standardizePath() {
        abort('FS.standardizePath has been removed; use PATH.normalize instead');
      },
  };
  
  var SYSCALLS = {
  DEFAULT_POLLMASK:5,
  calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },
  doStat(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)] = stat.dev;
        HEAP32[(((buf)+(4))>>2)] = stat.mode;
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;
        HEAP32[(((buf)+(12))>>2)] = stat.uid;
        HEAP32[(((buf)+(16))>>2)] = stat.gid;
        HEAP32[(((buf)+(20))>>2)] = stat.rdev;
        (tempI64 = [stat.size>>>0,(tempDouble=stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(24))>>2)] = tempI64[0],HEAP32[(((buf)+(28))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(32))>>2)] = 4096;
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        (tempI64 = [Math.floor(atime / 1000)>>>0,(tempDouble=Math.floor(atime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000;
        (tempI64 = [Math.floor(mtime / 1000)>>>0,(tempDouble=Math.floor(mtime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(56))>>2)] = tempI64[0],HEAP32[(((buf)+(60))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000;
        (tempI64 = [Math.floor(ctime / 1000)>>>0,(tempDouble=Math.floor(ctime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(72))>>2)] = tempI64[0],HEAP32[(((buf)+(76))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000;
        (tempI64 = [stat.ino>>>0,(tempDouble=stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(88))>>2)] = tempI64[0],HEAP32[(((buf)+(92))>>2)] = tempI64[1]);
        return 0;
      },
  doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0;
        }
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
  varargs:undefined,
  get() {
        assert(SYSCALLS.varargs != undefined);
        // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
        var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
        SYSCALLS.varargs += 4;
        return ret;
      },
  getp() { return SYSCALLS.get() },
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  };
  function ___syscall__newselect(nfds, readfds, writefds, exceptfds, timeout) {
  try {
  
      // readfds are supported,
      // writefds checks socket open status
      // exceptfds are supported, although on web, such exceptional conditions never arise in web sockets
      //                          and so the exceptfds list will always return empty.
      // timeout is supported, although on SOCKFS and PIPEFS these are ignored and always treated as 0 - fully async
      assert(nfds <= 64, 'nfds must be less than or equal to 64');  // fd sets have 64 bits // TODO: this could be 1024 based on current musl headers
  
      var total = 0;
  
      var srcReadLow = (readfds ? HEAP32[((readfds)>>2)] : 0),
          srcReadHigh = (readfds ? HEAP32[(((readfds)+(4))>>2)] : 0);
      var srcWriteLow = (writefds ? HEAP32[((writefds)>>2)] : 0),
          srcWriteHigh = (writefds ? HEAP32[(((writefds)+(4))>>2)] : 0);
      var srcExceptLow = (exceptfds ? HEAP32[((exceptfds)>>2)] : 0),
          srcExceptHigh = (exceptfds ? HEAP32[(((exceptfds)+(4))>>2)] : 0);
  
      var dstReadLow = 0,
          dstReadHigh = 0;
      var dstWriteLow = 0,
          dstWriteHigh = 0;
      var dstExceptLow = 0,
          dstExceptHigh = 0;
  
      var allLow = (readfds ? HEAP32[((readfds)>>2)] : 0) |
                   (writefds ? HEAP32[((writefds)>>2)] : 0) |
                   (exceptfds ? HEAP32[((exceptfds)>>2)] : 0);
      var allHigh = (readfds ? HEAP32[(((readfds)+(4))>>2)] : 0) |
                    (writefds ? HEAP32[(((writefds)+(4))>>2)] : 0) |
                    (exceptfds ? HEAP32[(((exceptfds)+(4))>>2)] : 0);
  
      var check = function(fd, low, high, val) {
        return (fd < 32 ? (low & val) : (high & val));
      };
  
      for (var fd = 0; fd < nfds; fd++) {
        var mask = 1 << (fd % 32);
        if (!(check(fd, allLow, allHigh, mask))) {
          continue;  // index isn't in the set
        }
  
        var stream = SYSCALLS.getStreamFromFD(fd);
  
        var flags = SYSCALLS.DEFAULT_POLLMASK;
  
        if (stream.stream_ops.poll) {
          var timeoutInMillis = -1;
          if (timeout) {
            var tv_sec = (readfds ? HEAP32[((timeout)>>2)] : 0),
                tv_usec = (readfds ? HEAP32[(((timeout)+(8))>>2)] : 0);
            timeoutInMillis = (tv_sec + tv_usec / 1000000) * 1000;
          }
          flags = stream.stream_ops.poll(stream, timeoutInMillis);
        }
  
        if ((flags & 1) && check(fd, srcReadLow, srcReadHigh, mask)) {
          fd < 32 ? (dstReadLow = dstReadLow | mask) : (dstReadHigh = dstReadHigh | mask);
          total++;
        }
        if ((flags & 4) && check(fd, srcWriteLow, srcWriteHigh, mask)) {
          fd < 32 ? (dstWriteLow = dstWriteLow | mask) : (dstWriteHigh = dstWriteHigh | mask);
          total++;
        }
        if ((flags & 2) && check(fd, srcExceptLow, srcExceptHigh, mask)) {
          fd < 32 ? (dstExceptLow = dstExceptLow | mask) : (dstExceptHigh = dstExceptHigh | mask);
          total++;
        }
      }
  
      if (readfds) {
        HEAP32[((readfds)>>2)] = dstReadLow;
        HEAP32[(((readfds)+(4))>>2)] = dstReadHigh;
      }
      if (writefds) {
        HEAP32[((writefds)>>2)] = dstWriteLow;
        HEAP32[(((writefds)+(4))>>2)] = dstWriteHigh;
      }
      if (exceptfds) {
        HEAP32[((exceptfds)>>2)] = dstExceptLow;
        HEAP32[(((exceptfds)+(4))>>2)] = dstExceptHigh;
      }
  
      return total;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var SOCKFS = {
  mount(mount) {
        // If Module['websocket'] has already been defined (e.g. for configuring
        // the subprotocol/url) use that, if not initialise it to a new object.
        Module['websocket'] = (Module['websocket'] &&
                               ('object' === typeof Module['websocket'])) ? Module['websocket'] : {};
  
        // Add the Event registration mechanism to the exported websocket configuration
        // object so we can register network callbacks from native JavaScript too.
        // For more documentation see system/include/emscripten/emscripten.h
        Module['websocket']._callbacks = {};
        Module['websocket']['on'] = /** @this{Object} */ function(event, callback) {
          if ('function' === typeof callback) {
            this._callbacks[event] = callback;
          }
          return this;
        };
  
        Module['websocket'].emit = /** @this{Object} */ function(event, param) {
          if ('function' === typeof this._callbacks[event]) {
            this._callbacks[event].call(this, param);
          }
        };
  
        // If debug is enabled register simple default logging callbacks for each Event.
  
        return FS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },
  createSocket(family, type, protocol) {
        type &= ~526336; // Some applications may pass it; it makes no sense for a single process.
        var streaming = type == 1;
        if (streaming && protocol && protocol != 6) {
          throw new FS.ErrnoError(66); // if SOCK_STREAM, must be tcp or 0.
        }
  
        // create our internal socket structure
        var sock = {
          family,
          type,
          protocol,
          server: null,
          error: null, // Used in getsockopt for SOL_SOCKET/SO_ERROR test
          peers: {},
          pending: [],
          recv_queue: [],
          sock_ops: SOCKFS.websocket_sock_ops
        };
  
        // create the filesystem node to store the socket structure
        var name = SOCKFS.nextname();
        var node = FS.createNode(SOCKFS.root, name, 49152, 0);
        node.sock = sock;
  
        // and the wrapping stream that enables library functions such
        // as read and write to indirectly interact with the socket
        var stream = FS.createStream({
          path: name,
          node,
          flags: 2,
          seekable: false,
          stream_ops: SOCKFS.stream_ops
        });
  
        // map the new stream to the socket structure (sockets have a 1:1
        // relationship with a stream)
        sock.stream = stream;
  
        return sock;
      },
  getSocket(fd) {
        var stream = FS.getStream(fd);
        if (!stream || !FS.isSocket(stream.node.mode)) {
          return null;
        }
        return stream.node.sock;
      },
  stream_ops:{
  poll(stream) {
          var sock = stream.node.sock;
          return sock.sock_ops.poll(sock);
        },
  ioctl(stream, request, varargs) {
          var sock = stream.node.sock;
          return sock.sock_ops.ioctl(sock, request, varargs);
        },
  read(stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          var msg = sock.sock_ops.recvmsg(sock, length);
          if (!msg) {
            // socket is closed
            return 0;
          }
          buffer.set(msg.buffer, offset);
          return msg.buffer.length;
        },
  write(stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          return sock.sock_ops.sendmsg(sock, buffer, offset, length);
        },
  close(stream) {
          var sock = stream.node.sock;
          sock.sock_ops.close(sock);
        },
  },
  nextname() {
        if (!SOCKFS.nextname.current) {
          SOCKFS.nextname.current = 0;
        }
        return 'socket[' + (SOCKFS.nextname.current++) + ']';
      },
  websocket_sock_ops:{
  createPeer(sock, addr, port) {
          var ws;
  
          if (typeof addr == 'object') {
            ws = addr;
            addr = null;
            port = null;
          }
  
          if (ws) {
            // for sockets that've already connected (e.g. we're the server)
            // we can inspect the _socket property for the address
            if (ws._socket) {
              addr = ws._socket.remoteAddress;
              port = ws._socket.remotePort;
            }
            // if we're just now initializing a connection to the remote,
            // inspect the url property
            else {
              var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
              if (!result) {
                throw new Error('WebSocket URL must be in the format ws(s)://address:port');
              }
              addr = result[1];
              port = parseInt(result[2], 10);
            }
          } else {
            // create the actual websocket object and connect
            try {
              // runtimeConfig gets set to true if WebSocket runtime configuration is available.
              var runtimeConfig = (Module['websocket'] && ('object' === typeof Module['websocket']));
  
              // The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
              // comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
              var url = 'ws:#'.replace('#', '//');
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['url']) {
                  url = Module['websocket']['url']; // Fetch runtime WebSocket URL config.
                }
              }
  
              if (url === 'ws://' || url === 'wss://') { // Is the supplied URL config just a prefix, if so complete it.
                var parts = addr.split('/');
                url = url + parts[0] + ":" + port + "/" + parts.slice(1).join('/');
              }
  
              // Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
              var subProtocols = 'binary'; // The default value is 'binary'
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['subprotocol']) {
                  subProtocols = Module['websocket']['subprotocol']; // Fetch runtime WebSocket subprotocol config.
                }
              }
  
              // The default WebSocket options
              var opts = undefined;
  
              if (subProtocols !== 'null') {
                // The regex trims the string (removes spaces at the beginning and end, then splits the string by
                // <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
                subProtocols = subProtocols.replace(/^ +| +$/g,"").split(/ *, */);
  
                opts = subProtocols;
              }
  
              // some webservers (azure) does not support subprotocol header
              if (runtimeConfig && null === Module['websocket']['subprotocol']) {
                subProtocols = 'null';
                opts = undefined;
              }
  
              // If node we use the ws library.
              var WebSocketConstructor;
              if (ENVIRONMENT_IS_NODE) {
                WebSocketConstructor = /** @type{(typeof WebSocket)} */(require('ws'));
              } else
              {
                WebSocketConstructor = WebSocket;
              }
              ws = new WebSocketConstructor(url, opts);
              ws.binaryType = 'arraybuffer';
            } catch (e) {
              throw new FS.ErrnoError(23);
            }
          }
  
          var peer = {
            addr,
            port,
            socket: ws,
            dgram_send_queue: []
          };
  
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
  
          // if this is a bound dgram socket, send the port number first to allow
          // us to override the ephemeral port reported to us by remotePort on the
          // remote end.
          if (sock.type === 2 && typeof sock.sport != 'undefined') {
            peer.dgram_send_queue.push(new Uint8Array([
                255, 255, 255, 255,
                'p'.charCodeAt(0), 'o'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0),
                ((sock.sport & 0xff00) >> 8) , (sock.sport & 0xff)
            ]));
          }
  
          return peer;
        },
  getPeer(sock, addr, port) {
          return sock.peers[addr + ':' + port];
        },
  addPeer(sock, peer) {
          sock.peers[peer.addr + ':' + peer.port] = peer;
        },
  removePeer(sock, peer) {
          delete sock.peers[peer.addr + ':' + peer.port];
        },
  handlePeerEvents(sock, peer) {
          var first = true;
  
          var handleOpen = function () {
  
            Module['websocket'].emit('open', sock.stream.fd);
  
            try {
              var queued = peer.dgram_send_queue.shift();
              while (queued) {
                peer.socket.send(queued);
                queued = peer.dgram_send_queue.shift();
              }
            } catch (e) {
              // not much we can do here in the way of proper error handling as we've already
              // lied and said this data was sent. shut it down.
              peer.socket.close();
            }
          };
  
          function handleMessage(data) {
            if (typeof data == 'string') {
              var encoder = new TextEncoder(); // should be utf-8
              data = encoder.encode(data); // make a typed array from the string
            } else {
              assert(data.byteLength !== undefined); // must receive an ArrayBuffer
              if (data.byteLength == 0) {
                // An empty ArrayBuffer will emit a pseudo disconnect event
                // as recv/recvmsg will return zero which indicates that a socket
                // has performed a shutdown although the connection has not been disconnected yet.
                return;
              }
              data = new Uint8Array(data); // make a typed array view on the array buffer
            }
  
            // if this is the port message, override the peer's port with it
            var wasfirst = first;
            first = false;
            if (wasfirst &&
                data.length === 10 &&
                data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 &&
                data[4] === 'p'.charCodeAt(0) && data[5] === 'o'.charCodeAt(0) && data[6] === 'r'.charCodeAt(0) && data[7] === 't'.charCodeAt(0)) {
              // update the peer's port and it's key in the peer map
              var newport = ((data[8] << 8) | data[9]);
              SOCKFS.websocket_sock_ops.removePeer(sock, peer);
              peer.port = newport;
              SOCKFS.websocket_sock_ops.addPeer(sock, peer);
              return;
            }
  
            sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
            Module['websocket'].emit('message', sock.stream.fd);
          };
  
          if (ENVIRONMENT_IS_NODE) {
            peer.socket.on('open', handleOpen);
            peer.socket.on('message', function(data, isBinary) {
              if (!isBinary) {
                return;
              }
              handleMessage((new Uint8Array(data)).buffer); // copy from node Buffer -> ArrayBuffer
            });
            peer.socket.on('close', function() {
              Module['websocket'].emit('close', sock.stream.fd);
            });
            peer.socket.on('error', function(error) {
              // Although the ws library may pass errors that may be more descriptive than
              // ECONNREFUSED they are not necessarily the expected error code e.g.
              // ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
              // is still probably the most useful thing to do.
              sock.error = 14; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
              // don't throw
            });
          } else {
            peer.socket.onopen = handleOpen;
            peer.socket.onclose = function() {
              Module['websocket'].emit('close', sock.stream.fd);
            };
            peer.socket.onmessage = function peer_socket_onmessage(event) {
              handleMessage(event.data);
            };
            peer.socket.onerror = function(error) {
              // The WebSocket spec only allows a 'simple event' to be thrown on error,
              // so we only really know as much as ECONNREFUSED.
              sock.error = 14; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
            };
          }
        },
  poll(sock) {
          if (sock.type === 1 && sock.server) {
            // listen sockets should only say they're available for reading
            // if there are pending clients.
            return sock.pending.length ? (64 | 1) : 0;
          }
  
          var mask = 0;
          var dest = sock.type === 1 ?  // we only care about the socket state for connection-based sockets
            SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) :
            null;
  
          if (sock.recv_queue.length ||
              !dest ||  // connection-less sockets are always ready to read
              (dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {  // let recv return 0 once closed
            mask |= (64 | 1);
          }
  
          if (!dest ||  // connection-less sockets are always ready to write
              (dest && dest.socket.readyState === dest.socket.OPEN)) {
            mask |= 4;
          }
  
          if ((dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {
            mask |= 16;
          }
  
          return mask;
        },
  ioctl(sock, request, arg) {
          switch (request) {
            case 21531:
              var bytes = 0;
              if (sock.recv_queue.length) {
                bytes = sock.recv_queue[0].data.length;
              }
              HEAP32[((arg)>>2)] = bytes;
              return 0;
            default:
              return 28;
          }
        },
  close(sock) {
          // if we've spawned a listen server, close it
          if (sock.server) {
            try {
              sock.server.close();
            } catch (e) {
            }
            sock.server = null;
          }
          // close any peer connections
          var peers = Object.keys(sock.peers);
          for (var i = 0; i < peers.length; i++) {
            var peer = sock.peers[peers[i]];
            try {
              peer.socket.close();
            } catch (e) {
            }
            SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          }
          return 0;
        },
  bind(sock, addr, port) {
          if (typeof sock.saddr != 'undefined' || typeof sock.sport != 'undefined') {
            throw new FS.ErrnoError(28);  // already bound
          }
          sock.saddr = addr;
          sock.sport = port;
          // in order to emulate dgram sockets, we need to launch a listen server when
          // binding on a connection-less socket
          // note: this is only required on the server side
          if (sock.type === 2) {
            // close the existing server if it exists
            if (sock.server) {
              sock.server.close();
              sock.server = null;
            }
            // swallow error operation not supported error that occurs when binding in the
            // browser where this isn't supported
            try {
              sock.sock_ops.listen(sock, 0);
            } catch (e) {
              if (!(e.name === 'ErrnoError')) throw e;
              if (e.errno !== 138) throw e;
            }
          }
        },
  connect(sock, addr, port) {
          if (sock.server) {
            throw new FS.ErrnoError(138);
          }
  
          // TODO autobind
          // if (!sock.addr && sock.type == 2) {
          // }
  
          // early out if we're already connected / in the middle of connecting
          if (typeof sock.daddr != 'undefined' && typeof sock.dport != 'undefined') {
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
            if (dest) {
              if (dest.socket.readyState === dest.socket.CONNECTING) {
                throw new FS.ErrnoError(7);
              } else {
                throw new FS.ErrnoError(30);
              }
            }
          }
  
          // add the socket to our peer list and set our
          // destination address / port to match
          var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          sock.daddr = peer.addr;
          sock.dport = peer.port;
  
          // always "fail" in non-blocking mode
          throw new FS.ErrnoError(26);
        },
  listen(sock, backlog) {
          if (!ENVIRONMENT_IS_NODE) {
            throw new FS.ErrnoError(138);
          }
          if (sock.server) {
             throw new FS.ErrnoError(28);  // already listening
          }
          var WebSocketServer = require('ws').Server;
          var host = sock.saddr;
          sock.server = new WebSocketServer({
            host,
            port: sock.sport
            // TODO support backlog
          });
          Module['websocket'].emit('listen', sock.stream.fd); // Send Event with listen fd.
  
          sock.server.on('connection', function(ws) {
            if (sock.type === 1) {
              var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
  
              // create a peer on the new socket
              var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
              newsock.daddr = peer.addr;
              newsock.dport = peer.port;
  
              // push to queue for accept to pick up
              sock.pending.push(newsock);
              Module['websocket'].emit('connection', newsock.stream.fd);
            } else {
              // create a peer on the listen socket so calling sendto
              // with the listen socket and an address will resolve
              // to the correct client
              SOCKFS.websocket_sock_ops.createPeer(sock, ws);
              Module['websocket'].emit('connection', sock.stream.fd);
            }
          });
          sock.server.on('close', function() {
            Module['websocket'].emit('close', sock.stream.fd);
            sock.server = null;
          });
          sock.server.on('error', function(error) {
            // Although the ws library may pass errors that may be more descriptive than
            // ECONNREFUSED they are not necessarily the expected error code e.g.
            // ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
            // is still probably the most useful thing to do. This error shouldn't
            // occur in a well written app as errors should get trapped in the compiled
            // app's own getaddrinfo call.
            sock.error = 23; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
            Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'EHOSTUNREACH: Host is unreachable']);
            // don't throw
          });
        },
  accept(listensock) {
          if (!listensock.server || !listensock.pending.length) {
            throw new FS.ErrnoError(28);
          }
          var newsock = listensock.pending.shift();
          newsock.stream.flags = listensock.stream.flags;
          return newsock;
        },
  getname(sock, peer) {
          var addr, port;
          if (peer) {
            if (sock.daddr === undefined || sock.dport === undefined) {
              throw new FS.ErrnoError(53);
            }
            addr = sock.daddr;
            port = sock.dport;
          } else {
            // TODO saddr and sport will be set for bind()'d UDP sockets, but what
            // should we be returning for TCP sockets that've been connect()'d?
            addr = sock.saddr || 0;
            port = sock.sport || 0;
          }
          return { addr, port };
        },
  sendmsg(sock, buffer, offset, length, addr, port) {
          if (sock.type === 2) {
            // connection-less sockets will honor the message address,
            // and otherwise fall back to the bound destination address
            if (addr === undefined || port === undefined) {
              addr = sock.daddr;
              port = sock.dport;
            }
            // if there was no address to fall back to, error out
            if (addr === undefined || port === undefined) {
              throw new FS.ErrnoError(17);
            }
          } else {
            // connection-based sockets will only use the bound
            addr = sock.daddr;
            port = sock.dport;
          }
  
          // find the peer for the destination address
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
  
          // early out if not connected with a connection-based socket
          if (sock.type === 1) {
            if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              throw new FS.ErrnoError(53);
            } else if (dest.socket.readyState === dest.socket.CONNECTING) {
              throw new FS.ErrnoError(6);
            }
          }
  
          // create a copy of the incoming data to send, as the WebSocket API
          // doesn't work entirely with an ArrayBufferView, it'll just send
          // the entire underlying buffer
          if (ArrayBuffer.isView(buffer)) {
            offset += buffer.byteOffset;
            buffer = buffer.buffer;
          }
  
          var data;
            data = buffer.slice(offset, offset + length);
  
          // if we're emulating a connection-less dgram socket and don't have
          // a cached connection, queue the buffer to send upon connect and
          // lie, saying the data was sent now.
          if (sock.type === 2) {
            if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
              // if we're not connected, open a new connection
              if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
              }
              dest.dgram_send_queue.push(data);
              return length;
            }
          }
  
          try {
            // send the actual data
            dest.socket.send(data);
            return length;
          } catch (e) {
            throw new FS.ErrnoError(28);
          }
        },
  recvmsg(sock, length) {
          // http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
          if (sock.type === 1 && sock.server) {
            // tcp servers should not be recv()'ing on the listen socket
            throw new FS.ErrnoError(53);
          }
  
          var queued = sock.recv_queue.shift();
          if (!queued) {
            if (sock.type === 1) {
              var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
  
              if (!dest) {
                // if we have a destination address but are not connected, error out
                throw new FS.ErrnoError(53);
              }
              if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                // return null if the socket has closed
                return null;
              }
              // else, our socket is in a valid state but truly has nothing available
              throw new FS.ErrnoError(6);
            }
            throw new FS.ErrnoError(6);
          }
  
          // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
          // requeued TCP data it'll be an ArrayBufferView
          var queuedLength = queued.data.byteLength || queued.data.length;
          var queuedOffset = queued.data.byteOffset || 0;
          var queuedBuffer = queued.data.buffer || queued.data;
          var bytesRead = Math.min(length, queuedLength);
          var res = {
            buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
            addr: queued.addr,
            port: queued.port
          };
  
          // push back any unread data for TCP connections
          if (sock.type === 1 && bytesRead < queuedLength) {
            var bytesRemaining = queuedLength - bytesRead;
            queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
            sock.recv_queue.unshift(queued);
          }
  
          return res;
        },
  },
  };
  
  var getSocketFromFD = (fd) => {
      var socket = SOCKFS.getSocket(fd);
      if (!socket) throw new FS.ErrnoError(8);
      return socket;
    };
  
  var setErrNo = (value) => {
      HEAP32[((___errno_location())>>2)] = value;
      return value;
    };
  var Sockets = {
  BUFFER_SIZE:10240,
  MAX_BUFFER_SIZE:10485760,
  nextFd:1,
  fds:{
  },
  nextport:1,
  maxport:65535,
  peer:null,
  connections:{
  },
  portmap:{
  },
  localAddr:4261412874,
  addrPool:[33554442,50331658,67108874,83886090,100663306,117440522,134217738,150994954,167772170,184549386,201326602,218103818,234881034],
  };
  
  var inetNtop4 = (addr) => {
      return (addr & 0xff) + '.' + ((addr >> 8) & 0xff) + '.' + ((addr >> 16) & 0xff) + '.' + ((addr >> 24) & 0xff)
    };
  
  
  var inetNtop6 = (ints) => {
      //  ref:  http://www.ietf.org/rfc/rfc2373.txt - section 2.5.4
      //  Format for IPv4 compatible and mapped  128-bit IPv6 Addresses
      //  128-bits are split into eight 16-bit words
      //  stored in network byte order (big-endian)
      //  |                80 bits               | 16 |      32 bits        |
      //  +-----------------------------------------------------------------+
      //  |               10 bytes               |  2 |      4 bytes        |
      //  +--------------------------------------+--------------------------+
      //  +               5 words                |  1 |      2 words        |
      //  +--------------------------------------+--------------------------+
      //  |0000..............................0000|0000|    IPv4 ADDRESS     | (compatible)
      //  +--------------------------------------+----+---------------------+
      //  |0000..............................0000|FFFF|    IPv4 ADDRESS     | (mapped)
      //  +--------------------------------------+----+---------------------+
      var str = "";
      var word = 0;
      var longest = 0;
      var lastzero = 0;
      var zstart = 0;
      var len = 0;
      var i = 0;
      var parts = [
        ints[0] & 0xffff,
        (ints[0] >> 16),
        ints[1] & 0xffff,
        (ints[1] >> 16),
        ints[2] & 0xffff,
        (ints[2] >> 16),
        ints[3] & 0xffff,
        (ints[3] >> 16)
      ];
  
      // Handle IPv4-compatible, IPv4-mapped, loopback and any/unspecified addresses
  
      var hasipv4 = true;
      var v4part = "";
      // check if the 10 high-order bytes are all zeros (first 5 words)
      for (i = 0; i < 5; i++) {
        if (parts[i] !== 0) { hasipv4 = false; break; }
      }
  
      if (hasipv4) {
        // low-order 32-bits store an IPv4 address (bytes 13 to 16) (last 2 words)
        v4part = inetNtop4(parts[6] | (parts[7] << 16));
        // IPv4-mapped IPv6 address if 16-bit value (bytes 11 and 12) == 0xFFFF (6th word)
        if (parts[5] === -1) {
          str = "::ffff:";
          str += v4part;
          return str;
        }
        // IPv4-compatible IPv6 address if 16-bit value (bytes 11 and 12) == 0x0000 (6th word)
        if (parts[5] === 0) {
          str = "::";
          //special case IPv6 addresses
          if (v4part === "0.0.0.0") v4part = ""; // any/unspecified address
          if (v4part === "0.0.0.1") v4part = "1";// loopback address
          str += v4part;
          return str;
        }
      }
  
      // Handle all other IPv6 addresses
  
      // first run to find the longest contiguous zero words
      for (word = 0; word < 8; word++) {
        if (parts[word] === 0) {
          if (word - lastzero > 1) {
            len = 0;
          }
          lastzero = word;
          len++;
        }
        if (len > longest) {
          longest = len;
          zstart = word - longest + 1;
        }
      }
  
      for (word = 0; word < 8; word++) {
        if (longest > 1) {
          // compress contiguous zeros - to produce "::"
          if (parts[word] === 0 && word >= zstart && word < (zstart + longest) ) {
            if (word === zstart) {
              str += ":";
              if (zstart === 0) str += ":"; //leading zeros case
            }
            continue;
          }
        }
        // converts 16-bit words from big-endian to little-endian before converting to hex string
        str += Number(_ntohs(parts[word] & 0xffff)).toString(16);
        str += word < 7 ? ":" : "";
      }
      return str;
    };
  
  var readSockaddr = (sa, salen) => {
      // family / port offsets are common to both sockaddr_in and sockaddr_in6
      var family = HEAP16[((sa)>>1)];
      var port = _ntohs(HEAPU16[(((sa)+(2))>>1)]);
      var addr;
  
      switch (family) {
        case 2:
          if (salen !== 16) {
            return { errno: 28 };
          }
          addr = HEAP32[(((sa)+(4))>>2)];
          addr = inetNtop4(addr);
          break;
        case 10:
          if (salen !== 28) {
            return { errno: 28 };
          }
          addr = [
            HEAP32[(((sa)+(8))>>2)],
            HEAP32[(((sa)+(12))>>2)],
            HEAP32[(((sa)+(16))>>2)],
            HEAP32[(((sa)+(20))>>2)]
          ];
          addr = inetNtop6(addr);
          break;
        default:
          return { errno: 5 };
      }
  
      return { family: family, addr: addr, port: port };
    };
  
  
  var inetPton4 = (str) => {
      var b = str.split('.');
      for (var i = 0; i < 4; i++) {
        var tmp = Number(b[i]);
        if (isNaN(tmp)) return null;
        b[i] = tmp;
      }
      return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    };
  
  
  /** @suppress {checkTypes} */
  var jstoi_q = (str) => parseInt(str);
  var inetPton6 = (str) => {
      var words;
      var w, offset, z, i;
      /* http://home.deds.nl/~aeron/regex/ */
      var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
      var parts = [];
      if (!valid6regx.test(str)) {
        return null;
      }
      if (str === "::") {
        return [0, 0, 0, 0, 0, 0, 0, 0];
      }
      // Z placeholder to keep track of zeros when splitting the string on ":"
      if (str.startsWith("::")) {
        str = str.replace("::", "Z:"); // leading zeros case
      } else {
        str = str.replace("::", ":Z:");
      }
  
      if (str.indexOf(".") > 0) {
        // parse IPv4 embedded stress
        str = str.replace(new RegExp('[.]', 'g'), ":");
        words = str.split(":");
        words[words.length-4] = jstoi_q(words[words.length-4]) + jstoi_q(words[words.length-3])*256;
        words[words.length-3] = jstoi_q(words[words.length-2]) + jstoi_q(words[words.length-1])*256;
        words = words.slice(0, words.length-2);
      } else {
        words = str.split(":");
      }
  
      offset = 0; z = 0;
      for (w=0; w < words.length; w++) {
        if (typeof words[w] == 'string') {
          if (words[w] === 'Z') {
            // compressed zeros - write appropriate number of zero words
            for (z = 0; z < (8 - words.length+1); z++) {
              parts[w+z] = 0;
            }
            offset = z-1;
          } else {
            // parse hex to field to 16-bit value and write it in network byte-order
            parts[w+offset] = _htons(parseInt(words[w],16));
          }
        } else {
          // parsed IPv4 words
          parts[w+offset] = words[w];
        }
      }
      return [
        (parts[1] << 16) | parts[0],
        (parts[3] << 16) | parts[2],
        (parts[5] << 16) | parts[4],
        (parts[7] << 16) | parts[6]
      ];
    };
  var DNS = {
  address_map:{
  id:1,
  addrs:{
  },
  names:{
  },
  },
  lookup_name(name) {
        // If the name is already a valid ipv4 / ipv6 address, don't generate a fake one.
        var res = inetPton4(name);
        if (res !== null) {
          return name;
        }
        res = inetPton6(name);
        if (res !== null) {
          return name;
        }
  
        // See if this name is already mapped.
        var addr;
  
        if (DNS.address_map.addrs[name]) {
          addr = DNS.address_map.addrs[name];
        } else {
          var id = DNS.address_map.id++;
          assert(id < 65535, 'exceeded max address mappings of 65535');
  
          addr = '172.29.' + (id & 0xff) + '.' + (id & 0xff00);
  
          DNS.address_map.names[addr] = name;
          DNS.address_map.addrs[name] = addr;
        }
  
        return addr;
      },
  lookup_addr(addr) {
        if (DNS.address_map.names[addr]) {
          return DNS.address_map.names[addr];
        }
  
        return null;
      },
  };
  /** @param {boolean=} allowNull */
  var getSocketAddress = (addrp, addrlen, allowNull) => {
      if (allowNull && addrp === 0) return null;
      var info = readSockaddr(addrp, addrlen);
      if (info.errno) throw new FS.ErrnoError(info.errno);
      info.addr = DNS.lookup_addr(info.addr) || info.addr;
      return info;
    };
  
  function ___syscall_connect(fd, addr, addrlen, d1, d2, d3) {
  try {
  
      var sock = getSocketFromFD(fd);
      var info = getSocketAddress(addr, addrlen);
      sock.sock_ops.connect(sock, info.addr, info.port);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.createStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 5: {
          var arg = SYSCALLS.getp();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 6:
        case 7:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -28; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fcntl() returns that, and we set errno ourselves.
          setErrNo(28);
          return -1;
        default: {
          return -28;
        }
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21505: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcgets) {
            var termios = stream.tty.ops.ioctl_tcgets(stream);
            var argp = SYSCALLS.getp();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;
            for (var i = 0; i < 32; i++) {
              HEAP8[(((argp + i)+(17))>>0)] = termios.c_cc[i] || 0;
            }
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcsets) {
            var argp = SYSCALLS.getp();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(((argp + i)+(17))>>0)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = SYSCALLS.getp();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.getp();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = SYSCALLS.getp();
            HEAP16[((argp)>>1)] = winsize[0];
            HEAP16[(((argp)+(2))>>1)] = winsize[1];
          }
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        case 21515: {
          if (!stream.tty) return -59;
          return 0;
        }
        default: return -28; // not supported
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  
  
  
  
  
  /** @param {number=} addrlen */
  var writeSockaddr = (sa, family, addr, port, addrlen) => {
      switch (family) {
        case 2:
          addr = inetPton4(addr);
          zeroMemory(sa, 16);
          if (addrlen) {
            HEAP32[((addrlen)>>2)] = 16;
          }
          HEAP16[((sa)>>1)] = family;
          HEAP32[(((sa)+(4))>>2)] = addr;
          HEAP16[(((sa)+(2))>>1)] = _htons(port);
          break;
        case 10:
          addr = inetPton6(addr);
          zeroMemory(sa, 28);
          if (addrlen) {
            HEAP32[((addrlen)>>2)] = 28;
          }
          HEAP32[((sa)>>2)] = family;
          HEAP32[(((sa)+(8))>>2)] = addr[0];
          HEAP32[(((sa)+(12))>>2)] = addr[1];
          HEAP32[(((sa)+(16))>>2)] = addr[2];
          HEAP32[(((sa)+(20))>>2)] = addr[3];
          HEAP16[(((sa)+(2))>>1)] = _htons(port);
          break;
        default:
          return 5;
      }
      return 0;
    };
  
  
  function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
  try {
  
      var sock = getSocketFromFD(fd);
      var msg = sock.sock_ops.recvmsg(sock, len);
      if (!msg) return 0; // socket is closed
      if (addr) {
        var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port, addrlen);
        assert(!errno);
      }
      HEAPU8.set(msg.buffer, buf);
      return msg.buffer.byteLength;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  
  
  function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
  try {
  
      var sock = getSocketFromFD(fd);
      var dest = getSocketAddress(addr, addr_len, true);
      if (!dest) {
        // send, no address provided
        return FS.write(sock.stream, HEAP8, message, length);
      }
      // sendto an address
      return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port);
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  
  function ___syscall_socket(domain, type, protocol) {
  try {
  
      var sock = SOCKFS.createSocket(domain, type, protocol);
      assert(sock.stream.fd < 64); // XXX ? select() assumes socket fd values are in 0..63
      return sock.stream.fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var isLeapYear = (year) => {
        return year%4 === 0 && (year%100 !== 0 || year%400 === 0);
    };
  
  var MONTH_DAYS_LEAP_CUMULATIVE = [0,31,60,91,121,152,182,213,244,274,305,335];
  
  var MONTH_DAYS_REGULAR_CUMULATIVE = [0,31,59,90,120,151,181,212,243,273,304,334];
  var ydayFromDate = (date) => {
      var leap = isLeapYear(date.getFullYear());
      var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
      var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1; // -1 since it's days since Jan 1
  
      return yday;
    };
  
  var convertI32PairToI53Checked = (lo, hi) => {
      assert(lo == (lo >>> 0) || lo == (lo|0)); // lo should either be a i32 or a u32
      assert(hi === (hi|0));                    // hi should be a i32
      return ((hi + 0x200000) >>> 0 < 0x400001 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;
    };
  function __localtime_js(time_low, time_high,tmPtr) {
    var time = convertI32PairToI53Checked(time_low, time_high);;
  
    
      var date = new Date(time*1000);
      HEAP32[((tmPtr)>>2)] = date.getSeconds();
      HEAP32[(((tmPtr)+(4))>>2)] = date.getMinutes();
      HEAP32[(((tmPtr)+(8))>>2)] = date.getHours();
      HEAP32[(((tmPtr)+(12))>>2)] = date.getDate();
      HEAP32[(((tmPtr)+(16))>>2)] = date.getMonth();
      HEAP32[(((tmPtr)+(20))>>2)] = date.getFullYear()-1900;
      HEAP32[(((tmPtr)+(24))>>2)] = date.getDay();
  
      var yday = ydayFromDate(date)|0;
      HEAP32[(((tmPtr)+(28))>>2)] = yday;
      HEAP32[(((tmPtr)+(36))>>2)] = -(date.getTimezoneOffset() * 60);
  
      // Attention: DST is in December in South, and some regions don't have DST at all.
      var start = new Date(date.getFullYear(), 0, 1);
      var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
      var winterOffset = start.getTimezoneOffset();
      var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset))|0;
      HEAP32[(((tmPtr)+(32))>>2)] = dst;
    ;
  }

  
  
  var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };
  var __tzset_js = (timezone, daylight, tzname) => {
      // TODO: Use (malleable) environment variables instead of system settings.
      var currentYear = new Date().getFullYear();
      var winter = new Date(currentYear, 0, 1);
      var summer = new Date(currentYear, 6, 1);
      var winterOffset = winter.getTimezoneOffset();
      var summerOffset = summer.getTimezoneOffset();
  
      // Local standard timezone offset. Local standard time is not adjusted for daylight savings.
      // This code uses the fact that getTimezoneOffset returns a greater value during Standard Time versus Daylight Saving Time (DST).
      // Thus it determines the expected output during Standard Time, and it compares whether the output of the given date the same (Standard) or less (DST).
      var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  
      // timezone is specified as seconds west of UTC ("The external variable
      // `timezone` shall be set to the difference, in seconds, between
      // Coordinated Universal Time (UTC) and local standard time."), the same
      // as returned by stdTimezoneOffset.
      // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
      HEAPU32[((timezone)>>2)] = stdTimezoneOffset * 60;
  
      HEAP32[((daylight)>>2)] = Number(winterOffset != summerOffset);
  
      function extractZone(date) {
        var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
        return match ? match[1] : "GMT";
      };
      var winterName = extractZone(winter);
      var summerName = extractZone(summer);
      var winterNamePtr = stringToNewUTF8(winterName);
      var summerNamePtr = stringToNewUTF8(summerName);
      if (summerOffset < winterOffset) {
        // Northern hemisphere
        HEAPU32[((tzname)>>2)] = winterNamePtr;
        HEAPU32[(((tzname)+(4))>>2)] = summerNamePtr;
      } else {
        HEAPU32[((tzname)>>2)] = summerNamePtr;
        HEAPU32[(((tzname)+(4))>>2)] = winterNamePtr;
      }
    };

  var _abort = () => {
      abort('native code called abort()');
    };

  var readEmAsmArgsArray = [];
  var readEmAsmArgs = (sigPtr, buf) => {
      // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readEmAsmArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readEmAsmArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while (ch = HEAPU8[sigPtr++]) {
        var chr = String.fromCharCode(ch);
        var validChars = ['d', 'f', 'i', 'p'];
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        wide &= (ch != 112);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? HEAPU32[((buf)>>2)] :
          ch == 105 ?
            HEAP32[((buf)>>2)] :
            HEAPF64[((buf)>>3)]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };
  var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
      return ASM_CONSTS[code].apply(null, args);
    };
  var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
      return runEmAsmFunction(code, sigPtr, argbuf);
    };

  var _emscripten_date_now = () => Date.now();

  var _emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var growMemory = (size) => {
      var b = wasmMemory.buffer;
      var pages = (size - b.byteLength + 65535) / 65536;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${b.byteLength} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    };
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      var alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  var ENV = {
  };
  
  var getExecutableName = () => {
      return thisProgram || './this.program';
    };
  var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        // Default values.
        // Browser language detection #8751
        var lang = ((typeof navigator == 'object' && navigator.languages && navigator.languages[0]) || 'C').replace('-', '_') + '.UTF-8';
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          'LANG': lang,
          '_': getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          // x is a key in ENV; if ENV[x] is undefined, that means it was
          // explicitly set to be so. We allow user code to do that to
          // force variables with default values to remain unset.
          if (ENV[x] === undefined) delete env[x];
          else env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(`${x}=${env[x]}`);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    };
  
  var stringToAscii = (str, buffer) => {
      for (var i = 0; i < str.length; ++i) {
        assert(str.charCodeAt(i) === (str.charCodeAt(i) & 0xff));
        HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
      }
      // Null-terminate the string
      HEAP8[((buffer)>>0)] = 0;
    };
  
  var _environ_get = (__environ, environ_buf) => {
      var bufSize = 0;
      getEnvStrings().forEach((string, i) => {
        var ptr = environ_buf + bufSize;
        HEAPU32[(((__environ)+(i*4))>>2)] = ptr;
        stringToAscii(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    };

  
  var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
      var strings = getEnvStrings();
      HEAPU32[((penviron_count)>>2)] = strings.length;
      var bufSize = 0;
      strings.forEach((string) => bufSize += string.length + 1);
      HEAPU32[((penviron_buf_size)>>2)] = bufSize;
      return 0;
    };

  function _fd_close(fd) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  /** @param {number=} offset */
  var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break; // nothing more to read
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_read(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doReadv(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  
  function _fd_seek(fd,offset_low, offset_high,whence,newOffset) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble=stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  /** @param {number=} offset */
  var doWritev = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_write(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doWritev(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  var _getentropy = (buffer, size) => {
      randomFill(HEAPU8.subarray(buffer, buffer + size));
      return 0;
    };

  
  var arraySum = (array, index) => {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]) {
        // no-op
      }
      return sum;
    };
  
  
  var MONTH_DAYS_LEAP = [31,29,31,30,31,30,31,31,30,31,30,31];
  
  var MONTH_DAYS_REGULAR = [31,28,31,30,31,30,31,31,30,31,30,31];
  var addDays = (date, days) => {
      var newDate = new Date(date.getTime());
      while (days > 0) {
        var leap = isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    };
  
  
  
  
  var writeArrayToMemory = (array, buffer) => {
      assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
      HEAP8.set(array, buffer);
    };
  
  var _strftime = (s, maxsize, format, tm) => {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAPU32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
      };
  
      var pattern = UTF8ToString(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S',                 // Replaced by the locale's appropriate time representation
        // Modified Conversion Specifiers
        '%Ec': '%c',                      // Replaced by the locale's alternative appropriate date and time representation.
        '%EC': '%C',                      // Replaced by the name of the base year (period) in the locale's alternative representation.
        '%Ex': '%m/%d/%y',                // Replaced by the locale's alternative date representation.
        '%EX': '%H:%M:%S',                // Replaced by the locale's alternative time representation.
        '%Ey': '%y',                      // Replaced by the offset from %EC (year only) in the locale's alternative representation.
        '%EY': '%Y',                      // Replaced by the full alternative year representation.
        '%Od': '%d',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading zeros if there is any alternative symbol for zero; otherwise, with leading <space> characters.
        '%Oe': '%e',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading <space> characters.
        '%OH': '%H',                      // Replaced by the hour (24-hour clock) using the locale's alternative numeric symbols.
        '%OI': '%I',                      // Replaced by the hour (12-hour clock) using the locale's alternative numeric symbols.
        '%Om': '%m',                      // Replaced by the month using the locale's alternative numeric symbols.
        '%OM': '%M',                      // Replaced by the minutes using the locale's alternative numeric symbols.
        '%OS': '%S',                      // Replaced by the seconds using the locale's alternative numeric symbols.
        '%Ou': '%u',                      // Replaced by the weekday as a number in the locale's alternative representation (Monday=1).
        '%OU': '%U',                      // Replaced by the week number of the year (Sunday as the first day of the week, rules corresponding to %U ) using the locale's alternative numeric symbols.
        '%OV': '%V',                      // Replaced by the week number of the year (Monday as the first day of the week, rules corresponding to %V ) using the locale's alternative numeric symbols.
        '%Ow': '%w',                      // Replaced by the number of the weekday (Sunday=0) using the locale's alternative numeric symbols.
        '%OW': '%W',                      // Replaced by the week number of the year (Monday as the first day of the week) using the locale's alternative numeric symbols.
        '%Oy': '%y',                      // Replaced by the year (offset from %C ) using the locale's alternative numeric symbols.
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value == 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      }
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      }
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        }
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      }
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      }
  
      function getWeekBasedYear(date) {
          var thisDate = addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            }
            return thisDate.getFullYear();
          }
          return thisDate.getFullYear()-1;
      }
  
      var EXPANSION_RULES_2 = {
        '%a': (date) => WEEKDAYS[date.tm_wday].substring(0,3) ,
        '%A': (date) => WEEKDAYS[date.tm_wday],
        '%b': (date) => MONTHS[date.tm_mon].substring(0,3),
        '%B': (date) => MONTHS[date.tm_mon],
        '%C': (date) => {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': (date) => leadingNulls(date.tm_mday, 2),
        '%e': (date) => leadingSomething(date.tm_mday, 2, ' '),
        '%g': (date) => {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year.
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes
          // January 4th, which is also the week that includes the first Thursday of the year, and
          // is also the first week that contains at least four days in the year.
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of
          // the last week of the preceding year; thus, for Saturday 2nd January 1999,
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th,
          // or 31st is a Monday, it and any following days are part of week 1 of the following year.
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
  
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': (date) => getWeekBasedYear(date),
        '%H': (date) => leadingNulls(date.tm_hour, 2),
        '%I': (date) => {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': (date) => {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday + arraySum(isLeapYear(date.tm_year+1900) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': (date) => leadingNulls(date.tm_mon+1, 2),
        '%M': (date) => leadingNulls(date.tm_min, 2),
        '%n': () => '\n',
        '%p': (date) => {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          }
          return 'PM';
        },
        '%S': (date) => leadingNulls(date.tm_sec, 2),
        '%t': () => '\t',
        '%u': (date) => date.tm_wday || 7,
        '%U': (date) => {
          var days = date.tm_yday + 7 - date.tm_wday;
          return leadingNulls(Math.floor(days / 7), 2);
        },
        '%V': (date) => {
          // Replaced by the week number of the year (Monday as the first day of the week)
          // as a decimal number [01,53]. If the week containing 1 January has four
          // or more days in the new year, then it is considered week 1.
          // Otherwise, it is the last week of the previous year, and the next week is week 1.
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var val = Math.floor((date.tm_yday + 7 - (date.tm_wday + 6) % 7 ) / 7);
          // If 1 Jan is just 1-3 days past Monday, the previous week
          // is also in this year.
          if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
            val++;
          }
          if (!val) {
            val = 52;
            // If 31 December of prev year a Thursday, or Friday of a
            // leap year, then the prev year has 53 weeks.
            var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
            if (dec31 == 4 || (dec31 == 5 && isLeapYear(date.tm_year%400-1))) {
              val++;
            }
          } else if (val == 53) {
            // If 1 January is not a Thursday, and not a Wednesday of a
            // leap year, then this year has only 52 weeks.
            var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
            if (jan1 != 4 && (jan1 != 3 || !isLeapYear(date.tm_year)))
              val = 1;
          }
          return leadingNulls(val, 2);
        },
        '%w': (date) => date.tm_wday,
        '%W': (date) => {
          var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
          return leadingNulls(Math.floor(days / 7), 2);
        },
        '%y': (date) => {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
        '%Y': (date) => date.tm_year+1900,
        '%z': (date) => {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': (date) => date.tm_zone,
        '%%': () => '%'
      };
  
      // Replace %% with a pair of NULLs (which cannot occur in a C string), then
      // re-inject them after processing.
      pattern = pattern.replace(/%%/g, '\0\0')
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.includes(rule)) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
      pattern = pattern.replace(/\0\0/g, '%')
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    };

  var _strftime_l = (s, maxsize, format, tm, loc) => {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    };

  var getCFunc = (ident) => {
      var func = Module['_' + ident]; // closure exported function
      assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
      return func;
    };
  
  
  
  
  
    /**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Arguments|Array=} args
     * @param {Object=} opts
     */
  var ccall = (ident, returnType, argTypes, args, opts) => {
      // For fast lookup of conversion functions
      var toC = {
        'string': (str) => {
          var ret = 0;
          if (str !== null && str !== undefined && str !== 0) { // null string
            // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
            ret = stringToUTF8OnStack(str);
          }
          return ret;
        },
        'array': (arr) => {
          var ret = stackAlloc(arr.length);
          writeArrayToMemory(arr, ret);
          return ret;
        }
      };
  
      function convertReturnValue(ret) {
        if (returnType === 'string') {
          
          return UTF8ToString(ret);
        }
        if (returnType === 'boolean') return Boolean(ret);
        return ret;
      }
  
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      assert(returnType !== 'array', 'Return type should not be "array".');
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret);
      }
  
      ret = onDone(ret);
      return ret;
    };
  
    /**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */
  var cwrap = (ident, returnType, argTypes, opts) => {
      return function() {
        return ccall(ident, returnType, argTypes, arguments, opts);
      }
    };



  var UTF32ToString = (ptr, maxBytesToRead) => {
      assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
      var i = 0;
  
      var str = '';
      // If maxBytesToRead is not passed explicitly, it will be undefined, and this
      // will always evaluate to true. This saves on code size.
      while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
        if (utf32 == 0) break;
        ++i;
        // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        if (utf32 >= 0x10000) {
          var ch = utf32 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        } else {
          str += String.fromCharCode(utf32);
        }
      }
      return str;
    };




  var uleb128Encode = (n, target) => {
      assert(n < 16384);
      if (n < 128) {
        target.push(n);
      } else {
        target.push((n % 128) | 128, n >> 7);
      }
    };
  
  var sigToWasmTypes = (sig) => {
      assert(!sig.includes('j'), 'i64 not permitted in function signatures when WASM_BIGINT is disabled');
      var typeNames = {
        'i': 'i32',
        'j': 'i64',
        'f': 'f32',
        'd': 'f64',
        'e': 'externref',
        'p': 'i32',
      };
      var type = {
        parameters: [],
        results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
      };
      for (var i = 1; i < sig.length; ++i) {
        assert(sig[i] in typeNames, 'invalid signature char: ' + sig[i]);
        type.parameters.push(typeNames[sig[i]]);
      }
      return type;
    };
  
  var generateFuncType = (sig, target) => {
      var sigRet = sig.slice(0, 1);
      var sigParam = sig.slice(1);
      var typeCodes = {
        'i': 0x7f, // i32
        'p': 0x7f, // i32
        'j': 0x7e, // i64
        'f': 0x7d, // f32
        'd': 0x7c, // f64
        'e': 0x6f, // externref
      };
  
      // Parameters, length + signatures
      target.push(0x60 /* form: func */);
      uleb128Encode(sigParam.length, target);
      for (var i = 0; i < sigParam.length; ++i) {
        assert(sigParam[i] in typeCodes, 'invalid signature char: ' + sigParam[i]);
        target.push(typeCodes[sigParam[i]]);
      }
  
      // Return values, length + signatures
      // With no multi-return in MVP, either 0 (void) or 1 (anything else)
      if (sigRet == 'v') {
        target.push(0x00);
      } else {
        target.push(0x01, typeCodes[sigRet]);
      }
    };
  var convertJsFunctionToWasm = (func, sig) => {
  
      assert(!sig.includes('j'), 'i64 not permitted in function signatures when WASM_BIGINT is disabled');
  
      // If the type reflection proposal is available, use the new
      // "WebAssembly.Function" constructor.
      // Otherwise, construct a minimal wasm module importing the JS function and
      // re-exporting it.
      if (typeof WebAssembly.Function == "function") {
        return new WebAssembly.Function(sigToWasmTypes(sig), func);
      }
  
      // The module is static, with the exception of the type section, which is
      // generated based on the signature passed in.
      var typeSectionBody = [
        0x01, // count: 1
      ];
      generateFuncType(sig, typeSectionBody);
  
      // Rest of the module is static
      var bytes = [
        0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
        0x01, 0x00, 0x00, 0x00, // version: 1
        0x01, // Type section code
      ];
      // Write the overall length of the type section followed by the body
      uleb128Encode(typeSectionBody.length, bytes);
      bytes.push.apply(bytes, typeSectionBody);
  
      // The rest of the module is static
      bytes.push(
        0x02, 0x07, // import section
          // (import "e" "f" (func 0 (type 0)))
          0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
        0x07, 0x05, // export section
          // (export "f" (func 0 (type 0)))
          0x01, 0x01, 0x66, 0x00, 0x00,
      );
  
      // We can compile this wasm module synchronously because it is very small.
      // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
      var module = new WebAssembly.Module(new Uint8Array(bytes));
      var instance = new WebAssembly.Instance(module, { 'e': { 'f': func } });
      var wrappedFunc = instance.exports['f'];
      return wrappedFunc;
    };
  
  var wasmTableMirror = [];
  
  var wasmTable;
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
      return func;
    };
  
  var updateTableMap = (offset, count) => {
      if (functionsInTableMap) {
        for (var i = offset; i < offset + count; i++) {
          var item = getWasmTableEntry(i);
          // Ignore null values.
          if (item) {
            functionsInTableMap.set(item, i);
          }
        }
      }
    };
  
  var functionsInTableMap;
  
  var getFunctionAddress = (func) => {
      // First, create the map if this is the first use.
      if (!functionsInTableMap) {
        functionsInTableMap = new WeakMap();
        updateTableMap(0, wasmTable.length);
      }
      return functionsInTableMap.get(func) || 0;
    };
  
  
  var freeTableIndexes = [];
  
  var getEmptyTableSlot = () => {
      // Reuse a free index if there is one, otherwise grow.
      if (freeTableIndexes.length) {
        return freeTableIndexes.pop();
      }
      // Grow the table
      try {
        wasmTable.grow(1);
      } catch (err) {
        if (!(err instanceof RangeError)) {
          throw err;
        }
        throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
      }
      return wasmTable.length - 1;
    };
  
  
  
  var setWasmTableEntry = (idx, func) => {
      wasmTable.set(idx, func);
      // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overriden to return wrapped
      // functions so we need to call it here to retrieve the potential wrapper correctly
      // instead of just storing 'func' directly into wasmTableMirror
      wasmTableMirror[idx] = wasmTable.get(idx);
    };
  
  /** @param {string=} sig */
  var addFunction = (func, sig) => {
      assert(typeof func != 'undefined');
      // Check if the function is already in the table, to ensure each function
      // gets a unique index.
      var rtn = getFunctionAddress(func);
      if (rtn) {
        return rtn;
      }
  
      // It's not in the table, add it now.
  
      var ret = getEmptyTableSlot();
  
      // Set the new value.
      try {
        // Attempting to call this with JS function will cause of table.set() to fail
        setWasmTableEntry(ret, func);
      } catch (err) {
        if (!(err instanceof TypeError)) {
          throw err;
        }
        assert(typeof sig != 'undefined', 'Missing signature argument to addFunction: ' + func);
        var wrapped = convertJsFunctionToWasm(func, sig);
        setWasmTableEntry(ret, wrapped);
      }
  
      functionsInTableMap.set(func, ret);
  
      return ret;
    };

  
  
  
  
  var removeFunction = (index) => {
      functionsInTableMap.delete(getWasmTableEntry(index));
      setWasmTableEntry(index, null);
      freeTableIndexes.push(index);
    };

  var FSNode = /** @constructor */ function(parent, name, mode, rdev) {
    if (!parent) {
      parent = this;  // root node sets parent to itself
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
  };
  var readMode = 292/*292*/ | 73/*73*/;
  var writeMode = 146/*146*/;
  Object.defineProperties(FSNode.prototype, {
   read: {
    get: /** @this{FSNode} */function() {
     return (this.mode & readMode) === readMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= readMode : this.mode &= ~readMode;
    }
   },
   write: {
    get: /** @this{FSNode} */function() {
     return (this.mode & writeMode) === writeMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= writeMode : this.mode &= ~writeMode;
    }
   },
   isFolder: {
    get: /** @this{FSNode} */function() {
     return FS.isDir(this.mode);
    }
   },
   isDevice: {
    get: /** @this{FSNode} */function() {
     return FS.isChrdev(this.mode);
    }
   }
  });
  FS.FSNode = FSNode;
  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.staticInit();;
ERRNO_CODES = {
      'EPERM': 63,
      'ENOENT': 44,
      'ESRCH': 71,
      'EINTR': 27,
      'EIO': 29,
      'ENXIO': 60,
      'E2BIG': 1,
      'ENOEXEC': 45,
      'EBADF': 8,
      'ECHILD': 12,
      'EAGAIN': 6,
      'EWOULDBLOCK': 6,
      'ENOMEM': 48,
      'EACCES': 2,
      'EFAULT': 21,
      'ENOTBLK': 105,
      'EBUSY': 10,
      'EEXIST': 20,
      'EXDEV': 75,
      'ENODEV': 43,
      'ENOTDIR': 54,
      'EISDIR': 31,
      'EINVAL': 28,
      'ENFILE': 41,
      'EMFILE': 33,
      'ENOTTY': 59,
      'ETXTBSY': 74,
      'EFBIG': 22,
      'ENOSPC': 51,
      'ESPIPE': 70,
      'EROFS': 69,
      'EMLINK': 34,
      'EPIPE': 64,
      'EDOM': 18,
      'ERANGE': 68,
      'ENOMSG': 49,
      'EIDRM': 24,
      'ECHRNG': 106,
      'EL2NSYNC': 156,
      'EL3HLT': 107,
      'EL3RST': 108,
      'ELNRNG': 109,
      'EUNATCH': 110,
      'ENOCSI': 111,
      'EL2HLT': 112,
      'EDEADLK': 16,
      'ENOLCK': 46,
      'EBADE': 113,
      'EBADR': 114,
      'EXFULL': 115,
      'ENOANO': 104,
      'EBADRQC': 103,
      'EBADSLT': 102,
      'EDEADLOCK': 16,
      'EBFONT': 101,
      'ENOSTR': 100,
      'ENODATA': 116,
      'ETIME': 117,
      'ENOSR': 118,
      'ENONET': 119,
      'ENOPKG': 120,
      'EREMOTE': 121,
      'ENOLINK': 47,
      'EADV': 122,
      'ESRMNT': 123,
      'ECOMM': 124,
      'EPROTO': 65,
      'EMULTIHOP': 36,
      'EDOTDOT': 125,
      'EBADMSG': 9,
      'ENOTUNIQ': 126,
      'EBADFD': 127,
      'EREMCHG': 128,
      'ELIBACC': 129,
      'ELIBBAD': 130,
      'ELIBSCN': 131,
      'ELIBMAX': 132,
      'ELIBEXEC': 133,
      'ENOSYS': 52,
      'ENOTEMPTY': 55,
      'ENAMETOOLONG': 37,
      'ELOOP': 32,
      'EOPNOTSUPP': 138,
      'EPFNOSUPPORT': 139,
      'ECONNRESET': 15,
      'ENOBUFS': 42,
      'EAFNOSUPPORT': 5,
      'EPROTOTYPE': 67,
      'ENOTSOCK': 57,
      'ENOPROTOOPT': 50,
      'ESHUTDOWN': 140,
      'ECONNREFUSED': 14,
      'EADDRINUSE': 3,
      'ECONNABORTED': 13,
      'ENETUNREACH': 40,
      'ENETDOWN': 38,
      'ETIMEDOUT': 73,
      'EHOSTDOWN': 142,
      'EHOSTUNREACH': 23,
      'EINPROGRESS': 26,
      'EALREADY': 7,
      'EDESTADDRREQ': 17,
      'EMSGSIZE': 35,
      'EPROTONOSUPPORT': 66,
      'ESOCKTNOSUPPORT': 137,
      'EADDRNOTAVAIL': 4,
      'ENETRESET': 39,
      'EISCONN': 30,
      'ENOTCONN': 53,
      'ETOOMANYREFS': 141,
      'EUSERS': 136,
      'EDQUOT': 19,
      'ESTALE': 72,
      'ENOTSUP': 138,
      'ENOMEDIUM': 148,
      'EILSEQ': 25,
      'EOVERFLOW': 61,
      'ECANCELED': 11,
      'ENOTRECOVERABLE': 56,
      'EOWNERDEAD': 62,
      'ESTRPIPE': 135,
    };;
function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}
var wasmImports = {
  /** @export */
  __assert_fail: ___assert_fail,
  /** @export */
  __cxa_throw: ___cxa_throw,
  /** @export */
  __syscall__newselect: ___syscall__newselect,
  /** @export */
  __syscall_connect: ___syscall_connect,
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_recvfrom: ___syscall_recvfrom,
  /** @export */
  __syscall_sendto: ___syscall_sendto,
  /** @export */
  __syscall_socket: ___syscall_socket,
  /** @export */
  _localtime_js: __localtime_js,
  /** @export */
  _tzset_js: __tzset_js,
  /** @export */
  abort: _abort,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_date_now: _emscripten_date_now,
  /** @export */
  emscripten_memcpy_js: _emscripten_memcpy_js,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  environ_get: _environ_get,
  /** @export */
  environ_sizes_get: _environ_sizes_get,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  getentropy: _getentropy,
  /** @export */
  strftime: _strftime,
  /** @export */
  strftime_l: _strftime_l
};
var wasmExports = createWasm();
var ___wasm_call_ctors = createExportWrapper('__wasm_call_ctors');
var _PhotonPeerCreate = Module['_PhotonPeerCreate'] = createExportWrapper('PhotonPeerCreate');
var _free = Module['_free'] = createExportWrapper('free');
var _malloc = Module['_malloc'] = createExportWrapper('malloc');
var _PhotonPeerDestroy = Module['_PhotonPeerDestroy'] = createExportWrapper('PhotonPeerDestroy');
var _PhotonPeerConnect = Module['_PhotonPeerConnect'] = createExportWrapper('PhotonPeerConnect');
var _PhotonPeerDisconnect = Module['_PhotonPeerDisconnect'] = createExportWrapper('PhotonPeerDisconnect');
var _PhotonPeerState = Module['_PhotonPeerState'] = createExportWrapper('PhotonPeerState');
var _PhotonPeerService = Module['_PhotonPeerService'] = createExportWrapper('PhotonPeerService');
var _PhotonPeerSetDebugOutputLevel = Module['_PhotonPeerSetDebugOutputLevel'] = createExportWrapper('PhotonPeerSetDebugOutputLevel');
var _PhotonPeerOpCustom = Module['_PhotonPeerOpCustom'] = createExportWrapper('PhotonPeerOpCustom');
var _PhotonPeerFetchServerTimestamp = Module['_PhotonPeerFetchServerTimestamp'] = createExportWrapper('PhotonPeerFetchServerTimestamp');
var _PhotonPeerGetServerTime = Module['_PhotonPeerGetServerTime'] = createExportWrapper('PhotonPeerGetServerTime');
var _PhotonPeerGetRoundTripTime = Module['_PhotonPeerGetRoundTripTime'] = createExportWrapper('PhotonPeerGetRoundTripTime');
var _PhotonOperationRequestCreate = Module['_PhotonOperationRequestCreate'] = createExportWrapper('PhotonOperationRequestCreate');
var _PhotonOperationRequestDestroy = Module['_PhotonOperationRequestDestroy'] = createExportWrapper('PhotonOperationRequestDestroy');
var _PhotonOperationRequestSetParam = Module['_PhotonOperationRequestSetParam'] = createExportWrapper('PhotonOperationRequestSetParam');
var _PhotonTypesByte = Module['_PhotonTypesByte'] = createExportWrapper('PhotonTypesByte');
var _PhotonTypesShort = Module['_PhotonTypesShort'] = createExportWrapper('PhotonTypesShort');
var _PhotonTypesInt = Module['_PhotonTypesInt'] = createExportWrapper('PhotonTypesInt');
var _PhotonTypesLong = Module['_PhotonTypesLong'] = createExportWrapper('PhotonTypesLong');
var _PhotonTypesFloat = Module['_PhotonTypesFloat'] = createExportWrapper('PhotonTypesFloat');
var _PhotonTypesDouble = Module['_PhotonTypesDouble'] = createExportWrapper('PhotonTypesDouble');
var _PhotonTypesBool = Module['_PhotonTypesBool'] = createExportWrapper('PhotonTypesBool');
var _PhotonTypesString = Module['_PhotonTypesString'] = createExportWrapper('PhotonTypesString');
var _PhotonTypesTable = Module['_PhotonTypesTable'] = createExportWrapper('PhotonTypesTable');
var _PhotonTypesDictBase = Module['_PhotonTypesDictBase'] = createExportWrapper('PhotonTypesDictBase');
var _PhotonTypesDictBaseFromDict = Module['_PhotonTypesDictBaseFromDict'] = createExportWrapper('PhotonTypesDictBaseFromDict');
var _PhotonTypesDict = Module['_PhotonTypesDict'] = createExportWrapper('PhotonTypesDict');
var _PhotonTypesArray = Module['_PhotonTypesArray'] = createExportWrapper('PhotonTypesArray');
var _PhotonTypesDestroy = Module['_PhotonTypesDestroy'] = createExportWrapper('PhotonTypesDestroy');
var _PhotonTypesGetType = Module['_PhotonTypesGetType'] = createExportWrapper('PhotonTypesGetType');
var _PhotonTypesGetByte = Module['_PhotonTypesGetByte'] = createExportWrapper('PhotonTypesGetByte');
var _PhotonTypesGetShort = Module['_PhotonTypesGetShort'] = createExportWrapper('PhotonTypesGetShort');
var _PhotonTypesGetInt = Module['_PhotonTypesGetInt'] = createExportWrapper('PhotonTypesGetInt');
var _PhotonTypesGetLongLow = Module['_PhotonTypesGetLongLow'] = createExportWrapper('PhotonTypesGetLongLow');
var _PhotonTypesGetLongHigh = Module['_PhotonTypesGetLongHigh'] = createExportWrapper('PhotonTypesGetLongHigh');
var _PhotonTypesGetFloat = Module['_PhotonTypesGetFloat'] = createExportWrapper('PhotonTypesGetFloat');
var _PhotonTypesGetDouble = Module['_PhotonTypesGetDouble'] = createExportWrapper('PhotonTypesGetDouble');
var _PhotonTypesGetString = Module['_PhotonTypesGetString'] = createExportWrapper('PhotonTypesGetString');
var _PhotonTypesGetBool = Module['_PhotonTypesGetBool'] = createExportWrapper('PhotonTypesGetBool');
var _PhotonTypesGetTable = Module['_PhotonTypesGetTable'] = createExportWrapper('PhotonTypesGetTable');
var _PhotonTypesStringAt = Module['_PhotonTypesStringAt'] = createExportWrapper('PhotonTypesStringAt');
var _PhotonTypesBoolAt = Module['_PhotonTypesBoolAt'] = createExportWrapper('PhotonTypesBoolAt');
var _PhotonTypesTableAt = Module['_PhotonTypesTableAt'] = createExportWrapper('PhotonTypesTableAt');
var _PhotonTypesObjectAt = Module['_PhotonTypesObjectAt'] = createExportWrapper('PhotonTypesObjectAt');
var _PhotonTypesTableSize = Module['_PhotonTypesTableSize'] = createExportWrapper('PhotonTypesTableSize');
var _PhotonTypesTablePut = Module['_PhotonTypesTablePut'] = createExportWrapper('PhotonTypesTablePut');
var _PhotonTypesTablePutNull = Module['_PhotonTypesTablePutNull'] = createExportWrapper('PhotonTypesTablePutNull');
var _PhotonTypesTableKeyAt = Module['_PhotonTypesTableKeyAt'] = createExportWrapper('PhotonTypesTableKeyAt');
var _PhotonTypesTableValueAt = Module['_PhotonTypesTableValueAt'] = createExportWrapper('PhotonTypesTableValueAt');
var _PhotonTypesDictSize = Module['_PhotonTypesDictSize'] = createExportWrapper('PhotonTypesDictSize');
var _PhotonTypesDictBasePut = Module['_PhotonTypesDictBasePut'] = createExportWrapper('PhotonTypesDictBasePut');
var _PhotonTypesDictKeyAt = Module['_PhotonTypesDictKeyAt'] = createExportWrapper('PhotonTypesDictKeyAt');
var _PhotonTypesDictValueAt = Module['_PhotonTypesDictValueAt'] = createExportWrapper('PhotonTypesDictValueAt');
var _PhotonTypesByteDictSize = Module['_PhotonTypesByteDictSize'] = createExportWrapper('PhotonTypesByteDictSize');
var _PhotonTypesByteDictPut = Module['_PhotonTypesByteDictPut'] = createExportWrapper('PhotonTypesByteDictPut');
var _PhotonTypesByteDictKeyAt = Module['_PhotonTypesByteDictKeyAt'] = createExportWrapper('PhotonTypesByteDictKeyAt');
var _PhotonTypesByteDictValueAt = Module['_PhotonTypesByteDictValueAt'] = createExportWrapper('PhotonTypesByteDictValueAt');
var _PhotonTypesIsArray = Module['_PhotonTypesIsArray'] = createExportWrapper('PhotonTypesIsArray');
var _PhotonTypesArraySize = Module['_PhotonTypesArraySize'] = createExportWrapper('PhotonTypesArraySize');
var _PhotonTypesArrayDataAddress = Module['_PhotonTypesArrayDataAddress'] = createExportWrapper('PhotonTypesArrayDataAddress');
var ___errno_location = createExportWrapper('__errno_location');
var _htons = createExportWrapper('htons');
var _fflush = Module['_fflush'] = createExportWrapper('fflush');
var _htonl = createExportWrapper('htonl');
var _ntohs = createExportWrapper('ntohs');
var setTempRet0 = createExportWrapper('setTempRet0');
var _emscripten_stack_init = () => (_emscripten_stack_init = wasmExports['emscripten_stack_init'])();
var _emscripten_stack_get_free = () => (_emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'])();
var _emscripten_stack_get_base = () => (_emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'])();
var _emscripten_stack_get_end = () => (_emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'])();
var stackSave = createExportWrapper('stackSave');
var stackRestore = createExportWrapper('stackRestore');
var stackAlloc = createExportWrapper('stackAlloc');
var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'])();
var ___cxa_demangle = createExportWrapper('__cxa_demangle');
var ___cxa_is_pointer_type = createExportWrapper('__cxa_is_pointer_type');
var dynCall_viijii = Module['dynCall_viijii'] = createExportWrapper('dynCall_viijii');
var dynCall_jiji = Module['dynCall_jiji'] = createExportWrapper('dynCall_jiji');
var dynCall_iiiiij = Module['dynCall_iiiiij'] = createExportWrapper('dynCall_iiiiij');
var dynCall_iiiiijj = Module['dynCall_iiiiijj'] = createExportWrapper('dynCall_iiiiijj');
var dynCall_iiiiiijj = Module['dynCall_iiiiiijj'] = createExportWrapper('dynCall_iiiiiijj');


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

Module['ccall'] = ccall;
Module['cwrap'] = cwrap;
Module['addFunction'] = addFunction;
Module['removeFunction'] = removeFunction;
Module['setValue'] = setValue;
Module['UTF8ToString'] = UTF8ToString;
Module['stringToUTF8'] = stringToUTF8;
Module['lengthBytesUTF8'] = lengthBytesUTF8;
Module['UTF32ToString'] = UTF32ToString;
var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertU32PairToI53',
  'exitJS',
  'getHostByName',
  'getCallstack',
  'emscriptenLog',
  'convertPCtoSourceLocation',
  'runMainThreadEmAsm',
  'jstoi_s',
  'listenOnce',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'handleException',
  'keepRuntimeAlive',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asmjsMangle',
  'handleAllocatorInit',
  'HandleAllocator',
  'getNativeTypeSize',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'reallyNegative',
  'unSign',
  'strLen',
  'reSign',
  'formatString',
  'intArrayToString',
  'AsciiToString',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'stringToUTF32',
  'lengthBytesUTF32',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'findCanvasEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'battery',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'createDyncallWrapper',
  'safeSetTimeout',
  'setImmediateWrapped',
  'clearImmediateWrapped',
  'polyfillSetImmediate',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'findMatchingCatch',
  'setMainLoop',
  'FS_unlink',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'heapAccessShiftForWebGLHeap',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  '__glGenObject',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'SDL_unicode',
  'SDL_ttfContext',
  'SDL_audio',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

var unexportedSymbols = [
  'run',
  'addOnPreRun',
  'addOnInit',
  'addOnPreMain',
  'addOnExit',
  'addOnPostRun',
  'addRunDependency',
  'removeRunDependency',
  'FS_createFolder',
  'FS_createPath',
  'FS_createLazyFile',
  'FS_createLink',
  'FS_createDevice',
  'FS_readFile',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmMemory',
  'wasmExports',
  'stackAlloc',
  'stackSave',
  'stackRestore',
  'getTempRet0',
  'setTempRet0',
  'writeStackCookie',
  'checkStackCookie',
  'convertI32PairToI53Checked',
  'ptrToString',
  'zeroMemory',
  'getHeapMax',
  'growMemory',
  'ENV',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'ERRNO_CODES',
  'ERRNO_MESSAGES',
  'setErrNo',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'DNS',
  'Protocols',
  'Sockets',
  'initRandomFill',
  'randomFill',
  'timers',
  'warnOnce',
  'UNWIND_CACHE',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'jstoi_q',
  'getExecutableName',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'wasmTable',
  'noExitRuntime',
  'getCFunc',
  'uleb128Encode',
  'sigToWasmTypes',
  'generateFuncType',
  'convertJsFunctionToWasm',
  'freeTableIndexes',
  'functionsInTableMap',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'stringToUTF8Array',
  'intArrayFromString',
  'stringToAscii',
  'UTF16Decoder',
  'stringToNewUTF8',
  'stringToUTF8OnStack',
  'writeArrayToMemory',
  'JSEvents',
  'specialHTMLTargets',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'demangle',
  'demangleAll',
  'jsStackTrace',
  'stackTrace',
  'ExitStatus',
  'getEnvStrings',
  'doReadv',
  'doWritev',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'ExceptionInfo',
  'Browser',
  'wget',
  'SYSCALLS',
  'getSocketFromFD',
  'getSocketAddress',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS',
  'FS_createDataFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'emscripten_webgl_power_preferences',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'allocateUTF8',
  'allocateUTF8OnStack',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);



var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {

  if (runDependencies > 0) {
    return;
  }

    stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    ['stdout', 'stderr'].forEach(function(name) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty && tty.output && tty.output.length) {
        has = true;
      }
    });
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();


// end include: postamble.js
var Photon;

var Module = Module || {};
Module['onRuntimeInitialized'] = function (prevCallback) { return function() { prevCallback && prevCallback() ||

(function (Photon) {
    var EmPhotonPeerLib;
    var callbacks = {};
    (function (EmPhotonPeerLib) {
        EmPhotonPeerLib.Create = function (wss, xf, yf, zf, tf) {
            var x = addFunction(xf, "vi");
            var y = addFunction(yf, "vipip");
            var z = addFunction(zf, "vip");
            var t = addFunction(tf, "vip");
            var peer = Module.ccall('PhotonPeerCreate', 'number', ['number', 'number', 'number', 'number', 'number'], [wss, x, y, z, t]);
            callbacks[peer] = [x, y, z, t];
            return peer;
        };
        EmPhotonPeerLib.Destroy = function(peer) {
            var c = callbacks[peer];
            for (var i = 0; i < c.length; i++) {
                removeFunction(c[i]);
            }
            Module.ccall('PhotonPeerDestroy', ['number'], [peer]);
        }

        EmPhotonPeerLib.Connect = Module.cwrap('PhotonPeerConnect', 'number', ['number', 'string', 'string']);
        EmPhotonPeerLib.Disconnect = Module.cwrap('PhotonPeerDisconnect', null, ['number']);
        EmPhotonPeerLib.State = Module.cwrap('PhotonPeerState', 'number', ['number']);
        EmPhotonPeerLib.Service = Module.cwrap('PhotonPeerService', null, ['number']);
        EmPhotonPeerLib.SetDebugOutputLevel = Module.cwrap('PhotonPeerSetDebugOutputLevel', 'number', ['number', 'number']);

        EmPhotonPeerLib.OpCustom = Module.cwrap('PhotonPeerOpCustom', 'number', ['number', 'number', 'number', 'number', 'number']);
        EmPhotonPeerLib.OperationRequestCreate = Module.cwrap('PhotonOperationRequestCreate', 'number', ['number']);
        EmPhotonPeerLib.OperationRequestDestroy = Module.cwrap('PhotonOperationRequestDestroy', null, ['number']);
        EmPhotonPeerLib.OperationRequestSetParam = Module.cwrap('PhotonOperationRequestSetParam', null, ['number', 'number', 'number']);

        EmPhotonPeerLib.FetchServerTimestamp = Module.cwrap('PhotonPeerFetchServerTimestamp', null, ['number']);
        EmPhotonPeerLib.GetServerTime = Module.cwrap('PhotonPeerGetServerTime', 'number', ['number']);
        EmPhotonPeerLib.GetRoundTripTime = Module.cwrap('PhotonPeerGetRoundTripTime', 'number', ['number']);

    })(EmPhotonPeerLib = Photon.EmPhotonPeerLib || (Photon.EmPhotonPeerLib = {}));

    var EmTypesLib;
    (function (EmTypesLib) {
        var TypeCode;
        (function (TypeCode) {
            TypeCode["BYTE"] = 'b'.charCodeAt(0);
            TypeCode["SHORT"] = 'k'.charCodeAt(0);
            TypeCode["INTEGER"] = 'i'.charCodeAt(0);
            TypeCode["LONG"] = 'l'.charCodeAt(0);
            TypeCode["FLOAT"] = 'f'.charCodeAt(0);
            TypeCode["DOUBLE"] = 'd'.charCodeAt(0);
            TypeCode["BOOLEAN"] = 'o'.charCodeAt(0);
            TypeCode["STRING"] = 's'.charCodeAt(0);
            TypeCode["HASHTABLE"] = 'h'.charCodeAt(0);
            TypeCode["DICTIONARY"] = 'D'.charCodeAt(0);
            TypeCode["OBJECT"] = 'z'.charCodeAt(0);
            TypeCode["ARRAY"] = 'y'.charCodeAt(0);
            TypeCode["BYTEARRAY"] = 'x'.charCodeAt(0);
            TypeCode["PHOTON_COMMAND"] = 'p'.charCodeAt(0);
            TypeCode["EG_NULL"] = '*'.charCodeAt(0);
            TypeCode["CUSTOM"] = 'c'.charCodeAt(0);
            TypeCode["UNKNOWN"] = 0;
        })(TypeCode = Photon.EmTypesLib.TypeCode || (Photon.EmTypesLib.TypeCode = {}));

        EmTypesLib.UTF8ToString = Module.UTF8ToString;
        EmTypesLib.stringToUTF8 = Module.stringToUTF8;

        EmTypesLib.Byte = Module.cwrap('PhotonTypesByte', 'number', ['number']);
        EmTypesLib.Short = Module.cwrap('PhotonTypesShort', 'number', ['number']);
        EmTypesLib.Int = Module.cwrap('PhotonTypesInt', 'number', ['number']);
        EmTypesLib.Long = Module.cwrap('PhotonTypesLong', 'number', ['number', 'number']);
        EmTypesLib.Float = Module.cwrap('PhotonTypesFloat', 'number', ['number']);
        EmTypesLib.Double = Module.cwrap('PhotonTypesDouble', 'number', ['number']);
        EmTypesLib.String = Module.cwrap('PhotonTypesString', 'number', ['string']);
        EmTypesLib.Bool = Module.cwrap('PhotonTypesBool', 'number', ['number']);
        EmTypesLib.Table = Module.cwrap('PhotonTypesTable', 'number');
        // DictionaryBase from key and value types
        EmTypesLib.DictBase = Module.cwrap('PhotonTypesDictBase', 'number', ['number', 'number']);
        // DictionaryBase from Object
        EmTypesLib.DictBaseFromDict = Module.cwrap('PhotonTypesDictBaseFromDict', 'number', ['number']);
        // DictionaryBase to Object
        EmTypesLib.Dict = Module.cwrap('PhotonTypesDict', 'number', ['number']);

        function arrayToHeap(typedArray) {
            const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
            const ptr = _malloc(numBytes);
            const heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
            heapBytes.set(new Uint8Array(typedArray.buffer));
            return ptr;
        }

        EmTypesLib.ToTypedArray = function (elementType, objPtr, arr) {
            const arrPtr = Photon.EmTypesLib.ArrayDataAddress(elementType, objPtr);
            const numBytes = arr.length * arr.BYTES_PER_ELEMENT;
            const heapBytes = new Uint8Array(Module.HEAPU8.buffer, arrPtr, numBytes);
            new Uint8Array(arr.buffer, arr.byteOffset).set(heapBytes);
            return arr;
        };

        EmTypesLib.TypedArray = function (typeCode, arr) {
            const offset = 0;
            const numBytes = arr.length * arr.BYTES_PER_ELEMENT;
            const ptr = _malloc(numBytes);
            const heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
            heapBytes.set(new Uint8Array(arr.buffer));
            if (ptr) {
                var count = arr.length;
                var res = Module.ccall('PhotonTypesArray', 'number', ['number', 'number', 'number'], [typeCode, ptr, count]);
                _free(ptr);
                return res
            } else {
                return 0;
            }
        };

        EmTypesLib.Array = function (typeCode, arr) {
            var offset = 0;
            var allocs = [];
            switch (typeCode) {
                case TypeCode.BYTE:
                    var offset = arrayToHeap(new Int8Array(arr));
                    break;
                case TypeCode.SHORT:
                    var offset = arrayToHeap(new Int16Array(arr));
                    break;
                case TypeCode.INTEGER:
                    var offset = arrayToHeap(new Int32Array(arr));
                    break;
                case TypeCode.LONG:
                    throw new Error("TypeExt.Long Arrays are not supported, use BigInt64Array");
                case TypeCode.FLOAT:
                    var offset = arrayToHeap(new Float32Array(arr));
                    break;
                case TypeCode.DOUBLE:
                    var offset = arrayToHeap(new Float64Array(arr));
                    break;
                case TypeCode.STRING:
                    // array of JString*
                    var offset = _malloc(arr.length * 4);
                    allocs.push(offset)
                    for (var i = 0; i < arr.length; i++) {
                        var len = Module.lengthBytesUTF8(arr[i])
                        var strPtr = _malloc(len + 1);
                        allocs.push(strPtr)
                        Module.stringToUTF8(arr[i], strPtr, len + 1)
                        Module.setValue(offset + i * 4, strPtr, '*');
                    }
                    break;
                case TypeCode.BOOLEAN:
                    offset = _malloc(arr.length);
                    allocs.push(offset);
                    for (var i = 0; i < arr.length; i++) {
                        Module.setValue(offset + i, arr[i], 'i8');
                    }
                    break;
                case TypeCode.OBJECT:
                    offset = _malloc(arr.length * 4);
                    allocs.push(offset);
                    for (var i = 0; i < arr.length; i++) {
                        Module.setValue(offset + i * 4, arr[i], '*');
                    }
                    break;
            }
            if (offset) {
                var count = typeCode == TypeCode.LONG ? arr.length / 2 : arr.length;
                var res = Module.ccall('PhotonTypesArray', 'number', ['number', 'number', 'number'], [typeCode, offset, count]);
                for (var i = 0; i < allocs.length; i++) {
                    _free(allocs[i]);
                }
                return res;
            } else {
                return 0;
            }
        };

        EmTypesLib.Destroy = Module.cwrap('PhotonTypesDestroy', null, ['number']);

        EmTypesLib.GetType = Module.cwrap('PhotonTypesGetType', 'number', ['number']);
        EmTypesLib.GetByte = Module.cwrap('PhotonTypesGetByte', 'number', ['number']);
        EmTypesLib.GetShort = Module.cwrap('PhotonTypesGetShort', 'number', ['number']);
        EmTypesLib.GetInt = Module.cwrap('PhotonTypesGetInt', 'number', ['number']);
        EmTypesLib.GetLongLow = Module.cwrap('PhotonTypesGetLongLow', 'number', ['number']);
        EmTypesLib.GetLongHigh = Module.cwrap('PhotonTypesGetLongHigh', 'number', ['number']);
        EmTypesLib.GetFloat = Module.cwrap('PhotonTypesGetFloat', 'number', ['number']);
        EmTypesLib.GetDouble = Module.cwrap('PhotonTypesGetDouble', 'number', ['number']);
        EmTypesLib.GetString = function (x) {
            const p = Module.ccall('PhotonTypesGetString', 'number', ['number'], [x]);
            return UTF32ToString(p);
        }
        EmTypesLib.GetBool = function (x) {
            return Module.ccall('PhotonTypesGetBool', 'number', ['number'], [x]) != 0;
        }
        EmTypesLib.GetTable = Module.cwrap('PhotonTypesGetTable', 'number', ['number']);

        EmTypesLib.TableSize = Module.cwrap('PhotonTypesTableSize', 'number', ['number']);
        EmTypesLib.TablePut = Module.cwrap('PhotonTypesTablePut', null, ['number', 'number', 'number']);
        EmTypesLib.TablePutNull = Module.cwrap('PhotonTypesTablePutNull', null, ['number', 'number']);
        EmTypesLib.TableKeyAt = Module.cwrap('PhotonTypesTableKeyAt', 'number', ['number', 'number']);
        EmTypesLib.TableValueAt = Module.cwrap('PhotonTypesTableValueAt', 'number', ['number', 'number']);
        EmTypesLib.DictSize = Module.cwrap('PhotonTypesDictSize', 'number', ['number']);
        EmTypesLib.DictBasePut = Module.cwrap('PhotonTypesDictBasePut', null, ['number', 'number', 'number']);
        EmTypesLib.DictKeyAt = Module.cwrap('PhotonTypesDictKeyAt', 'number', ['number', 'number']);
        EmTypesLib.DictValueAt = Module.cwrap('PhotonTypesDictValueAt', 'number', ['number', 'number']);
        EmTypesLib.ByteDictSize = Module.cwrap('PhotonTypesByteDictSize', 'number', ['number']);
        EmTypesLib.ByteDictPut = Module.cwrap('PhotonTypesByteDictPut', null, ['number', 'number', 'number']);
        EmTypesLib.ByteDictKeyAt = Module.cwrap('PhotonTypesByteDictKeyAt', 'number', ['number', 'number']);
        EmTypesLib.ByteDictValueAt = Module.cwrap('PhotonTypesByteDictValueAt', 'number', ['number', 'number']);

        EmTypesLib.IsArray = function (x) {
            return Module.ccall('PhotonTypesIsArray', 'number', ['number'], [x]) != 0;
        }
        EmTypesLib.ArraySize = Module.cwrap('PhotonTypesArraySize', 'number', ['number']);
        EmTypesLib.ArrayDataAddress = Module.cwrap('PhotonTypesArrayDataAddress', 'number', ['number', 'number']);

        EmTypesLib.StringAt = function(x, i) {
            const p = Module.ccall('PhotonTypesStringAt', 'number', ['number', 'number'], [x, i]);
            return UTF32ToString(p);
        }
        EmTypesLib.BoolAt = function(x, i) {
            return Module.ccall('PhotonTypesBoolAt', 'number', ['number', 'number'], [x, i]) != 0;
        }
        EmTypesLib.TableAt = Module.cwrap('PhotonTypesTableAt', 'number', ['number', 'number']);
        EmTypesLib.ObjectAt = Module.cwrap('PhotonTypesObjectAt', 'number', ['number', 'number']);
    })(EmTypesLib = Photon.EmTypesLib || (Photon.EmTypesLib = {}));

})(Photon || (Photon = {}));

};}(Module['onRuntimeInitialized']);
var Photon;

var Module = Module || {};
Module['onRuntimeInitialized'] = function (prevCallback) { return function() { 
    prevCallback && prevCallback();
	Photon["isLoaded"] = true;
    Photon["onLoad"] && Photon["onLoad"]();
};}(Module['onRuntimeInitialized']);
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
    Photon
    @namespace Photon
*/
var Photon;
(function (Photon) {
    /**
        @summary Log levels.
        @readonly
        @enum {number}
        @member Photon.LogLevel
        @readonly
        @property {number} OFF Logging off.
        @property {number} ERROR
        @property {number} WARN
        @property {number} INFO
        @property {number} DEBUG All logging is enabled.
    */
    var LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["OFF"] = 0] = "OFF";
        LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
        LogLevel[LogLevel["WARN"] = 2] = "WARN";
        LogLevel[LogLevel["INFO"] = 3] = "INFO";
        LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
    })(LogLevel = Photon.LogLevel || (Photon.LogLevel = {}));
    ;
    var Logger = /** @class */ (function () {
        /**
            @classdesc Logger
            @summary Prints messages to browser console.
            Each logging method perfoms toString() calls and default formatting of arguments only after it checks logging level. Therefore disabled level logging method call with plain arguments doesn't involves much overhead.
            But if one prefer custom formatting or some calculation for logging methods arguments he should check logging level before doing this to avoid unnecessary operations:
            if(logger.isLevelEnabled(LogLevel.DEBUG)) {
                logger.debug("", someCall(x, y), x + "," + y);
            }
            @constructor Photon.Logger
            @param {string} [prefix=""] All log messages will be prefixed with that.
            @param {Photon.LogLevel} [level=LogLevel.INFO] Initial logging level.
        */
        function Logger(prefix, level) {
            if (prefix === void 0) { prefix = ""; }
            if (level === void 0) { level = LogLevel.INFO; }
            this.prefix = prefix;
            this.level = level;
        }
        /**
            @summary Sets logger prefix.
            @method Photon.Logger#setPrefix
            @param {stirng} prefix New prefix.
        */
        Logger.prototype.setPrefix = function (prefix) {
            this.prefix = prefix;
        };
        /**
            @summary Gets logger prefix.
            @method Photon.Logger#getPrefix
            @returns {string} Prefix.
        */
        Logger.prototype.getPrefix = function () {
            return this.prefix;
        };
        /**
            @summary Changes current logging level.
            @method Photon.Logger#setLevel
            @param {Photon.LogLevel} level New logging level.
        */
        Logger.prototype.setLevel = function (level) {
            level = Math.max(level, LogLevel.OFF);
            level = Math.min(level, LogLevel.DEBUG);
            this.level = level;
        };
        /**
            @summary Sets global method to be called on logger.exception call.
            @method Photon.Logger#setExceptionHandler
            @param {'(number, string) => boolean'} handler Exception handler. Return true to cancel throwing.
        */
        Logger.setExceptionHandler = function (handler) {
            this.exceptionHandler = handler;
        };
        /**
            @summary Checks if logging level active.
            @method Photon.Logger#isLevelEnabled
            @param {Photon.LogLevel} level Level to check.
            @returns {boolean} True if level active.
        */
        Logger.prototype.isLevelEnabled = function (level) { return level <= this.level; };
        /**
            @summary Returns current logging level.
            @method Photon.Logger#getLevel
            @returns {Photon.LogLevel} Current logging level.
        */
        Logger.prototype.getLevel = function () { return this.level; };
        /**
            @summary Logs message if logging level = DEBUG, INFO, WARN, ERROR
            @method Photon.Logger#debug
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
        */
        Logger.prototype.debug = function (mess) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            this.log(LogLevel.DEBUG, mess, optionalParams);
        };
        /**
            @summary Logs message if logging level = INFO, WARN, ERROR
            @method Photon.Logger#info
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
        */
        Logger.prototype.info = function (mess) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            this.log(LogLevel.INFO, mess, optionalParams);
        };
        /**
            @summary Logs message if logging level = WARN, ERROR
            @method Photon.Logger#warn
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
        */
        Logger.prototype.warn = function (mess) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            this.log(LogLevel.WARN, mess, optionalParams);
        };
        /**
            @summary Logs message if logging level = ERROR
            @method Photon.Logger#error
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
        */
        Logger.prototype.error = function (mess) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            this.log(LogLevel.ERROR, mess, optionalParams);
        };
        /**
            @summary Throws an Error or executes exception handler if set.
            @method Photon.Logger#exception
            @param {string} mess Message passed to Error or exception handler.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
        */
        Logger.prototype.exception = function (code, mess) {
            var optionalParams = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                optionalParams[_i - 2] = arguments[_i];
            }
            if (Logger.exceptionHandler && Logger.exceptionHandler(code, this.format0(mess, optionalParams))) {
                return;
            }
            throw new Error(this.format0("[" + code + "] " + mess, optionalParams));
        };
        /**
            @summary Applies default logger formatting to arguments
            @method Photon.Logger#format
            @param {string} mess String to start formatting with.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of formatted string after space character.
            @returns {string} Formatted string.
        */
        Logger.prototype.format = function (mess) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            return this.format0(mess, optionalParams);
        };
        /**
            @summary Applies default logger formatting to array of objects.
            @method Photon.Logger#format
            @param {string} mess String to start formatting with.
            @param {any[]} optionalParams For every additional parameter toString() applies and result added to the end of formatted string after space character.
            @returns {string} Formatted string.
        */
        Logger.prototype.formatArr = function (mess, optionalParams) { return this.format0(mess, optionalParams); };
        Logger.prototype.log = function (level, msg, optionalParams) {
            if (level <= this.level) {
                // for global vars console !== undefined throws an error
                if (typeof console !== "undefined" && msg !== undefined) {
                    try {
                        var logMethod;
                        if (console.hasOwnProperty(Logger.log_types[level])) {
                            logMethod = console[Logger.log_types[level]];
                        }
                        else {
                            logMethod = console["log"];
                        }
                        if (logMethod) {
                            logMethod.apply(console, [this.prefix, msg].concat(optionalParams));
                        }
                    }
                    catch (error) {
                        // silently fail
                    }
                }
            }
        };
        Logger.prototype.format0 = function (msg, optionalParams) {
            return (this.prefix == "" ? "" : this.prefix + " ") + msg + " " + optionalParams.map(function (x) {
                if (x !== undefined) {
                    switch (typeof x) {
                        case "object":
                            try {
                                return JSON.stringify(x);
                            }
                            catch (error) {
                                return x.toString() + "(" + error + ")";
                            }
                        default:
                            return x.toString();
                    }
                }
            }).join(" ");
        };
        Logger.log_types = ["error", "error", "warn", "info", "debug"];
        return Logger;
    }());
    Photon.Logger = Logger;
    var Util = /** @class */ (function () {
        function Util() {
        }
        Util.isArray = function (obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        };
        Util.getPropertyOrElse = function (obj, prop, defaultValue) {
            if (obj.hasOwnProperty(prop)) {
                return obj[prop];
            }
            else {
                return defaultValue;
            }
        };
        return Util;
    }());
    Photon.Util = Util;
})(Photon || (Photon = {}));
/// <reference path="photon-common.ts"/>
/// <reference path="emscripten/EmPhotonPeerLibAPI.d.ts"/>
var Photon;
(function (Photon) {
    Photon.IsEmscriptenBuildInternal = true; // if not exported, the property is not seen in other sources defining the same module Photon.
    var TypeCode;
    (function (TypeCode) {
        TypeCode[TypeCode["BYTE"] = 'b'.charCodeAt(0)] = "BYTE";
        TypeCode[TypeCode["SHORT"] = 'k'.charCodeAt(0)] = "SHORT";
        TypeCode[TypeCode["INTEGER"] = 'i'.charCodeAt(0)] = "INTEGER";
        TypeCode[TypeCode["LONG"] = 'l'.charCodeAt(0)] = "LONG";
        TypeCode[TypeCode["FLOAT"] = 'f'.charCodeAt(0)] = "FLOAT";
        TypeCode[TypeCode["DOUBLE"] = 'd'.charCodeAt(0)] = "DOUBLE";
        TypeCode[TypeCode["BOOLEAN"] = 'o'.charCodeAt(0)] = "BOOLEAN";
        TypeCode[TypeCode["STRING"] = 's'.charCodeAt(0)] = "STRING";
        TypeCode[TypeCode["HASHTABLE"] = 'h'.charCodeAt(0)] = "HASHTABLE";
        TypeCode[TypeCode["DICTIONARY"] = 'D'.charCodeAt(0)] = "DICTIONARY";
        TypeCode[TypeCode["OBJECT"] = 'z'.charCodeAt(0)] = "OBJECT";
        TypeCode[TypeCode["ARRAY"] = 'y'.charCodeAt(0)] = "ARRAY";
        TypeCode[TypeCode["BYTEARRAY"] = 'x'.charCodeAt(0)] = "BYTEARRAY";
        TypeCode[TypeCode["PHOTON_COMMAND"] = 'p'.charCodeAt(0)] = "PHOTON_COMMAND";
        TypeCode[TypeCode["EG_NULL"] = '*'.charCodeAt(0)] = "EG_NULL";
        TypeCode[TypeCode["CUSTOM"] = 'c'.charCodeAt(0)] = "CUSTOM";
        TypeCode[TypeCode["UNKNOWN"] = 0] = "UNKNOWN";
    })(TypeCode || (TypeCode = {}));
    var TypeExtType;
    (function (TypeExtType) {
        TypeExtType[TypeExtType["None"] = 0] = "None";
        TypeExtType[TypeExtType["Byte"] = 1] = "Byte";
        TypeExtType[TypeExtType["Short"] = 2] = "Short";
        TypeExtType[TypeExtType["Int"] = 3] = "Int";
        TypeExtType[TypeExtType["Long"] = 4] = "Long";
        TypeExtType[TypeExtType["Float"] = 5] = "Float";
        TypeExtType[TypeExtType["Double"] = 6] = "Double";
        TypeExtType[TypeExtType["String"] = 7] = "String";
        TypeExtType[TypeExtType["Bool"] = 8] = "Bool";
        TypeExtType[TypeExtType["Table"] = 9] = "Table";
        TypeExtType[TypeExtType["Dict"] = 10] = "Dict";
        TypeExtType[TypeExtType["Object"] = 11] = "Object";
    })(TypeExtType = Photon.TypeExtType || (Photon.TypeExtType = {}));
    // Not exported class does not pollute namespace
    var T = /** @class */ (function () {
        function T(type, value, longHiBytes, keyType, valType) {
            if (longHiBytes === void 0) { longHiBytes = 0; }
            this.type = type;
            this.value = value;
            this.longHiBytes = longHiBytes;
            this.keyType = keyType;
            this.valType = valType;
        }
        T.prototype.ToJS = function () {
            if (this.type == TypeExtType.Long) {
                return this;
            }
            else {
                return this.value;
            }
        };
        T.prototype.GetTypedKeyTable = function () {
            return this.typedKeyTable;
        };
        return T;
    }());
    // wraps native dict to let user code access it by providing key and value types in access methods
    var NativeDict = /** @class */ (function () {
        function NativeDict(ptr, arrIdx) {
            if (arrIdx === void 0) { arrIdx = -1; }
            this.ptr = ptr;
            this.arrIdx = arrIdx;
        }
        return NativeDict;
    }());
    var NativeDictBase = /** @class */ (function () {
        function NativeDictBase(base) {
            this.base = base;
        }
        NativeDictBase.prototype.Size = function () {
            return Photon.EmTypesLib.DictSize(this.base);
        };
        NativeDictBase.prototype.KeyAt = function (i) {
            return TypeExt.native2js(Photon.EmTypesLib.DictKeyAt(this.base, i));
        };
        NativeDictBase.prototype.ValueAt = function (i) {
            return TypeExt.native2js(Photon.EmTypesLib.DictValueAt(this.base, i));
        };
        return NativeDictBase;
    }());
    Photon.NativeDictBase = NativeDictBase;
    var TypeExt = /** @class */ (function () {
        function TypeExt() {
        }
        TypeExt.Is = function (x) {
            return x instanceof T;
        };
        // for numeric typed objects creators below,
        // pass number to create single value,
        // pass number[] to create array of values
        TypeExt.Byte = function (x) {
            return new T(TypeExtType.Byte, x);
        };
        TypeExt.Short = function (x) {
            return new T(TypeExtType.Short, x);
        };
        TypeExt.Int = function (x) {
            return new T(TypeExtType.Int, x);
        };
        TypeExt.Float = function (x) {
            return new T(TypeExtType.Float, x);
        };
        TypeExt.Double = function (x) {
            return new T(TypeExtType.Double, x);
        };
        // long represented by 2 ints
        // array of longs represented by array of ints of double size: [low0, hi0, low1, hi1...]
        TypeExt.Long = function (x, hi) {
            if (hi === void 0) { hi = 0; }
            if (Array.isArray(x)) {
                throw new Error("TypeExt.Long Arrays are not supported, use BigInt64Array");
            }
            return new T(TypeExtType.Long, x, hi);
        };
        // pass js array to create typed array of strings
        // for single values, use string
        TypeExt.String = function (x) {
            return new T(TypeExtType.String, x);
        };
        // pass js array to create array of booleans
        // for single values, use js boolean
        TypeExt.Bool = function (x) {
            return new T(TypeExtType.Bool, x);
        };
        TypeExt.Dict = function (keyType, valType, x) {
            return new T(TypeExtType.Dict, x, 0, keyType, valType);
        };
        TypeExt.GetDict = function (keyType, valType, d) {
            var b = Photon.EmTypesLib.DictBaseFromDict(TypeExt.type2typeCode(keyType), TypeExt.type2typeCode(valType), d.ptr);
            if (b == 0) {
                this.logger.exception(301, "GetDict: Unsupported dictionary key/value types", TypeExtType[keyType] + "(" + keyType + ")/" + TypeExtType[valType] + "(" + valType + ")");
            }
            return new NativeDictBase(b);
        };
        // A table with keys of arbitrary type
        TypeExt.TableTypedKeys = function () {
            return new T(TypeExtType.Table, {});
        };
        // A dictionary with keys with types optionally different from dictionary key type declaration (like byte keys in onject dictionary)
        TypeExt.DictTypedKeys = function (keyType, valType) {
            return new T(TypeExtType.Dict, {}, 0, keyType, valType);
        };
        TypeExt.PutTypedKey = function (x, k, v) {
            if (!x.value) {
                x.value = {};
            }
            if (!x.typedKeyTable) {
                x.typedKeyTable = [];
            }
            x.value[k.value] = v;
            x.typedKeyTable.push(k, v);
        };
        TypeExt.type2typeCode = function (t) {
            switch (t) {
                case TypeExtType.Byte: return TypeCode.BYTE;
                case TypeExtType.Short: return TypeCode.SHORT;
                case TypeExtType.Int: return TypeCode.INTEGER;
                case TypeExtType.Long: return TypeCode.LONG;
                case TypeExtType.Float: return TypeCode.FLOAT;
                case TypeExtType.Double: return TypeCode.DOUBLE;
                case TypeExtType.String: return TypeCode.STRING;
                case TypeExtType.Bool: return TypeCode.BOOLEAN;
                case TypeExtType.Dict: return TypeCode.DICTIONARY;
                case TypeExtType.Object: return TypeCode.OBJECT;
                default: return TypeCode.UNKNOWN;
            }
        };
        TypeExt.js2native = function (nativeRefs, x) {
            if (x === undefined) {
                return undefined;
            }
            if (x === null) {
                return null;
            }
            var ref = TypeExt.js2native0(nativeRefs, x);
            if (ref != 0) {
                nativeRefs.push(ref);
            }
            return ref;
        };
        TypeExt.js2native0 = function (nativeRefs, x) {
            if (x instanceof T) {
                var y = x;
                if (Array.isArray(y.value)) {
                    var arr = y.value;
                    var typeCode = TypeExt.type2typeCode(y.type);
                    return Photon.EmTypesLib.Array(typeCode, arr);
                }
                else {
                    switch (y.type) {
                        case TypeExtType.Byte: return Photon.EmTypesLib.Byte(x.value);
                        case TypeExtType.Short: return Photon.EmTypesLib.Short(x.value);
                        case TypeExtType.Int: return Photon.EmTypesLib.Int(x.value);
                        case TypeExtType.Long: return Photon.EmTypesLib.Long(x.value, x.longHiBytes);
                        case TypeExtType.Float: return Photon.EmTypesLib.Float(x.value);
                        case TypeExtType.Double: return Photon.EmTypesLib.Double(x.value);
                        case TypeExtType.String: return Photon.EmTypesLib.String(x.value); // normally js string type used for single value
                        case TypeExtType.Bool: return Photon.EmTypesLib.Bool(x.value); // normally js boolean type used for single value
                        case TypeExtType.Table:
                            var t = Photon.EmTypesLib.Table();
                            var tkt = x.GetTypedKeyTable();
                            if (tkt) { // otherwise the table is empty
                                for (var i = 0; i < tkt.length; i += 2) {
                                    if (tkt[i + 1] === null) {
                                        Photon.EmTypesLib.TablePutNull(t, TypeExt.js2native(nativeRefs, tkt[i]));
                                    }
                                    else {
                                        Photon.EmTypesLib.TablePut(t, TypeExt.js2native(nativeRefs, tkt[i]), TypeExt.js2native(nativeRefs, tkt[i + 1]));
                                    }
                                }
                            }
                            return t;
                        case TypeExtType.Dict:
                            var b = Photon.EmTypesLib.DictBase(TypeExt.type2typeCode(x.keyType), TypeExt.type2typeCode(x.valType));
                            if (b == 0) {
                                this.logger.exception(302, "js2native0: Unsupported dictionary key/value types", TypeExtType[x.keyType] + "(" + x.keyType + ")/" + TypeExtType[x.valType] + "(" + x.valType + ")");
                            }
                            var tkt = x.GetTypedKeyTable();
                            if (tkt) {
                                for (var i = 0; i < tkt.length; i += 2) {
                                    Photon.EmTypesLib.DictBasePut(b, TypeExt.js2native(nativeRefs, tkt[i]), TypeExt.js2native(nativeRefs, tkt[i + 1]));
                                }
                            }
                            else {
                                for (var k in x.value) {
                                    var kExt = new T(x.keyType, k);
                                    var v = x.value[k];
                                    Photon.EmTypesLib.DictBasePut(b, TypeExt.js2native(nativeRefs, kExt), TypeExt.js2native(nativeRefs, v));
                                }
                            }
                            return Photon.EmTypesLib.Dict(b);
                        default:
                            TypeExt.logger.exception(303, "js2native: unsupported data type " + y.type + " for value ", x);
                            return 0;
                    }
                }
            }
            else if (Array.isArray(x)) {
                var arr = x;
                var ptrs = [];
                for (var i = 0; i < arr.length; i++) {
                    ptrs.push(TypeExt.js2native(nativeRefs, arr[i]));
                }
                return Photon.EmTypesLib.Array(TypeCode.OBJECT, ptrs);
            }
            else if (x instanceof Int8Array || x instanceof Uint8Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.BYTE, x);
            else if (x instanceof Int16Array || x instanceof Uint16Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.SHORT, x);
            else if (x instanceof Int32Array || x instanceof Uint32Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.INTEGER, x);
            else if (x instanceof BigInt64Array || x instanceof BigUint64Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.LONG, x);
            else if (x instanceof Float32Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.FLOAT, x);
            else if (x instanceof Float64Array)
                return Photon.EmTypesLib.TypedArray(TypeCode.DOUBLE, x);
            else if (typeof x == "number") {
                return Photon.EmTypesLib.Double(x);
            }
            else if (typeof x == "string") {
                return Photon.EmTypesLib.String(x);
            }
            else if (typeof x == "boolean") {
                return Photon.EmTypesLib.Bool(x);
            }
            else if (typeof x == "object") {
                var t = Photon.EmTypesLib.Table();
                for (var k in x) {
                    if (x[k] === null) {
                        Photon.EmTypesLib.TablePutNull(t, TypeExt.js2native(nativeRefs, k));
                    }
                    else {
                        Photon.EmTypesLib.TablePut(t, TypeExt.js2native(nativeRefs, k), TypeExt.js2native(nativeRefs, x[k]));
                    }
                }
                return t;
            }
            else {
                TypeExt.logger.exception(304, "js2native: unsupported data type for value:", x);
            }
            return 0;
        };
        TypeExt.native2js = function (x) {
            var t = Photon.EmTypesLib.GetType(x);
            if (Photon.EmTypesLib.IsArray(x)) {
                var length = Photon.EmTypesLib.ArraySize(x);
                if (t == TypeCode.BYTE)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new Uint8Array(length));
                else if (t == TypeCode.SHORT)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new Int16Array(length));
                else if (t == TypeCode.INTEGER)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new Int32Array(length));
                else if (t == TypeCode.LONG)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new BigInt64Array(length));
                else if (t == TypeCode.FLOAT)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new Float32Array(length));
                else if (t == TypeCode.DOUBLE)
                    return Photon.EmTypesLib.ToTypedArray(t, x, new Float64Array(length));
                var a = [];
                for (var i = 0; i < length; i++) {
                    switch (t) {
                        case TypeCode.STRING:
                            a[i] = Photon.EmTypesLib.StringAt(x, i);
                            break;
                        case TypeCode.BOOLEAN:
                            a[i] = Photon.EmTypesLib.BoolAt(x, i);
                            break;
                        case TypeCode.HASHTABLE:
                            a[i] = TypeExt.native2js(Photon.EmTypesLib.TableAt(x, i));
                            break;
                        case TypeCode.DICTIONARY:
                            a[i] = new NativeDict(x, i);
                            break;
                        case TypeCode.OBJECT:
                            a[i] = TypeExt.native2js(Photon.EmTypesLib.ObjectAt(x, i));
                            break;
                        case TypeCode.ARRAY:
                        case TypeCode.BYTEARRAY:
                        case TypeCode.PHOTON_COMMAND:
                        case TypeCode.EG_NULL:
                        case TypeCode.CUSTOM:
                        case TypeCode.UNKNOWN:
                        default:
                            this.logger.exception(305, "native2js: Unsupported data type ", t, " for value ", x);
                    }
                }
                return a;
            }
            switch (t) {
                case TypeCode.BYTE:
                    return Photon.EmTypesLib.GetByte(x);
                case TypeCode.SHORT:
                    return Photon.EmTypesLib.GetShort(x);
                case TypeCode.INTEGER:
                    return Photon.EmTypesLib.GetInt(x);
                case TypeCode.LONG:
                    return TypeExt.Long(Photon.EmTypesLib.GetLongLow(x), Photon.EmTypesLib.GetLongHigh(x));
                case TypeCode.FLOAT:
                    return Photon.EmTypesLib.GetFloat(x);
                case TypeCode.DOUBLE:
                    return Photon.EmTypesLib.GetDouble(x);
                case TypeCode.STRING:
                    return Photon.EmTypesLib.GetString(x);
                case TypeCode.BOOLEAN:
                    return Photon.EmTypesLib.GetBool(x);
                case TypeCode.HASHTABLE:
                    var t = Photon.EmTypesLib.GetTable(x);
                    var table = {};
                    for (var i = 0; i < Photon.EmTypesLib.TableSize(t); i++) {
                        table[this.native2js(Photon.EmTypesLib.TableKeyAt(t, i))] = this.native2js(Photon.EmTypesLib.TableValueAt(t, i));
                    }
                    return table;
                case TypeCode.DICTIONARY:
                    return new NativeDict(x);
                case TypeCode.EG_NULL:
                    return null;
                case TypeCode.OBJECT:
                case TypeCode.ARRAY:
                case TypeCode.BYTEARRAY:
                case TypeCode.PHOTON_COMMAND:
                case TypeCode.CUSTOM:
                case TypeCode.UNKNOWN:
                default:
                    this.logger.exception(306, "native2js: Unsupported data type:", t);
            }
        };
        TypeExt.logger = new Photon.Logger("TypeExt");
        return TypeExt;
    }());
    Photon.TypeExt = TypeExt;
})(Photon || (Photon = {}));
/// <reference path="photon-common.ts"/>
/// <reference path="photon-type-ext-em.ts"/>
/**
    Photon
    @namespace Photon
*/
var Photon;
(function (Photon) {
    var _a;
    /**
        @callback Photon.OnLoadCallback
    */
    /**
        @summary Sets the callback to be called on Photon Voice library load finish.
        @method Photon#setOnLoad
        @param {Photon.OnLoadCallback} onLoad Callback.
    **/
    function setOnLoad(onLoad) {
        if (Photon["isLoaded"])
            onLoad();
        else
            Photon["onLoad"] = onLoad;
    }
    Photon.setOnLoad = setOnLoad;
    var EmStatusCode;
    (function (EmStatusCode) {
        EmStatusCode[EmStatusCode["EXCEPTION_ON_CONNECT"] = 1023] = "EXCEPTION_ON_CONNECT";
        EmStatusCode[EmStatusCode["CONNECT"] = 1024] = "CONNECT";
        EmStatusCode[EmStatusCode["DISCONNECT"] = 1025] = "DISCONNECT";
        EmStatusCode[EmStatusCode["EXCEPTION"] = 1026] = "EXCEPTION";
        EmStatusCode[EmStatusCode["QUEUE_OUTGOING_RELIABLE_WARNING"] = 1027] = "QUEUE_OUTGOING_RELIABLE_WARNING";
        EmStatusCode[EmStatusCode["QUEUE_OUTGOING_UNRELIABLE_WARNING"] = 1029] = "QUEUE_OUTGOING_UNRELIABLE_WARNING";
        EmStatusCode[EmStatusCode["SEND_ERROR"] = 1030] = "SEND_ERROR";
        EmStatusCode[EmStatusCode["QUEUE_OUTGOING_ACKS_WARNING"] = 1031] = "QUEUE_OUTGOING_ACKS_WARNING";
        EmStatusCode[EmStatusCode["QUEUE_INCOMING_RELIABLE_WARNING"] = 1033] = "QUEUE_INCOMING_RELIABLE_WARNING";
        EmStatusCode[EmStatusCode["QUEUE_INCOMING_UNRELIABLE_WARNING"] = 1035] = "QUEUE_INCOMING_UNRELIABLE_WARNING";
        EmStatusCode[EmStatusCode["QUEUE_SENT_WARNING"] = 1037] = "QUEUE_SENT_WARNING";
        EmStatusCode[EmStatusCode["INTERNAL_RECEIVE_EXCEPTION"] = 1039] = "INTERNAL_RECEIVE_EXCEPTION";
        EmStatusCode[EmStatusCode["TIMEOUT_DISCONNECT"] = 1040] = "TIMEOUT_DISCONNECT";
        EmStatusCode[EmStatusCode["DISCONNECT_BY_SERVER"] = 1041] = "DISCONNECT_BY_SERVER";
        EmStatusCode[EmStatusCode["DISCONNECT_BY_SERVER_USER_LIMIT"] = 1042] = "DISCONNECT_BY_SERVER_USER_LIMIT";
        EmStatusCode[EmStatusCode["DISCONNECT_BY_SERVER_LOGIC"] = 1043] = "DISCONNECT_BY_SERVER_LOGIC";
        EmStatusCode[EmStatusCode["ENCRYPTION_ESTABLISHED"] = 1048] = "ENCRYPTION_ESTABLISHED";
        EmStatusCode[EmStatusCode["ENCRYPTION_FAILED_TO_ESTABLISH"] = 1049] = "ENCRYPTION_FAILED_TO_ESTABLISH";
    })(EmStatusCode || (EmStatusCode = {}));
    var EmPeerState;
    (function (EmPeerState) {
        EmPeerState[EmPeerState["DISCONNECTED"] = 0] = "DISCONNECTED";
        EmPeerState[EmPeerState["CONNECTING"] = 1] = "CONNECTING";
        EmPeerState[EmPeerState["INITIALIZING_APPLICATION"] = 2] = "INITIALIZING_APPLICATION";
        EmPeerState[EmPeerState["CONNECTED"] = 3] = "CONNECTED";
        EmPeerState[EmPeerState["DISCONNECTING"] = 4] = "DISCONNECTING";
    })(EmPeerState || (EmPeerState = {}));
    /**
        @summary These are the options that can be used as underlying transport protocol.
        @member Photon.ConnectionProtocol
        @readonly
        @property {number} Ws WebSockets connection.
        @property {number} Wss WebSockets Secure connection.
    **/
    var ConnectionProtocol;
    (function (ConnectionProtocol) {
        ConnectionProtocol[ConnectionProtocol["Ws"] = 0] = "Ws";
        ConnectionProtocol[ConnectionProtocol["Wss"] = 1] = "Wss";
    })(ConnectionProtocol = Photon.ConnectionProtocol || (Photon.ConnectionProtocol = {}));
    var PhotonPeer = /** @class */ (function () {
        /**
            @classdesc Instances of the PhotonPeer class are used to connect to a Photon server and communicate with it.
            A PhotonPeer instance allows communication with the Photon Server, which in turn distributes messages to other PhotonPeer clients.
            An application can use more than one PhotonPeer instance, which are treated as separate users on the server.
            Each should have its own listener instance, to separate the operations, callbacks and events.
            @constructor Photon.PhotonPeer
            @param {Photon.ConnectionProtocol} protocol Connection protocol
            @param {string} address Server address:port.
            @param {string} [subprotocol=""] WebSocket protocol.
            @param {string} [debugName=""] Log messages prefixed with this value.
        */
        function PhotonPeer(protocol, address, subprotocol, debugName) {
            if (subprotocol === void 0) { subprotocol = ""; }
            if (debugName === void 0) { debugName = ""; }
            this.protocol = protocol;
            this.address = address;
            this.subprotocol = subprotocol;
            this.closed = false;
            this._peerStatusListeners = {};
            this._eventListeners = {};
            this._responseListeners = {};
            this.lastRtt = 0;
            this.initTimestamp = Date.now();
            this.peer = Photon.EmPhotonPeerLib.Create(protocol == Photon.ConnectionProtocol.Wss, this.onStatusChangedFunc(), this.onOpResponseFunc(), this.onEventFunc(), this.debugReturnFunc());
            this._logger = new Photon.Logger(debugName && debugName != "" ? debugName + ":" : "");
        }
        PhotonPeer.prototype.Destroy = function () {
            if (this.timer) {
                clearInterval(this.timer);
            }
            Photon.EmPhotonPeerLib.Destroy(this.peer);
        };
        /**
            @summary Checks if peer is connecting.
            @method Photon.PhotonPeer#isConnecting
            @returns {boolean} True if peer is connecting.
        */
        PhotonPeer.prototype.isConnecting = function () { return Photon.EmPhotonPeerLib.State(this.peer) == EmPeerState.CONNECTING; };
        PhotonPeer.prototype.getRtt = function () { return Photon.EmPhotonPeerLib.GetRoundTripTime(this.peer); };
        PhotonPeer.prototype.getServerTimeMs = function () { return Photon.EmPhotonPeerLib.GetServerTime(this.peer); };
        PhotonPeer.prototype.ping = function (syncServerTime) {
            if (syncServerTime === void 0) { syncServerTime = false; }
            if (syncServerTime) {
                Photon.EmPhotonPeerLib.FetchServerTimestamp(this.peer);
            }
        };
        /**
            @summary Checks if peer is connected.
            @method Photon.PhotonPeer#isConnected
            @returns {boolean} True if peer is connected.
        */
        PhotonPeer.prototype.isConnected = function () { return Photon.EmPhotonPeerLib.State(this.peer) == EmPeerState.CONNECTED; };
        /**
            @summary Checks if peer is closing.
            @method Photon.PhotonPeer#isClosing
            @returns {boolean} True if peer is closing.
        */
        PhotonPeer.prototype.isClosing = function () { return Photon.EmPhotonPeerLib.State(this.peer) == EmPeerState.DISCONNECTING; };
        /**
            @summary Starts connection to server.
            @method Photon.PhotonPeer#connect
        */
        PhotonPeer.prototype.connect = function (appID) {
            Photon.EmPhotonPeerLib.Connect(this.peer, this.address, appID);
            this.startService();
        };
        PhotonPeer.prototype.startService = function () {
            var peer = this.peer;
            var t = this;
            if (this.timer) {
                clearInterval(this.timer);
            }
            this.timer = setInterval(function () {
                if (!t.closed) {
                    Photon.EmPhotonPeerLib.Service(peer);
                    // t.service();
                }
            }, PhotonPeer.serviceIntervalMs);
        };
        /**
            @summary Disconnects from server.
            @method Photon.PhotonPeer#disconnect
        */
        PhotonPeer.prototype.disconnect = function () {
            Photon.EmPhotonPeerLib.Disconnect(this.peer);
        };
        /**
            @summary Sends operation to the Photon Server.
            @method Photon.PhotonPeer#sendOperation
            @param {number} code Code of operation.
            @param {object} [data] Parameters of operation as a flattened array of key-value pairs: [key1, value1, key2, value2...]
            @param {boolean} [sendReliable=false] Selects if the operation must be acknowledged or not. If false, the operation is not guaranteed to reach the server.
            @param {number} [channelId=0] The channel in which this operation should be sent.
        */
        PhotonPeer.prototype.sendOperation = function (code, data, sendReliable, channelId) {
            if (sendReliable === void 0) { sendReliable = false; }
            if (channelId === void 0) { channelId = 0; }
            if (!Photon.Util.isArray(data)) {
                if (data === undefined) {
                    data = [];
                }
                else {
                    this._logger.exception(201, "PhotonPeer[sendOperation] - Trying to send non array data:", data);
                }
            }
            var nativeTempRefs = [];
            var opReq = Photon.EmPhotonPeerLib.OperationRequestCreate(code);
            for (var i = 0; i < data.length; i += 2) {
                var v = Photon.TypeExt.js2native(nativeTempRefs, data[i + 1]);
                if (v != undefined) {
                    Photon.EmPhotonPeerLib.OperationRequestSetParam(opReq, data[i], v);
                }
            }
            for (i = 0; i < nativeTempRefs.length; i++) {
                Photon.EmTypesLib.Destroy(nativeTempRefs[i]);
            }
            Photon.EmPhotonPeerLib.OpCustom(this.peer, opReq, sendReliable, channelId, false);
            Photon.EmPhotonPeerLib.OperationRequestDestroy(opReq);
            this._logger.debug("PhotonPeer[sendOperation] - Sending request:", code);
        };
        /**
            @summary Registers listener for peer status change.
            @method Photon.PhotonPeer#addPeerStatusListener
            @param {PhotonPeer.StatusCodes} statusCode Status change to this value will be listening.
            @param {Function} callback The listener function that processes the status change. This function don't accept any parameters.
        */
        PhotonPeer.prototype.addPeerStatusListener = function (statusCode, callback) {
            this._addListener(this._peerStatusListeners, statusCode, callback);
        };
        /**
            @summary Registers listener for custom event.
            @method Photon.PhotonPeer#addEventListener
            @param {number} eventCode Custom event code.
            @param {Function} callback The listener function that processes the event. This function may accept object with event content.
        */
        PhotonPeer.prototype.addEventListener = function (eventCode, callback) {
            this._addListener(this._eventListeners, eventCode.toString(), callback);
        };
        /**
            @summary Registers listener for operation response.
            @method Photon.PhotonPeer#addResponseListener
            @param {number} operationCode Operation code.
            @param {Function} callback The listener function that processes the event. This function may accept object with operation response content.
        */
        PhotonPeer.prototype.addResponseListener = function (operationCode, callback) {
            this._addListener(this._responseListeners, operationCode.toString(), callback);
        };
        /**
            @summary Removes listener if exists for peer status change.
            @method Photon.PhotonPeer#removePeerStatusListener
            @param {string} statusCode One of PhotonPeer.StatusCodes to remove listener for.
            @param {Function} callback Listener to remove.
        */
        PhotonPeer.prototype.removePeerStatusListener = function (statusCode, callback) {
            this._removeListener(this._peerStatusListeners, statusCode, callback);
        };
        /**
            @summary Removes listener if exists for custom event.
            @method Photon.PhotonPeer#removeEventListener
            @param {number} eventCode Event code to remove to remove listener for.
            @param {Function} callback Listener to remove.
        */
        PhotonPeer.prototype.removeEventListener = function (eventCode, callback) {
            this._removeListener(this._eventListeners, eventCode.toString(), callback);
        };
        /**
            @summary Removes listener if exists for operation response.
            @method Photon.PhotonPeer#removeResponseListener
            @param {number} operationCode Operation code to remove listener for.
            @param {Function} callback Listener to remove.
        */
        PhotonPeer.prototype.removeResponseListener = function (operationCode, callback) {
            this._removeListener(this._responseListeners, operationCode.toString(), callback);
        };
        /**
            @summary Removes all listeners for peer status change specified.
            @method Photon.PhotonPeer#removePeerStatusListenersForCode
            @param {string} statusCode One of PhotonPeer.StatusCodes to remove all listeners for.
        */
        PhotonPeer.prototype.removePeerStatusListenersForCode = function (statusCode) {
            this._removeListenersForCode(this._peerStatusListeners, statusCode);
        };
        /**
            @summary Removes all listeners for custom event specified.
            @method Photon.PhotonPeer#removeEventListenersForCode
            @param {number} eventCode Event code to remove all listeners for.
        */
        PhotonPeer.prototype.removeEventListenersForCode = function (eventCode) {
            this._removeListenersForCode(this._eventListeners, eventCode.toString());
        };
        /**
            @summary Removes all listeners for operation response specified.
            @method Photon.PhotonPeer#removeResponseListenersForCode
            @param {number} operationCode Operation code to remove all listeners for.
        */
        PhotonPeer.prototype.removeResponseListenersForCode = function (operationCode) {
            this._removeListenersForCode(this._responseListeners, operationCode.toString());
        };
        /**
            @summary Sets peer logger level.
            @method Photon.PhotonPeer#setLogLevel
            @param {Photon.Logger.Level} level Logging level.
        */
        PhotonPeer.prototype.setLogLevel = function (level) {
            var _a;
            this._logger.setLevel(level);
            var emLevel = (_a = {},
                //[Photon.Level.Logger.TRACE]
                _a[Photon.LogLevel.DEBUG] = 4,
                _a[Photon.LogLevel.INFO] = 3,
                _a[Photon.LogLevel.WARN] = 2,
                _a[Photon.LogLevel.ERROR] = 1,
                //[Photon.LogLevel.FATAL]
                _a[Photon.LogLevel.OFF] = 0,
                _a)[level];
            if (emLevel != undefined) {
                Photon.EmPhotonPeerLib.SetDebugOutputLevel(this.peer, emLevel);
            }
        };
        /**
            @summary Called if no listener found for received custom event.
            Override to relay unknown event to user's code or handle known events without listener registration.
            @method Photon.PhotonPeer#onUnhandledEvent
            @param {number} eventCode Code of received event.
            @param {object} [args] Content of received event or empty object.
        */
        PhotonPeer.prototype.onUnhandledEvent = function (eventCode, args) {
            this._logger.warn('PhotonPeer: No handler for event', eventCode, 'registered.');
        };
        /**
            @summary Called if no listener found for received operation response event.
            Override to relay unknown response to user's code or handle known responses without listener registration.
            @method Photon.PhotonPeer#onUnhandledEvent
            @param {number} operationCode Code of received response.
            @param {object} [args] Content of received response or empty object.
        */
        PhotonPeer.prototype.onUnhandledResponse = function (operationCode, args) {
            this._logger.warn('PhotonPeer: No handler for response', operationCode, 'registered.');
        };
        PhotonPeer.prototype._dispatchEvent = function (code, args, argsNative) {
            if (argsNative && this.onEventNative) {
                if (this.onEventNative(code, argsNative)) {
                    return;
                }
            }
            if (!this._dispatch(this._eventListeners, code.toString(), args, "event")) {
                this.onUnhandledEvent(code, args);
            }
        };
        PhotonPeer.prototype._dispatchResponse = function (code, args) {
            if (!this._dispatch(this._responseListeners, code.toString(), args, "response")) {
                this.onUnhandledResponse(code, args);
            }
        };
        PhotonPeer.prototype.nativeByteDict2js = function (x) {
            var d = {};
            for (var i = 0; i < Photon.EmTypesLib.ByteDictSize(x); i++) {
                d[Photon.EmTypesLib.ByteDictKeyAt(x, i)] = Photon.TypeExt.native2js(Photon.EmTypesLib.ByteDictValueAt(x, i));
            }
            return d;
        };
        PhotonPeer.prototype.debugReturnFunc = function () {
            var t = this;
            return function (level, messagePtr) {
                var message = Photon.EmTypesLib.UTF8ToString(messagePtr);
                switch (level) {
                    case 1:
                        t._logger.error(message);
                        break;
                    case 2:
                        t._logger.warn(message);
                        break;
                    case 3:
                        t._logger.info(message);
                        break;
                    case 4:
                        t._logger.debug(message);
                        break;
                    default:
                        t._logger.info("[unknown log level " + level + "]" + message);
                }
            };
        };
        PhotonPeer.prototype.onEventFunc = function () {
            var t = this;
            return function (code, content) {
                switch (code) {
                    default:
                        t._dispatchEvent(code, { vals: t.nativeByteDict2js(content) }, content);
                        break;
                }
            };
        };
        PhotonPeer.prototype.onOpResponseFunc = function () {
            var t = this;
            return function (errCode, errMsg, code, content) {
                switch (code) {
                    default:
                        t._dispatchResponse(code, { errCode: errCode, errMsg: Photon.EmTypesLib.UTF8ToString(errMsg), vals: t.nativeByteDict2js(content) });
                        break;
                }
            };
        };
        PhotonPeer.prototype.onStatusChangedFunc = function () {
            var t = this;
            return function (emStatus) {
                var status = PhotonPeer.StatusCodeEmToJs[emStatus];
                t._logger.debug('PhotonPeer onStatusChangedFunc', emStatus, '->', status);
                if (status) {
                    t._dispatchPeerStatus(status);
                }
            };
        };
        PhotonPeer.prototype._addListener = function (listeners, code, callback) {
            if (!(code in listeners)) {
                listeners[code] = [];
            }
            if (callback && typeof callback === "function") {
                this._logger.debug('PhotonPeer[_addListener] - Adding listener for event', code);
                listeners[code].push(callback);
            }
            else {
                this._logger.error('PhotonPeer[_addListener] - Listener', code, 'is not a function but of type', typeof callback, '. No listener added!');
            }
            return this;
        };
        PhotonPeer.prototype._dispatch = function (listeners, code, args, debugType) {
            if (code in listeners) {
                var events = listeners[code];
                for (var i = 0, l = events.length; i < l; i++) {
                    if (!Photon.Util.isArray(args)) {
                        args = [args];
                    }
                    events[i].apply(this, args === undefined ? [] : args);
                }
                return true;
            }
            else {
                return false;
            }
        };
        PhotonPeer.prototype._dispatchPeerStatus = function (code) {
            if (!this._dispatch(this._peerStatusListeners, code, undefined, "peerStatus")) {
                this._logger.warn('PhotonPeer[_dispatchPeerStatus] - No handler for ', code, 'registered.');
            }
        };
        PhotonPeer.prototype._removeListener = function (listeners, code, callback) {
            if ((code in listeners)) {
                var prevLenght = listeners[code].length;
                listeners[code] = listeners[code].filter(function (x) { return x != callback; });
                this._logger.debug('PhotonPeer[_removeListener] - Removing listener for event', code, "removed:", prevLenght - listeners[code].length);
            }
            return this;
        };
        PhotonPeer.prototype._removeListenersForCode = function (listeners, code) {
            this._logger.debug('PhotonPeer[_removeListenersForCode] - Removing all listeners for event', code);
            if (code in listeners) {
                listeners[code] = [];
            }
            return this;
        };
        /**
            @summary Defines how frequently native peer service() gets called. Lower values decrease lattency but take more cpu.
            @member Photon.PhotonPeer#serviceIntervalMs
            @type {number}
            @default 20
        */
        PhotonPeer.serviceIntervalMs = 20;
        /**
            @summary Enum for peer status codes.
            Use to subscribe to status changes.
            @member Photon.PhotonPeer.StatusCodes
            @readonly
            @property {string} connecting Is connecting to server.
            @property {string} connect Connected to server.
            @property {string} connectFailed Connection to server failed.
            @property {string} disconnect Disconnected from server.
            @property {string} connectClosed Connection closed by server.
            @property {string} error General connection error.
            @property {string} timeout Disconnected from server for timeout.
        */
        PhotonPeer.StatusCodes = {
            connecting: "connecting",
            connect: "connect",
            connectFailed: "connectFailed",
            disconnect: "disconnect",
            connectClosed: "connectClosed",
            error: "error",
            timeout: "timeout",
        };
        PhotonPeer.StatusCodeEmToJs = (_a = {},
            _a[EmStatusCode.EXCEPTION_ON_CONNECT] = PhotonPeer.StatusCodes.connectFailed,
            _a[EmStatusCode.CONNECT] = PhotonPeer.StatusCodes.connect,
            _a[EmStatusCode.DISCONNECT] = PhotonPeer.StatusCodes.disconnect,
            _a[EmStatusCode.EXCEPTION] = PhotonPeer.StatusCodes.error,
            _a[EmStatusCode.QUEUE_OUTGOING_RELIABLE_WARNING] = PhotonPeer.StatusCodes.connectFailed,
            _a[EmStatusCode.QUEUE_OUTGOING_UNRELIABLE_WARNING] = PhotonPeer.StatusCodes.connectFailed,
            _a[EmStatusCode.SEND_ERROR] = PhotonPeer.StatusCodes.error,
            //            [EmStatusCode.QUEUE_OUTGOING_ACKS_WARNING]        :  PhotonPeer.StatusCodes.connectFailed,
            //            [EmStatusCode.QUEUE_INCOMING_RELIABLE_WARNING]    :  PhotonPeer.StatusCodes.connectFailed,
            //            [EmStatusCode.QUEUE_INCOMING_UNRELIABLE_WARNING]  :  PhotonPeer.StatusCodes.connectFailed,
            //            [EmStatusCode.QUEUE_SENT_WARNING]                 :  PhotonPeer.StatusCodes.connectFailed,
            _a[EmStatusCode.INTERNAL_RECEIVE_EXCEPTION] = PhotonPeer.StatusCodes.error,
            _a[EmStatusCode.TIMEOUT_DISCONNECT] = PhotonPeer.StatusCodes.timeout,
            _a[EmStatusCode.DISCONNECT_BY_SERVER] = PhotonPeer.StatusCodes.connectClosed,
            _a[EmStatusCode.DISCONNECT_BY_SERVER_USER_LIMIT] = PhotonPeer.StatusCodes.connectClosed,
            _a[EmStatusCode.DISCONNECT_BY_SERVER_LOGIC] = PhotonPeer.StatusCodes.connectClosed,
            //            [EmStatusCode.ENCRYPTION_ESTABLISHED]             :  PhotonPeer.StatusCodes.connectFailed,
            _a[EmStatusCode.ENCRYPTION_FAILED_TO_ESTABLISH] = PhotonPeer.StatusCodes.error,
            _a);
        return PhotonPeer;
    }());
    Photon.PhotonPeer = PhotonPeer;
})(Photon || (Photon = {}));
/**
    Photon Load Balancing API
    @namespace Photon.LoadBalancing
*/
var Photon;
(function (Photon) {
    var LoadBalancing;
    (function (LoadBalancing) {
        var _a;
        var WebFlags = {
            HttpForward: 0x01,
            SendAuthCookie: 0x02,
            SendSync: 0x04,
            SendState: 0x08,
        };
        var Actor = /** @class */ (function () {
            /**
                @classdesc Summarizes a "player" within a room, identified (in that room) by ID (or "actorNr"). Extend to implement custom logic.
                @constructor Photon.LoadBalancing.Actor
                @param {string} name Actor name.
                @param {number} actorNr Actor ID.
                @param {boolean} isLocal Actor is local.
            */
            function Actor(name, actorNr, isLocal) {
                this.name = name;
                this.actorNr = actorNr;
                this.isLocal = isLocal;
                this.userId = "";
                this.customProperties = {};
                this.suspended = false;
            }
            // public getLoadBalancingClient() { return this.loadBalancingClient; }
            /**
                @summary Actor's room: the room initialized by client for create room operation or room client connected to.
                @method Photon.LoadBalancing.Actor#getRoom
                @returns {Photon.LoadBalancing.Room} Actor's room.
            */
            Actor.prototype.getRoom = function () { return this.loadBalancingClient ? this.loadBalancingClient.myRoom() : null; };
            /**
                @summary Raises game custom event.
                @method Photon.LoadBalancing.Actor#raiseEvent
                @param {number} eventCode Identifies this type of event (and the content). Your game's event codes can start with 0.
                @param {object} [data] Custom data you want to send along (use null, if none).
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {number} [options.interestGroup] The ID of the interest group this event goes to (exclusively).
                @property {Photon.LoadBalancing.Constants.EventCaching} [options.cache=EventCaching.DoNotCache] Events can be cached (merged and removed) for players joining later on.
                @property {Photon.LoadBalancing.Constants.ReceiverGroup} [options.receivers=ReceiverGroup.Others] Defines to which group of players the event is passed on.
                @property {number[]} [options.targetActors] Defines the target players who should receive the event (use only for small target groups).
                @property {boolean} [options.webForward=false] Forward to web hook.
            */
            Actor.prototype.raiseEvent = function (eventCode, data, options) {
                if (this.loadBalancingClient) {
                    this.loadBalancingClient.raiseEvent(eventCode, data, options);
                }
            };
            // returns true if local prop can be immediately set: client is not in a room or expected properties are set
            Actor.prototype.setProp = function (name, value, expected) {
                if (expected === void 0) { expected = void 0; }
                if (this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom()) {
                    var props = Photon.TypeExt.TableTypedKeys(); // typed table required to preserve key types
                    Photon.TypeExt.PutTypedKey(props, Photon.TypeExt.Byte(name), value);
                    var expProps;
                    if (expected !== void 0) {
                        expProps = Photon.TypeExt.TableTypedKeys();
                        Photon.TypeExt.PutTypedKey(expProps, Photon.TypeExt.Byte(name), expected);
                    }
                    this.loadBalancingClient._setPropertiesOfActor(this.actorNr, props, false, expProps);
                    return expected === void 0; // update immediately for non-CAS
                }
                else {
                    return true;
                }
            };
            /**
                @summary Sets actor name.
                @method Photon.LoadBalancing.Actor#setName
                @param {string} name Actor name.
            */
            Actor.prototype.setName = function (name) {
                if (this.name != name) {
                    if (this.setProp(LoadBalancing.Constants.ActorProperties.PlayerName, name /*, this.name*/)) // No CAS by design? also expected = "" seems not supported by server currently
                        this.name = name;
                }
            };
            // properties methods
            /**
                @summary Called on every actor properties update: properties set by client, poperties update from server.
                Override to update custom room state.
                @method Photon.LoadBalancing.Actor#onPropertiesChange
                @param {object} changedCustomProps Key-value map of changed properties.
                @param {boolean} [byClient] true if properties set by client.
            */
            Actor.prototype.onPropertiesChange = function (changedCustomProps, byClient) { };
            /**
                @summary Returns custom property by name.
                @method Photon.LoadBalancing.Actor#getCustomProperty
                @param {string} name Name of the property.
                @returns {object} Property or undefined if property not found.
            */
            Actor.prototype.getCustomProperty = function (name) { return this.customProperties[name]; };
            /**
                @summary Returns custom property by name or default value.
                @method Photon.LoadBalancing.Actor#getCustomPropertyOrElse
                @param {string} name Name of the property.
                @param {object} defaultValue Default property value.
                @returns {object} Property or default value if property not found.
            */
            Actor.prototype.getCustomPropertyOrElse = function (name, defaultValue) { return Photon.Util.getPropertyOrElse(this.customProperties, name, defaultValue); };
            /**
                @summary Sets custom property.
                @method Photon.LoadBalancing.Actor#setCustomProperty
                @param {string} name Name of the property.
                @param {object} value Property value.
                @param {boolean} [webForward=false] Forward to web hook.
                @param {object} [expectedValue] Property value expected when update occurs. (CAS : "Check And Swap")
            */
            Actor.prototype.setCustomProperty = function (name, value, webForward, expectedValue) {
                var _a;
                if (webForward === void 0) { webForward = false; }
                var props = {}; // can use js object instead of TypeExt.TableTypedKeys because keys are strings
                props[name] = value;
                var expectedProps;
                if (expectedValue !== void 0) {
                    expectedProps = (_a = {}, _a[name] = expectedValue, _a);
                }
                var joined = this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom();
                if (joined && this.loadBalancingClient) { // extra check to avoid error TS2532: Object is possibly 'undefined'
                    this.loadBalancingClient._setPropertiesOfActor(this.actorNr, props, webForward, expectedProps);
                }
                if (!joined || expectedValue === void 0) {
                    this.customProperties[name] = value;
                    this.onPropertiesChange(props, true);
                }
            };
            /**
                @summary Sets custom properties.
                @method Photon.LoadBalancing.Actor#setCustomProperties
                @param {object} properties Table of properties to set.
                @param {boolean} [webForward=false] Forward to web hook.
                @param {object} [expectedProperties] Table of properties expected when update occurs. Use null as value if you expect the property to not exist. (CAS : "Check And Swap")
            */
            Actor.prototype.setCustomProperties = function (properties, webForward, expectedProperties) {
                if (webForward === void 0) { webForward = false; }
                var joined = this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom();
                if (joined && this.loadBalancingClient) { // extra check to avoid error TS2532: Object is possibly 'undefined'
                    this.loadBalancingClient._setPropertiesOfActor(this.actorNr, properties, webForward, expectedProperties);
                }
                if (!joined || expectedProperties === void 0) {
                    for (var name in properties) {
                        this.customProperties[name] = properties[name];
                    }
                    this.onPropertiesChange(properties, true);
                }
            };
            /**
                @summary Returns true if actor is in suspended state.
                @method Photon.LoadBalancing.Actor#isSuspended
                @returns {boolean} Actor suspend state.
            **/
            Actor.prototype.isSuspended = function () {
                return this.suspended;
            };
            Actor.prototype._getAllProperties = function () {
                var p = {};
                p[LoadBalancing.Constants.ActorProperties.PlayerName] = this.name;
                for (var k in this.customProperties) {
                    p[k] = this.customProperties[k];
                }
                return p;
            };
            Actor.prototype._setLBC = function (lbc) { this.loadBalancingClient = lbc; };
            /**
                @summary Returns custom properties.
                @method Photon.LoadBalancing.Actor#getCustomProperties
                @returns {object} Custom properties.
            **/
            Actor.prototype.getCustomProperties = function () {
                var p = {};
                for (var k in this.customProperties) {
                    p[k] = this.customProperties[k];
                }
                return p;
            };
            Actor.prototype._updateFromResponse = function (vals) {
                this.actorNr = vals[LoadBalancing.Constants.ParameterCode.ActorNr];
                var props = vals[LoadBalancing.Constants.ParameterCode.PlayerProperties];
                if (props !== undefined) {
                    var name = props[LoadBalancing.Constants.ActorProperties.PlayerName];
                    if (name !== undefined) {
                        this.name = name;
                    }
                    var userId = props[LoadBalancing.Constants.ActorProperties.UserId];
                    if (userId !== undefined) {
                        this.userId = userId;
                    }
                    this._updateFromProps(props);
                }
            };
            Actor.prototype._updateMyActorFromResponse = function (vals) {
                this.actorNr = vals[LoadBalancing.Constants.ParameterCode.ActorNr];
            };
            Actor.prototype.updateIfExists = function (prevValue, code, props) {
                if (props.hasOwnProperty(code)) {
                    return props[code];
                }
                else {
                    return prevValue;
                }
            };
            Actor.prototype._updateFromProps = function (props) {
                if (props) {
                    this.name = this.updateIfExists(this.name, LoadBalancing.Constants.ActorProperties.PlayerName, props);
                    var changedProps = {};
                    for (var k in props) {
                        if (parseInt(k).toString() != k) { // if key is not a number
                            if (this.customProperties[k] !== props[k]) {
                                this.customProperties[k] = props[k];
                                changedProps[k] = props[k];
                            }
                        }
                    }
                    this.onPropertiesChange(changedProps, false);
                }
            };
            Actor.prototype._setSuspended = function (s) {
                this.suspended = s;
            };
            Actor._getActorNrFromResponse = function (vals) {
                return vals[LoadBalancing.Constants.ParameterCode.ActorNr];
            };
            return Actor;
        }());
        LoadBalancing.Actor = Actor;
        // readonly room info from server
        var RoomInfo = /** @class */ (function () {
            /**
                @classdesc Used for Room listings of the lobby (not yet joining). Offers the basic info about a room: name, player counts, properties, etc.
                @constructor Photon.LoadBalancing.RoomInfo
                @param {string} name Room name.
            */
            function RoomInfo(name) {
                // standard room properties
                // TODO: access via getters
                /**
                    @summary Room name.
                    @member Photon.LoadBalancing.RoomInfo#name
                    @type {string}
                    @readonly
                */
                this.name = "";
                /**
                    @summary Joined room Game server address.
                    @member Photon.LoadBalancing.RoomInfo#address
                    @type {string}
                    @readonly
                */
                this.address = "";
                /**
                    @summary Max players before room is considered full.
                    @member Photon.LoadBalancing.RoomInfo#maxPlayers
                    @type {number}
                    @readonly
                */
                this.maxPlayers = 0;
                /**
                    @summary Shows the room in the lobby's room list. Makes sense only for local room.
                    @member Photon.LoadBalancing.RoomInfo#isVisible
                    @type {boolean}
                    @readonly
                */
                this.isVisible = true;
                /**
                    @summary Defines if this room can be joined.
                    @member Photon.LoadBalancing.RoomInfo#isOpen
                    @type {boolean}
                    @readonly
                */
                this.isOpen = true;
                /**
                    @summary Count of player currently in room.
                    @member Photon.LoadBalancing.RoomInfo#playerCount
                    @type {number}
                    @readonly
                */
                this.playerCount = 0;
                /**
                    @summary Time in ms indicating how long the room instance will be keeped alive in the server room cache after all clients have left the room.
                    @member Photon.LoadBalancing.RoomInfo#roomTTL
                    @type {number}
                    @readonly
                */
                this.roomTTL = 0;
                /**
                    @deprecated Use {Photon.LoadBalancing.RoomInfo#roomTTL}
                */
                this.emptyRoomLiveTime = 0;
                /**
                    @summary Time in ms indicating how long suspended player will be kept in the room.
                    @member Photon.LoadBalancing.RoomInfo#playerTTL
                    @type {number}
                    @readonly
                **/
                this.playerTTL = 0;
                /**
                    @deprecated Use {Photon.LoadBalancing.RoomInfo#playerTTL}
                */
                this.suspendedPlayerLiveTime = 0;
                /**
                    @summary Room removed (in room list updates).
                    @member Photon.LoadBalancing.RoomInfo#removed
                    @type {boolean}
                    @readonly
                */
                this.removed = false;
                // TODO: does end user need this?
                this.cleanupCacheOnLeave = false;
                /**
                    @summary Master client set by game server. Note: Not all servers support this currently. If the value of the property is 0, use lowest actorid instead.
                    @member Photon.LoadBalancing.RoomInfo#masterClientId
                    @type { number }
                    @readonly
                */
                this.masterClientId = 0;
                // custom properties
                this._customProperties = {};
                this._propsListedInLobby = [];
                this.name = name;
            }
            /**
                @summary Returns custom properties.
                @method Photon.LoadBalancing.RoomInfo#getCustomProperties
                @returns {object} Custom properties.
            **/
            RoomInfo.prototype.getCustomProperties = function () {
                var p = {};
                for (var k in this._customProperties) {
                    p[k] = this._customProperties[k];
                }
                return p;
            };
            /**
                @summary Returns properties listed in lobby.
                @method Photon.LoadBalancing.RoomInfo#getPropsListedInLobby
                @returns {object} Properties listed in lobby.
            **/
            RoomInfo.prototype.getPropsListedInLobby = function () {
                var p = [];
                for (var i = 0; i < this._propsListedInLobby.length; i++) {
                    p[i] = this._propsListedInLobby[i];
                }
                return p;
            };
            /**
                @summary Called on every room properties update: room creation, properties set by client, poperties update from server.
                Override to update custom room state.
                @method Photon.LoadBalancing.RoomInfo#onPropertiesChange
                @param {object} changedCustomProps Key-value map of changed properties.
                @param {boolean} [byClient] true if called on room creation or properties set by client.
            */
            RoomInfo.prototype.onPropertiesChange = function (changedCustomProps, byClient) { };
            /**
                @summary Returns custom property by name.
                @method Photon.LoadBalancing.RoomInfo#getCustomProperty
                @param {string} name Name of the property.
                @returns {object} Property or undefined if property not found.
            */
            RoomInfo.prototype.getCustomProperty = function (prop) { return this._customProperties[prop]; };
            /**
                @summary Returns custom property by name or default value.
                @method Photon.LoadBalancing.RoomInfo#getCustomPropertyOrElse
                @param {string} name Name of the property.
                @param {object} defaultValue Default property value.
                @returns {object} Property or default value if property not found.
            */
            RoomInfo.prototype.getCustomPropertyOrElse = function (prop, defaultValue) { return Photon.Util.getPropertyOrElse(this._customProperties, prop, defaultValue); };
            RoomInfo.prototype._updateFromMasterResponse = function (vals) {
                this.address = vals[LoadBalancing.Constants.ParameterCode.Address];
                var name = vals[LoadBalancing.Constants.ParameterCode.RoomName];
                if (name) {
                    this.name = name;
                }
            };
            RoomInfo.prototype._updateFromProps = function (props) {
                if (props) {
                    this.maxPlayers = this.updateIfExists(this.maxPlayers, LoadBalancing.Constants.GameProperties.MaxPlayers, props);
                    this.isVisible = this.updateIfExists(this.isVisible, LoadBalancing.Constants.GameProperties.IsVisible, props);
                    this.isOpen = this.updateIfExists(this.isOpen, LoadBalancing.Constants.GameProperties.IsOpen, props);
                    this.playerCount = this.updateIfExists(this.playerCount, LoadBalancing.Constants.GameProperties.PlayerCount, props);
                    this.removed = this.updateIfExists(this.removed, LoadBalancing.Constants.GameProperties.Removed, props);
                    this._propsListedInLobby = this.updateIfExists(this._propsListedInLobby, LoadBalancing.Constants.GameProperties.PropsListedInLobby, props);
                    this.cleanupCacheOnLeave = this.updateIfExists(this.cleanupCacheOnLeave, LoadBalancing.Constants.GameProperties.CleanupCacheOnLeave, props);
                    this.masterClientId = this.updateIfExists(this.masterClientId, LoadBalancing.Constants.GameProperties.MasterClientId, props);
                    this.roomTTL = this.emptyRoomLiveTime = this.updateIfExists(this.roomTTL, LoadBalancing.Constants.GameProperties.RoomTTL, props);
                    this.playerTTL = this.suspendedPlayerLiveTime = this.updateIfExists(this.playerTTL, LoadBalancing.Constants.GameProperties.PlayerTTL, props);
                    this.expectedUsers = this.updateIfExists(this.expectedUsers, LoadBalancing.Constants.GameProperties.ExpectedUsers, props);
                    var changedProps = {};
                    for (var k in props) {
                        if (parseInt(k).toString() != k) { // if key is not a number
                            if (this._customProperties[k] !== props[k]) {
                                this._customProperties[k] = props[k];
                                changedProps[k] = props[k];
                            }
                        }
                    }
                    this.onPropertiesChange(changedProps, false);
                }
            };
            RoomInfo.prototype._updateFromEvent = function (payload) {
                if (payload) {
                    this.masterClientId = this.updateIfExists(this.masterClientId, LoadBalancing.Constants.ParameterCode.MasterClientId, payload);
                }
            };
            RoomInfo.prototype.updateIfExists = function (prevValue, code, props) {
                if (props.hasOwnProperty(code)) {
                    return props[code];
                }
                else {
                    return prevValue;
                }
            };
            return RoomInfo;
        }());
        LoadBalancing.RoomInfo = RoomInfo;
        // joined room with writable properties
        var Room = /** @class */ (function (_super) {
            __extends(Room, _super);
            /**
                @classdesc Represents a room client joins or is joined to. Extend to implement custom logic. Custom properties can be set via setCustomProperty() while being in the room.
                @mixes Photon.LoadBalancing.RoomInfo
                @constructor Photon.LoadBalancing.Room
                @param {string} name Room name.
            */
            function Room(name) {
                return _super.call(this, name) || this;
            }
            // room created from client via factory always has this field set
            //public getLoadBalancingClient() { return this.loadBalancingClient; }
            /**
                @summary Sets custom property
                @method Photon.LoadBalancing.Room#setCustomProperty
                @param {string} name Name of the property.
                @param {object} value Property value.
                @param {boolean} [webForward=false] Forward to web hook.
                @param {object} [expectedValue] Property value expected when update occurs. (CAS : "Check And Swap")
            */
            Room.prototype.setCustomProperty = function (name, value, webForward, expectedValue) {
                var _a;
                if (webForward === void 0) { webForward = false; }
                var props = {}; // can use js object instead of TypeExt.TableTypedKeys because keys are strings
                props[name] = value;
                var expectedProps;
                if (expectedValue !== void 0) {
                    expectedProps = (_a = {}, _a[name] = expectedValue, _a);
                }
                var joined = this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom();
                if (joined && this.loadBalancingClient) { // extra check to avoid error TS2532: Object is possibly 'undefined'
                    this.loadBalancingClient._setPropertiesOfRoom(props, webForward, expectedProps);
                }
                if (!joined || expectedValue === void 0) {
                    this._customProperties[name] = value;
                    this.onPropertiesChange(props, true);
                }
            };
            /**
                @summary Sets custom property
                @method Photon.LoadBalancing.Room#setCustomProperties
                @param {object} properties Table of properties to set.
                @param {boolean} [webForward=false] Forward to web hook.
                @param {object} [expectedProperties] Table of properties expected when update occurs. Use null as value if you expect the property to not exist. (CAS : "Check And Swap")
            */
            Room.prototype.setCustomProperties = function (properties, webForward, expectedProperties) {
                if (webForward === void 0) { webForward = false; }
                var joined = this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom();
                if (joined && this.loadBalancingClient) { // extra check to avoid error TS2532: Object is possibly 'undefined'
                    this.loadBalancingClient._setPropertiesOfRoom(properties, webForward, expectedProperties);
                }
                if (!joined || expectedProperties === void 0) {
                    for (var name in properties) {
                        this._customProperties[name] = properties[name];
                    }
                    this.onPropertiesChange(properties, true);
                }
            };
            // returns true if local prop can be immediately set: client is not in a room or expected properties are set
            Room.prototype.setProp = function (name, value, expected) {
                if (expected === void 0) { expected = void 0; }
                if (this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom()) {
                    var props = Photon.TypeExt.TableTypedKeys(); // typed table required to preserve key types
                    Photon.TypeExt.PutTypedKey(props, Photon.TypeExt.Byte(name), value);
                    var expProps;
                    if (expected !== void 0) {
                        expProps = Photon.TypeExt.TableTypedKeys();
                        Photon.TypeExt.PutTypedKey(expProps, Photon.TypeExt.Byte(name), expected);
                    }
                    this.loadBalancingClient._setPropertiesOfRoom(props, false, expProps);
                    return expected === void 0; // update immediately for non-CAS
                }
                else {
                    return true;
                }
            };
            /**
             * @summary Sets rooms visibility in the lobby's room list.
             * @method Photon.LoadBalancing.Room#setIsVisible
             * @param {boolean} isVisible New visibility value.
            */
            Room.prototype.setIsVisible = function (isVisible) {
                if (this.isVisible != isVisible) {
                    if (this.setProp(LoadBalancing.Constants.GameProperties.IsVisible, Photon.TypeExt.Bool(isVisible), Photon.TypeExt.Bool(this.isVisible)))
                        this.isVisible = isVisible;
                }
            };
            /**
             * @summary Sets if this room can be joined.
             * @method Photon.LoadBalancing.Room#setIsOpen
             * @param {boolean} isOpen New property value.
            */
            Room.prototype.setIsOpen = function (isOpen) {
                if (this.isOpen != isOpen) {
                    if (this.setProp(LoadBalancing.Constants.GameProperties.IsOpen, Photon.TypeExt.Bool(isOpen), Photon.TypeExt.Bool(this.isOpen)))
                        this.isOpen = isOpen;
                }
            };
            /**
             * @summary Sets max players before room is considered full.
             * @method Photon.LoadBalancing.Room#setMaxPlayers
             * @param {number} maxPlayers New max players value.
            */
            Room.prototype.setMaxPlayers = function (maxPlayers) {
                if (this.maxPlayers != maxPlayers) {
                    if (this.setProp(LoadBalancing.Constants.GameProperties.MaxPlayers, Photon.TypeExt.Byte(maxPlayers), Photon.TypeExt.Byte(this.maxPlayers)))
                        this.maxPlayers = maxPlayers;
                }
            };
            /**
                @summary Sets room Time To Live in the server room cache after all clients have left the room.
                @method Photon.LoadBalancing.Room#setRoomTTL
                @param {number} ttl New Time To Live value in ms.
            */
            Room.prototype.setRoomTTL = function (ttl) {
                if (this.roomTTL != ttl) {
                    if (this.setProp(LoadBalancing.Constants.GameProperties.RoomTTL, Photon.TypeExt.Int(ttl) /*, TypeExt.Int(this.roomTTL)*/)) // No CAS by design, also expected = 0 is not supported by server currently
                        this.roomTTL = this.emptyRoomLiveTime = ttl;
                }
            };
            /**
                @deprecated Use {Photon.LoadBalancing.Room.setRoomTTL}
            */
            Room.prototype.setEmptyRoomLiveTime = function (ttl) {
                this.setRoomTTL(ttl);
            };
            /**
                @summary Sets player Time To Live indicating how long suspended player will be kept in the room.
                @method Photon.LoadBalancing.Room#setPlayerTTL
                @param {number} ttl New Time To Live value in ms.
            */
            Room.prototype.setPlayerTTL = function (ttl) {
                if (this.playerTTL != ttl) {
                    if (this.setProp(LoadBalancing.Constants.GameProperties.PlayerTTL, Photon.TypeExt.Int(ttl) /*, TypeExt.Int(this.playerTTL)*/)) // No CAS by design, also expected = 0 is not supported by server currently
                        this.playerTTL = this.suspendedPlayerLiveTime = ttl;
                }
            };
            /**
                @deprecated Use {Photon.LoadBalancing.Room.setPlayerTTL}
            */
            Room.prototype.setSuspendedPlayerLiveTime = function (ttl) {
                this.setPlayerTTL(ttl);
            };
            /**
                @summary Sets expected server plugins.
                @method Photon.LoadBalancing.Room#setPlugins
                @param {string[]} plugins New plugins list.
            */
            Room.prototype.setPlugins = function (plugins) {
                this.plugins = plugins;
            };
            /**
                @summary Sets list of the room properties to pass to the RoomInfo list in a lobby.
                @method Photon.LoadBalancing.Room#setPropsListedInLobby
                @param {string[]} props Array of properties names.
            */
            Room.prototype.setPropsListedInLobby = function (props) {
                this._propsListedInLobby = props;
            };
            /**
                @summary Sets list of the room properties to pass to the RoomInfo list in a lobby.
                @method Photon.LoadBalancing.Room#setPropsListedInLobby
                @param {string[]} props Array of properties names.
            */
            Room.prototype.setExpectedUsers = function (props) {
                var upd = null;
                var exp = null;
                if (props && props.length != 0) {
                    upd = Photon.TypeExt.String(props);
                }
                if (this.expectedUsers && this.expectedUsers.length != 0) {
                    exp = Photon.TypeExt.String(this.expectedUsers);
                }
                if (this.setProp(LoadBalancing.Constants.GameProperties.ExpectedUsers, upd, exp)) {
                    this.expectedUsers = props;
                }
            };
            /**
                @summary Attempts to remove all current expected users from the server's Slot Reservation list.
                Note that this operation can conflict with new/other users joining. They might be
                adding users to the list of expected users before or after this client called ClearExpectedUsers.
                This room's expectedUsers value will update, when the server sends a successful update.
                Internals: This methods wraps up setting the ExpectedUsers property of a room.
                @method Photon.LoadBalancing.Room#clearExpectedUsers
            */
            Room.prototype.clearExpectedUsers = function () {
                var exp = null;
                if (this.expectedUsers && this.expectedUsers.length != 0) {
                    exp = Photon.TypeExt.String(this.expectedUsers);
                }
                if (this.setProp(LoadBalancing.Constants.GameProperties.ExpectedUsers, null, exp)) {
                    this.expectedUsers = void 0;
                }
            };
            /**
                @summary Asks the server to assign another player as Master Client of your current room.
                This method calls an operation on the server to set a new Master Client, which takes a roundtrip.
                In case of success, this client and the others get the new Master Client from the server.
                @method Photon.LoadBalancing.Room#setMasterClient
                @param {number} actorNr New Master Client actor ID.
            */
            Room.prototype.setMasterClient = function (actorNr) {
                if (this.setProp(LoadBalancing.Constants.GameProperties.MasterClientId, actorNr, this.masterClientId))
                    this.masterClientId = actorNr;
            };
            Room.prototype._setLBC = function (lbc) { this.loadBalancingClient = lbc; };
            return Room;
        }(RoomInfo));
        LoadBalancing.Room = Room;
        var LoadBalancingClient = /** @class */ (function () {
            /**
                @classdesc Implements the Photon LoadBalancing workflow. This class should be extended to handle system or custom events and operation responses.
                @constructor Photon.LoadBalancing.LoadBalancingClient
                @param {Photon.ConnectionProtocol} protocol Connecton protocol.
                @param {string} appId Cloud application ID.
                @param {string} appVersion Cloud application version.
            */
            function LoadBalancingClient(protocol, appId, appVersion) {
                this.appId = appId;
                this.appVersion = appVersion;
                // internal use only
                this.onEventNative = null;
                //------------------------
                this.connectionProtocol = 0; // protocol set in constructor, can be overriden by prefix in server address string
                this.masterServerAddress = "";
                this.nameServerAddress = "";
                // if true, do not treat disconnection by server as error (when leaving a room)
                this.gamePeerWaitingForDisconnect = false;
                // protected
                this.autoJoinLobby = true; // hardcoded behaviour; inheritor class can override this
                // options mainly keep state between servers
                // set / cleared in connectToNameServer()(connectToRegionMaster()), connect()
                // lobbyName and lobbyType passed to JoinLobby operation (we don't have separate JoinLobby operation and set them in connect())
                this.connectOptions = {};
                // shares lobby info between Master and Game CreateGame calls (createRoomInternal)
                this.createRoomOptions = {};
                // shares options between Master and Game JoinGame operations
                this.joinRoomOptions = {};
                this.roomInfos = new Array();
                this.roomInfosDict = {}; // 'by name' access support
                this.actors = {};
                this.actorsArray = []; // actors 'at index' access support (Scirra/Costruct 2)
                this.lowestActorId = 0; // master client support
                this.userId = "";
                this.userAuthType = LoadBalancing.Constants.CustomAuthenticationType.None;
                this.userAuthParameters = "";
                this.userAuthData = "";
                this.findFriendsRequestList = [];
                this.lobbyStatsRequestList = new Array();
                this.state_ = LoadBalancingClient.State.Uninitialized;
                this.logger = new Photon.Logger("Client:");
                this.validNextState = {};
                var serverAddress = "";
                if (typeof (protocol) == "number") {
                    this.connectionProtocol = protocol;
                    switch (protocol) {
                        case Photon.ConnectionProtocol["Ws"]:
                            this.masterServerAddress = "";
                            this.nameServerAddress = "ws://ns.photonengine.io:9093";
                            break;
                        case Photon.ConnectionProtocol["Wss"]:
                            this.masterServerAddress = "";
                            this.nameServerAddress = "wss://ns.photonengine.io:19093";
                            break;
                        default:
                            var s0 = "wrong_protocol_error";
                            this.masterServerAddress = s0;
                            this.nameServerAddress = s0;
                            this.logger.error("Wrong protocol: ", protocol);
                            break;
                    }
                }
                else if (typeof (protocol) == "string") { // compatibility with previous constructor version
                    this.connectionProtocol = Photon.ConnectionProtocol.Ws;
                    var s = protocol;
                    this.masterServerAddress = s;
                    this.nameServerAddress = s;
                }
                else {
                    this.connectionProtocol = Photon.ConnectionProtocol.Ws;
                    var s1 = "wrong_protocol_type_error";
                    this.masterServerAddress = s1;
                    this.nameServerAddress = s1;
                    this.logger.error("Wrong protocol type: ", typeof (protocol));
                }
                this.initValidNextState();
                this.currentRoom = this.roomFactoryInternal("");
                this._myActor = this.actorFactoryInternal("", -1, true);
                this.addActor(this._myActor);
            }
            // override to handle system events:
            /**
                @summary Called on client state change. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onStateChange
                @param {Photon.LoadBalancing.LoadBalancingClient.State} state New client state.
            */
            LoadBalancingClient.prototype.onStateChange = function (state) { };
            /**
                @summary Called if client error occures. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onError
                @param {Photon.LoadBalancing.LoadBalancingClient.PeerErrorCode} errorCode Client error code.
                @param {string} errorMsg Error message.
            */
            LoadBalancingClient.prototype.onError = function (errorCode, errorMsg) { };
            /**
                @summary Called on operation response. Override if need custom workflow or response error handling.
                @method Photon.LoadBalancing.LoadBalancingClient#onOperationResponse
                @param {number} errorCode Server error {@link Photon.LoadBalancing.Constants.ErrorCode code}.
                @param {string} errorMsg Error message.
                @param {number} code Operation {@link Photon.LoadBalancing.Constants.OperationCode code}.
                @param {object} content Operation response content.
            */
            LoadBalancingClient.prototype.onOperationResponse = function (errorCode, errorMsg, code, content) { };
            /**
                @summary Called on custom event. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onEvent
                @param {number} code Event code.
                @param {object} content Event content.
                @param {number} actorNr Actor ID event raised by.
            */
            LoadBalancingClient.prototype.onEvent = function (code, content, actorNr) { };
            /**
                @summary Called on room list received from Master server (on connection). Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onRoomList
                @param {Photon.LoadBalancing.RoomInfo[]} rooms Room list.
            */
            LoadBalancingClient.prototype.onRoomList = function (rooms) { };
            /**
                @summary Called on room list updates received from Master server. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onRoomListUpdate
                @param {Photon.LoadBalancing.RoomInfo[]} rooms Updated room list.
                @param {Photon.LoadBalancing.RoomInfo[]} roomsUpdated Rooms whose properties were changed.
                @param {Photon.LoadBalancing.RoomInfo[]} roomsAdded New rooms in list.
                @param {Photon.LoadBalancing.RoomInfo[]} roomsRemoved Rooms removed from list.
            */
            LoadBalancingClient.prototype.onRoomListUpdate = function (rooms, roomsUpdated, roomsAdded, roomsRemoved) { };
            // TODO: move to Room? Or remove and use Room.onPropertiesChange only?
            /**
                @summary Called on joined room properties changed event. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onMyRoomPropertiesChange
            */
            LoadBalancingClient.prototype.onMyRoomPropertiesChange = function () { };
            /**
                @summary Called on actor properties changed event. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onActorPropertiesChange
                @param {Photon.LoadBalancing.Actor} actor Actor whose properties were changed.
            */
            LoadBalancingClient.prototype.onActorPropertiesChange = function (actor) { };
            /**
                @summary Called when client joins room. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onJoinRoom
                @param {boolean} createdByMe True if room is created by client.
            */
            LoadBalancingClient.prototype.onJoinRoom = function (createdByMe) { };
            /**
                @summary Called when new actor joins the room client joined to. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onActorJoin
                @param {Photon.LoadBalancing.Actor} actor New actor.
            */
            LoadBalancingClient.prototype.onActorJoin = function (actor) { };
            /**
                @summary Called when actor leaves the room client joined to. Also called for every actor during room cleanup. Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onActorLeave
                @param {Photon.LoadBalancing.Actor} actor Actor left the room.
                @param {boolean} cleanup True if called during room cleanup (e.g. on disconnect).
            */
            LoadBalancingClient.prototype.onActorLeave = function (actor, cleanup) { };
            /**
                @summary Called when actor suspended in the room client joined to.Override to handle it.
                @method Photon.LoadBalancing.LoadBalancingClient#onActorSuspend
                @param {Photon.LoadBalancing.Actor} actor Actor suspended in the room.
            */
            LoadBalancingClient.prototype.onActorSuspend = function (actor) { };
            /**
                @summary Called when {@link Photon.LoadBalancing.LoadBalancingClient#findFriends findFriends} request completed. <br/>
                Override to handle request results.
                @method Photon.LoadBalancing.LoadBalancingClient#onFindFriendsResult
                @param {number} errorCode Result error code. 0 if request is successful.
                @param {string} errorMsg Error message.
                @param {object} friends Table with actors names as keys and friend statuses as values: {name1: friendStatus1, name2: friendStatus2, ... }.
                @property {object} friendStatus Friend status.
                @property {boolean} friendStatus.online Online status.
                @property {string} friendStatus.roomId Joined room.
            */
            LoadBalancingClient.prototype.onFindFriendsResult = function (errorCode, errorMsg, friends) { };
            /**
                @summary Called when lobbies statistics update received. <br/>
                Update can be automated by set up during {@link Photon.LoadBalancing.LoadBalancingClient#connect connect} or requested explicitly by {@link Photon.LoadBalancing.LoadBalancingClient#requestLobbyStats requestLobbyStats}. <br/>
                Override to handle request results.
                @method Photon.LoadBalancing.LoadBalancingClient#onLobbyStats
                @param {number} errorCode Result error code. 0 if request is successful. For automated updates is always 0.
                @param {string} errorMsg Error message. For automated updates is always empty.
                @param {object[]} lobbies Array of lobbies statistics: [lobbyStats1, lobbyStats1, ... ].
                @property {object} lobbyStats Lobby statistics.
                @property {string} lobbyStats.lobbyName Lobby name.
                @property {number} lobbyStats.lobbyType Lobby type.
                @property {number} lobbyStats.peerCount The number of players in the lobby (on Master, not playing).
                @property {number} lobbyStats.gameCount The number of games in the lobby.
            */
            LoadBalancingClient.prototype.onLobbyStats = function (errorCode, errorMsg, lobbies) { };
            /**
                @summary Called when application statistics update received. <br/>
                Override to handle request results.
                @method Photon.LoadBalancing.LoadBalancingClient#onAppStats
                @param {number} errorCode Result error code. Currently is always 0.
                @param {string} errorMsg Error message. Currently is always empty.
                @param {object} stats Application statistics.
                @property {object} stats Application statistics.
                @property {number} stats.peerCount Count of players currently online on Game servers.
                @property {number} stats.masterPeerCount Count of players on Master server (looking for game).
                @property {number} stats.gameCount Count of games currently in use (includes invisible and full rooms, so it doesn't match lobby list).
            */
            LoadBalancingClient.prototype.onAppStats = function (errorCode, errorMsg, stats) { };
            /**
                @summary Called when {@link Photon.LoadBalancing.LoadBalancingClient#getRegions getRegions} request completed.<br/>
                Override to handle request results.
                @param {number} errorCode Result error code. 0 if request is successful.
                @param {string} errorMsg Error message.
                @param {object} regions Object with region codes as keys and Master servers addresses as values.
            */
            LoadBalancingClient.prototype.onGetRegionsResult = function (errorCode, errorMsg, regions) { };
            /**
                @summary Called when {@link Photon.LoadBalancing.LoadBalancingClient#webRpc webRpc} request completed.<br/>
                Override to handle request results.
                @method Photon.LoadBalancing.LoadBalancingClient#onWebRpcResult
                @param {number} errorCode Result error code. 0 if request is successful.
                @param {string} message Error message if errorCode ~ = 0 or optional message returned by remote procedure.
                @param {string} uriPath Request path.
                @param {number} resultCode Result code returned by remote procedure.
                @param {object} data Data returned by remote procedure.
            */
            LoadBalancingClient.prototype.onWebRpcResult = function (errorCode, message, uriPath, resultCode, data) { };
            /**
                @summary Called when the server reports non-critical error.<br/>
                Override to handle the event.
                @method Photon.LoadBalancing.LoadBalancingClient#onServerErrorInfo
                @description In most cases this could be either:<br>
                1. an error from webhooks plugin (if HasErrorInfo is enabled), <a href=https://doc.photonengine.com/en-us/realtime/current/gameplay/web-extensions/webhooks#options> read more</a><br>
                2. an error sent from a custom server plugin via PluginHost.BroadcastErrorInfoEvent, see <a href=https://doc.photonengine.com/en-us/server/current/plugins/manual#handling_http_response> example</a><br>
                3. an error sent from the server, for example, when the limit of cached events has been exceeded in the room (all clients will be disconnected and the room will be closed in this case), <a href=https://doc.photonengine.com/en-us/realtime/current/gameplay/cached-events#special_considerations> read more</a><br>
                @param {string} info Error info.
            */
            LoadBalancingClient.prototype.onServerErrorInfo = function (info) { };
            /**
                @summary Override with creation of custom room (extended from Room): { return new CustomRoom(...); }
                @method Photon.LoadBalancing.LoadBalancingClient#roomFactory
                @param {string} name Room name. Pass to super() in custom actor constructor.
            */
            LoadBalancingClient.prototype.roomFactory = function (name) { return new Room(name); };
            /**
                @summary Override with creation of custom actor (extended from Actor): { return new CustomActor(...); }
                @method Photon.LoadBalancing.LoadBalancingClient#actorFactory
                @param {string} name Actor name. Pass to super() in custom room constructor.
                @param {number} actorNr Actor ID. Pass to super() in custom room constructor.
                @param {boolean} isLocal Actor is local. Pass to super() in custom room constructor.
            */
            LoadBalancingClient.prototype.actorFactory = function (name, actorNr, isLocal) { return new Actor(name, actorNr, isLocal); };
            //------------------------
            /**
                @summary Returns local actor.
                Client always has local actor even if not joined.
                @method Photon.LoadBalancing.LoadBalancingClient#myActor
                @returns {Photon.LoadBalancing.Actor} Local actor.
            */
            LoadBalancingClient.prototype.myActor = function () { return this._myActor; };
            /**
                @summary Returns client's room.
                Client always has it's room even if not joined. It's used for room creation operation.
                @method Photon.LoadBalancing.LoadBalancingClient#myRoom
                @returns {Photon.LoadBalancing.Room} Current room.
            */
            LoadBalancingClient.prototype.myRoom = function () { return this.currentRoom; };
            /**
                @summary Returns actors in room client currently joined including local actor.
                @method Photon.LoadBalancing.LoadBalancingClient#myRoomActors
                @returns {object} actorNr -> {@link Photon.LoadBalancing.Actor} map of actors in room.
            */
            LoadBalancingClient.prototype.myRoomActors = function () { return this.actors; };
            /**
                @summary Returns numer of actors in room client currently joined including local actor.
                @method Photon.LoadBalancing.LoadBalancingClient#myRoomActorCount
                @returns {number} Number of actors.
            */
            LoadBalancingClient.prototype.myRoomActorCount = function () { return this.actorsArray.length; };
            LoadBalancingClient.prototype.myRoomActorsArray = function () { return this.actorsArray; }; // actors 'at index' access support (Scirra/Costruct 2)
            /**
                @summary Actor number of the player who's the master of this Room. Note: This changes when the current master leaves the room.
                @method Photon.LoadBalancing.LoadBalancingClient#myRoomMasterActorNr
                @type {number}
            */
            LoadBalancingClient.prototype.myRoomMasterActorNr = function () {
                if (this.myRoom().masterClientId) {
                    return this.myRoom().masterClientId;
                }
                else {
                    return this.lowestActorId;
                }
            };
            /**
                @summary Triggers game server Round Trip Time measurement.
                @method Photon.LoadBalancing.LoadBalancingClient#updateRtt
            */
            LoadBalancingClient.prototype.updateRtt = function () {
                if (this.gamePeer)
                    this.gamePeer.ping();
            };
            /**
                @summary Fetches server time from the game server and updates the base value used for extrapolation in {@link Photon.LoadBalancing.LoadBalancingClient#getServerTimeMs getServerTimeMs()}.
                @method Photon.LoadBalancing.LoadBalancingClient#syncServerTime
            */
            LoadBalancingClient.prototype.syncServerTime = function () {
                if (this.gamePeer)
                    this.gamePeer.ping(true);
            };
            /**
                @summary Returns the latest measurement of game server Round Trip Time.<br/>
                RTT is measured once on connection and then on each {@link Photon.LoadBalancing.LoadBalancingClient#updateRtt updateRtt()} call.
                @method Photon.LoadBalancing.LoadBalancingClient#getRtt
                @type {number}
            */
            LoadBalancingClient.prototype.getRtt = function () {
                return this.gamePeer ? this.gamePeer.getRtt() : 0;
            };
            /**
                @summary Returns game server time extrapolation in milliseconds based on the server time fetched on connection or on {@link Photon.LoadBalancing.LoadBalancingClient#syncServerTime syncServerTime()} call.<br/>
                The server time is a signed 32 bit integer making a full cycle in 49.71 days.
                @method Photon.LoadBalancing.LoadBalancingClient#getServerTimeMs
                @type {number}
            */
            LoadBalancingClient.prototype.getServerTimeMs = function () {
                return this.gamePeer ? this.gamePeer.getServerTimeMs() : 0;
            };
            LoadBalancingClient.prototype.roomFactoryInternal = function (name) {
                if (name === void 0) { name = ""; }
                var r = this.roomFactory(name);
                r._setLBC(this);
                return r;
            };
            LoadBalancingClient.prototype.actorFactoryInternal = function (name, actorNr, isLocal) {
                if (name === void 0) { name = ""; }
                if (actorNr === void 0) { actorNr = -1; }
                if (isLocal === void 0) { isLocal = false; }
                var a = this.actorFactory(name, actorNr, isLocal);
                a._setLBC(this);
                return a;
            };
            /**
                @summary Changes application id.
                @method Photon.LoadBalancing.LoadBalancingClient#setAppId
                @param {string} appId New address and port.
            */
            LoadBalancingClient.prototype.setAppId = function (appId) {
                this.appId = appId;
            };
            /**
                @summary Changes application version.
                @method Photon.LoadBalancing.LoadBalancingClient#setAppVersion
                @param {string} appVersion New address and port.
            */
            LoadBalancingClient.prototype.setAppVersion = function (appVersion) {
                this.appVersion = appVersion;
            };
            /**
                @summary Changes default NameServer address and port before connecting to NameServer.
                @method Photon.LoadBalancing.LoadBalancingClient#setNameServerAddress
                @param {string} address New address and port.
            */
            LoadBalancingClient.prototype.setNameServerAddress = function (address) {
                this.nameServerAddress = address;
            };
            /**
                @summary Returns current NameServer address.
                @method Photon.LoadBalancing.LoadBalancingClient#getNameServerAddress
                @returns {string} NameServer address address.
            */
            LoadBalancingClient.prototype.getNameServerAddress = function () {
                return this.nameServerAddress;
            };
            /**
                @summary Changes default Master server address and port before connecting to Master server.
                @method Photon.LoadBalancing.LoadBalancingClient#setMasterServerAddress
                @param {string} address New address and port.
            */
            LoadBalancingClient.prototype.setMasterServerAddress = function (address) {
                this.masterServerAddress = address;
            };
            /**
                @summary Returns current Master server address.
                @method Photon.LoadBalancing.LoadBalancingClient#getMasterServerAddress
                @returns {string} Master server address.
            */
            LoadBalancingClient.prototype.getMasterServerAddress = function () {
                return this.nameServerAddress;
            };
            /**
                @summary Sets user ID required for authentication and FindFriends service. The value will be used the next time you connect. Set this ID before you connect, not while being connected.
                @method Photon.LoadBalancing.LoadBalancingClient#setUserId
                @param {string} userId New user id.
            */
            LoadBalancingClient.prototype.setUserId = function (userId) {
                this.userId = userId;
            };
            /**
                @summary Returns previously set user id.
                @method Photon.LoadBalancing.LoadBalancingClient#getUserId
                @returns {string} User id.
            */
            LoadBalancingClient.prototype.getUserId = function () {
                return this.userId;
            };
            /**
                @summary Enables custom authentication and sets it's parameters.
                @method Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication
                @param {string} authParameters This string must contain any (http get) parameters expected by the used authentication service.
                @param {Photon.LoadBalancing.Constants.CustomAuthenticationType} [authType=Photon.LoadBalancing.Constants.CustomAuthenticationType.Custom] The type of custom authentication provider that should be used.
                @param {any} [authData] The data to be passed-on to the auth service via POST. String passed as is, objects as application/json
            */
            LoadBalancingClient.prototype.setCustomAuthentication = function (authParameters, authType, authData) {
                if (authType === void 0) { authType = Photon.LoadBalancing.Constants.CustomAuthenticationType.Custom; }
                this.userAuthType = authType;
                this.userAuthParameters = authParameters;
                this.userAuthData = authData;
            };
            // TODO: remove backward compatibility (deprecated)
            // when used internally, more fields may be passed in options
            /**
                @summary Starts connection to Master server.
                @method Photon.LoadBalancing.LoadBalancingClient#connect
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.keepMasterConnection=false] Don't disconnect from Master server after joining room.
                @property {string} [options.lobbyName] Name of the lobby connect to.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
                @property {boolean} [options.lobbyStats=false] If true, Master server will be sending lobbies statistics periodically.<br/> Override {@link Photon.LoadBalancing.LoadBalancingClient#onLobbyStats onLobbyStats} to handle request results.<br/>Alternatively, {@link Photon.LoadBalancing.LoadBalancingClient#requestLobbyStats requestLobbyStats} can be used.
                @returns {boolean} True if current client state allows connection.
            */
            LoadBalancingClient.prototype.connect = function (options) {
                // backward compatibility
                if (typeof (options) === "boolean") {
                    if (options) {
                        options = { keepMasterConnection: true };
                    }
                    else {
                        options = { keepMasterConnection: false };
                    }
                }
                //
                if (!options) {
                    options = {};
                }
                if (this.checkNextState(LoadBalancingClient.State.ConnectingToMasterserver, true)) {
                    this.changeState(LoadBalancingClient.State.ConnectingToMasterserver);
                    this.logger.info("Connecting to Master", this.masterServerAddress);
                    // make options copy to protect
                    this.connectOptions = {};
                    for (var k in options)
                        this.connectOptions[k] = options[k];
                    if (this.masterPeer)
                        this.masterPeer.Destroy();
                    this.masterPeer = new MasterPeer(this, this.connectionProtocol, this.masterServerAddress, "");
                    this.initMasterPeer(this.masterPeer);
                    this.masterPeer.connect(this.appId);
                    return true;
                }
                else {
                    return false;
                }
            };
            /**
                @summary Starts connection to NameServer.
                @method Photon.LoadBalancing.LoadBalancingClient#connectToNameServer
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {string} [options.region] If specified, Connect to region master after succesfull connection to name server
                @property {string} [options.lobbyName] Name of the lobby connect to.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
                @property {boolean} [options.lobbyStats=false] If true, Master server will be sending lobbies statistics periodically.<br/> Override {@link Photon.LoadBalancing.LoadBalancingClient#onLobbyStats onLobbyStats} to handle request results.<br/>Alternatively, {@link Photon.LoadBalancing.LoadBalancingClient#requestLobbyStats requestLobbyStats} can be used.
                @property {boolean} [options.keepMasterConnection=false] Don't disconnect from Master server after joining room.
                @returns {boolean} True if current client state allows connection.
            */
            LoadBalancingClient.prototype.connectToNameServer = function (options) {
                if (!options) {
                    options = {};
                }
                if (this.checkNextState(LoadBalancingClient.State.ConnectingToNameServer, true)) {
                    this.changeState(LoadBalancingClient.State.ConnectingToNameServer);
                    this.logger.info("Connecting to NameServer", this.nameServerAddress);
                    // make options copy to protect
                    this.connectOptions = {};
                    //var k: keyof typeof options;
                    for (var k in options)
                        this.connectOptions[k] = options[k];
                    if (this.nameServerPeer)
                        this.nameServerPeer.Destroy();
                    this.nameServerPeer = new NameServerPeer(this, this.connectionProtocol, this.nameServerAddress, "");
                    this.initNameServerPeer(this.nameServerPeer);
                    this.nameServerPeer.connect(this.appId);
                    return true;
                }
                else {
                    return false;
                }
            };
            /**
            @summary Can be used to reconnect to the master server after a disconnect.
            Common use case: Press the Lock Button on a iOS device and you get disconnected immediately
            @method Photon.LoadBalancing.LoadBalancingClient#reconnectToMaster
            @returns {boolean} True if current client state allows reconnection.
            */
            LoadBalancingClient.prototype.reconnectToMaster = function () {
                if (this.state() != LoadBalancingClient.State.Disconnected && this.state() != LoadBalancingClient.State.Error) {
                    this.logger.warn("reconnectToMaster() failed. Can only connect while in state 'Disconnected' or 'Error'. Current state: ", LoadBalancingClient.StateToName(this.state()));
                    return false;
                }
                if (!this.masterServerAddress) {
                    this.logger.warn("reconnectToMaster() failed. MasterServerAddress is null or empty.");
                    return false;
                }
                if (!this.connectOptions.userAuthSecret) {
                    this.logger.warn("reconnectToMaster() failed. It seems the client doesn't have any previous authentication token to re-connect.");
                    return false;
                }
                this.changeState(LoadBalancingClient.State.Disconnected);
                return this.connect(this.connectOptions);
            };
            /**
            @summary Can be used to return to a room quickly by directly reconnecting to a game server to rejoin a room.
            Rejoining room will not send any player properties. Instead client will receive up-to-date ones from server.
            If you want to set new player properties, do it once rejoined.
            @method Photon.LoadBalancing.LoadBalancingClient#reconnectToMaster
            @returns {boolean} True if current client state allows reconnection.
            */
            LoadBalancingClient.prototype.reconnectAndRejoin = function () {
                if (this.state() != LoadBalancingClient.State.Disconnected && this.state() != LoadBalancingClient.State.Error) {
                    this.logger.warn("reconnectToMaster() failed. Can only connect while in state 'Disconnected' or 'Error'. Current state: ", LoadBalancingClient.StateToName(this.state()));
                    return false;
                }
                if (!this.currentRoom.address) {
                    this.logger.warn("reconnectAndRejoin() failed. It seems the client wasn't connected to a game server before (no address).");
                    return false;
                }
                if (!this.connectOptions.userAuthSecret) {
                    this.logger.warn("reconnectToMaster() failed. It seems the client doesn't have any previous authentication token to re-connect.");
                    return false;
                }
                this.joinRoomOptions = { rejoin: true };
                this.changeState(LoadBalancingClient.State.Disconnected);
                return this.connectToGameServer(LoadBalancing.Constants.OperationCode.JoinGame);
            };
            LoadBalancingClient.prototype.fillCreateRoomOptions = function (op, options, gamePropKey) {
                options = options || {};
                var gp = Photon.TypeExt.TableTypedKeys();
                if (options.isVisible !== undefined)
                    Photon.TypeExt.PutTypedKey(gp, Photon.TypeExt.Byte(LoadBalancing.Constants.GameProperties.IsVisible), Photon.TypeExt.Bool(options.isVisible));
                if (options.isOpen !== undefined)
                    Photon.TypeExt.PutTypedKey(gp, Photon.TypeExt.Byte(LoadBalancing.Constants.GameProperties.IsOpen), Photon.TypeExt.Bool(options.isOpen));
                if (options.maxPlayers !== undefined)
                    Photon.TypeExt.PutTypedKey(gp, Photon.TypeExt.Byte(LoadBalancing.Constants.GameProperties.MaxPlayers), Photon.TypeExt.Byte(options.maxPlayers));
                if (options.propsListedInLobby !== undefined)
                    Photon.TypeExt.PutTypedKey(gp, Photon.TypeExt.Byte(LoadBalancing.Constants.GameProperties.PropsListedInLobby), Photon.TypeExt.String(options.propsListedInLobby));
                if (options.customGameProperties !== undefined) {
                    for (var p in options.customGameProperties) {
                        Photon.TypeExt.PutTypedKey(gp, Photon.TypeExt.String(p), options.customGameProperties[p]);
                    }
                }
                op.push(gamePropKey, gp);
                op.push(LoadBalancing.Constants.ParameterCode.CleanupCacheOnLeave, true); //TODO: make this optional?
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast, true); //TODO: make this optional?
                if (options.emptyRoomLiveTime !== undefined)
                    op.push(LoadBalancing.Constants.ParameterCode.RoomTTL, Photon.TypeExt.Int(options.emptyRoomLiveTime)); // deprecateRoomTTL
                if (options.roomTTL !== undefined)
                    op.push(LoadBalancing.Constants.ParameterCode.RoomTTL, Photon.TypeExt.Int(options.roomTTL));
                if (options.suspendedPlayerLiveTime !== undefined)
                    op.push(LoadBalancing.Constants.ParameterCode.PlayerTTL, Photon.TypeExt.Int(options.suspendedPlayerLiveTime)); // deprecated
                if (options.playerTTL !== undefined)
                    op.push(LoadBalancing.Constants.ParameterCode.PlayerTTL, Photon.TypeExt.Int(options.playerTTL));
                if (options.plugins !== undefined)
                    op.push(LoadBalancing.Constants.ParameterCode.Plugins, Photon.TypeExt.String(options.plugins));
                // shold be always set to true by client
                op.push(LoadBalancing.Constants.ParameterCode.CheckUserOnJoin, true);
                op.push(LoadBalancing.Constants.ParameterCode.PublishUserId, true);
                if (options.lobbyName) {
                    op.push(LoadBalancing.Constants.ParameterCode.LobbyName);
                    op.push(options.lobbyName);
                    if (options.lobbyType != undefined) {
                        op.push(LoadBalancing.Constants.ParameterCode.LobbyType);
                        op.push(Photon.TypeExt.Byte(options.lobbyType));
                    }
                }
                if (options.expectedUsers)
                    op.push(LoadBalancing.Constants.ParameterCode.Add, Photon.TypeExt.String(options.expectedUsers));
            };
            /**
                @summary Creates a new room on the server (or fails when the name is already taken). Takes parameters (except name) for new room from myRoom() object. Set them before call.
                @method Photon.LoadBalancing.LoadBalancingClient#createRoomFromMy
                @param {string} [roomName] New room name. Assigned automatically by server if empty or not specified.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {string} [options.lobbyName] Name of the lobby to create room in.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
            */
            LoadBalancingClient.prototype.createRoomFromMy = function (roomName, options) {
                this.joinRoomOptions = {};
                this.createRoomOptions = {};
                this.currentRoom.name = roomName ? roomName : "";
                options = this.copyCreateOptionsFromMyRoom(options);
                if (this.masterPeer) {
                    this.createRoomInternal(this.masterPeer, options);
                }
            };
            LoadBalancingClient.prototype.copyCreateOptionsFromMyRoom = function (options) {
                options = options || {};
                //retrieve options from my room
                options.isVisible = this.currentRoom.isVisible;
                options.isOpen = this.currentRoom.isOpen;
                options.maxPlayers = this.currentRoom.maxPlayers;
                options.customGameProperties = this.currentRoom.getCustomProperties();
                options.propsListedInLobby = this.currentRoom.getPropsListedInLobby();
                options.roomTTL = this.currentRoom.roomTTL;
                options.playerTTL = this.currentRoom.playerTTL;
                options.plugins = this.currentRoom.plugins;
                options.expectedUsers = this.currentRoom.expectedUsers;
                return options;
            };
            /**
                @summary Creates a new room on the server (or fails when the name is already taken).
                @method Photon.LoadBalancing.LoadBalancingClient#createRoom
                @param {string} [roomName] The name to create a room with. Must be unique and not in use or can't be created. If not specified or null, the server will assign a GUID as name.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.isVisible=true] Shows the room in the lobby's room list.
                @property {boolean} [options.isOpen=true] Keeps players from joining the room (or opens it to everyone).
                @property {number} [options.maxPlayers=0] Max players before room is considered full (but still listed).
                @property {object} [options.customGameProperties] Custom properties to apply to the room on creation (use string-typed keys but short ones).
                @property {string[]} [options.propsListedInLobby] Defines the custom room properties that get listed in the lobby.
                @property {number} [options.roomTTL=0] Room Time To Live (ms) in the server room cache after all clients have left the room.
                @property {number} [options.playerTTL=0] Player Time To Live (ms) in the room after player suspended.
                @property {string[]} [options.plugins] Expected server plugins.
                @property {string} [options.lobbyName=""] Name of the lobby to create room in.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
                @property {string[]} [options.expectedUsers] Expected users.
                @returns {boolean} True if current client state allows connection.
            */
            LoadBalancingClient.prototype.createRoom = function (roomName, options) {
                this.joinRoomOptions = {};
                this.createRoomOptions = {};
                this.currentRoom = this.roomFactoryInternal(roomName ? roomName : "");
                if (this.masterPeer) {
                    this.createRoomInternal(this.masterPeer, options);
                    return true;
                }
                else {
                    return false;
                }
            };
            /**
                @summary Joins a room by name and sets this player's properties.
                @method Photon.LoadBalancing.LoadBalancingClient#joinRoom
                @param {string} roomName The name of the room to join. Must be existing already, open and non-full or can't be joined.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.rejoin=false] Rejoin using current userId.
                @property {boolean} [options.createIfNotExists=false] Create room if not exists.
                @property {string[]} [options.expectedUsers] Expected users.
                @param {object} [createOptions] Room options for creation
                @property {object} createOptions Room options for creation
                @property {boolean} [createOptions.isVisible=true] Shows the room in the lobby's room list.
                @property {boolean} [createOptions.isOpen=true] Keeps players from joining the room (or opens it to everyone).
                @property {number} [createOptions.maxPlayers=0] Max players before room is considered full (but still listed).
                @property {object} [createOptions.customGameProperties] Custom properties to apply to the room on creation (use string-typed keys but short ones).
                @property {string[]} [createOptions.propsListedInLobby] Defines the custom room properties that get listed in the lobby.
                @property {number} [createOptions.roomTTL=0] Room Time To Live (ms) in the server room cache after all clients have left the room.
                @property {number} [createOptions.playerTTL=0] Player Time To Live (ms) in the room after player suspended.
                @property {string[]} [createOptions.plugins] Informs the server of the expected plugin setup.
                @property {string} [createOptions.lobbyName=""] Name of the lobby to create room in.
                @property {Photon.LoadBalancing.Constants.LobbyType} [createOptions.lobbyType=LobbyType.Default] Type of the lobby.
                @returns {boolean} If the operation will be sent (requires connection to Master Server).
            */
            LoadBalancingClient.prototype.joinRoom = function (roomName, options, createOptions) {
                if (!this.masterPeer)
                    return false;
                this.joinRoomOptions = options || {};
                this.createRoomOptions = createOptions || {};
                var op = [];
                if (options) {
                    if (options.createIfNotExists) {
                        op.push(LoadBalancing.Constants.ParameterCode.JoinMode, Photon.TypeExt.Byte(LoadBalancingClient.JoinMode.CreateIfNotExists));
                        this.fillCreateRoomOptions(op, createOptions, LoadBalancing.Constants.ParameterCode.GameProperties);
                    }
                    if (options.rejoin) {
                        op.push(LoadBalancing.Constants.ParameterCode.JoinMode, Photon.TypeExt.Byte(LoadBalancingClient.JoinMode.RejoinOnly));
                    }
                    if (options.expectedUsers) {
                        op.push(LoadBalancing.Constants.ParameterCode.Add, Photon.TypeExt.String(options.expectedUsers));
                    }
                }
                this.currentRoom = this.roomFactoryInternal(roomName);
                op.push(LoadBalancing.Constants.ParameterCode.RoomName, roomName);
                this.logger.info("Join Room", roomName, options, createOptions, "...");
                this.masterPeer.sendOperation(LoadBalancing.Constants.OperationCode.JoinGame, op);
                return true;
            };
            LoadBalancingClient.prototype.fillJoinRandomRoomOptions = function (op, options) {
                if (options) {
                    if (options.matchingType != undefined && options.matchingType != LoadBalancing.Constants.MatchmakingMode.FillRoom) {
                        op.push(LoadBalancing.Constants.ParameterCode.MatchMakingType);
                        op.push(Photon.TypeExt.Byte(options.matchingType));
                    }
                    var expectedRoomProperties = Photon.TypeExt.TableTypedKeys();
                    var propNonEmpty = false;
                    if (options.expectedCustomRoomProperties != undefined) {
                        for (var k in options.expectedCustomRoomProperties) {
                            Photon.TypeExt.PutTypedKey(expectedRoomProperties, Photon.TypeExt.String(k), options.expectedCustomRoomProperties[k]);
                            propNonEmpty = true;
                        }
                    }
                    if (options.expectedMaxPlayers != undefined && options.expectedMaxPlayers > 0) {
                        Photon.TypeExt.PutTypedKey(expectedRoomProperties, Photon.TypeExt.Byte(LoadBalancing.Constants.GameProperties.MaxPlayers), Photon.TypeExt.Byte(options.expectedMaxPlayers));
                        propNonEmpty = true;
                    }
                    if (propNonEmpty) {
                        op.push(LoadBalancing.Constants.ParameterCode.GameProperties);
                        op.push(expectedRoomProperties);
                    }
                    if (options.lobbyName) {
                        op.push(LoadBalancing.Constants.ParameterCode.LobbyName);
                        op.push(options.lobbyName);
                        if (options.lobbyType != undefined) {
                            op.push(LoadBalancing.Constants.ParameterCode.LobbyType);
                            op.push(Photon.TypeExt.Byte(options.lobbyType));
                        }
                    }
                    if (options.sqlLobbyFilter) {
                        op.push(LoadBalancing.Constants.ParameterCode.Data);
                        op.push(options.sqlLobbyFilter);
                    }
                    if (options.expectedUsers) {
                        op.push(LoadBalancing.Constants.ParameterCode.Add, Photon.TypeExt.String(options.expectedUsers));
                    }
                }
            };
            /**
                @summary Joins a random, available room.
                This operation fails if all rooms are closed or full.
                @method Photon.LoadBalancing.LoadBalancingClient#joinRandomRoom
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {object} [options.expectedCustomRoomProperties] If specified, a room will only be joined, if it matches these custom properties. Use null to accept rooms with any properties.
                @property {number} [options.expectedMaxPlayers] If specified, filters for a particular maxPlayer setting. Use 0 to accept any maxPlayer value.
                @property {Photon.LoadBalancing.Constants.MatchmakingMode} [options.matchmakingMode=MatchmakingMode.FillRoom] Selects one of the available matchmaking algorithms.
                @property {string} [options.lobbyName] Name of the lobby to search rooms in.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
                @property {string} [options.sqlLobbyFilter] Basically the "where" clause of a sql statement. Examples: 'C0 = 1 AND C2 > 50'. 'C5 = "Map2" AND C2 > 10 AND C2 < 20'
                @property {string[]} [options.expectedUsers] Expected users.
                @returns {boolean} If the operation will be sent (requires connection to Master Server).
            */
            LoadBalancingClient.prototype.joinRandomRoom = function (options) {
                if (!this.masterPeer)
                    return false;
                this.joinRoomOptions = {};
                this.createRoomOptions = {};
                var op = [];
                this.fillJoinRandomRoomOptions(op, options);
                this.logger.info("Join Random Room", options && options.lobbyName, options && options.lobbyType, "...");
                this.masterPeer.sendOperation(LoadBalancing.Constants.OperationCode.JoinRandomGame, op);
                return true;
            };
            /**
                @summary Attempts to join a room that matches the specified filter and creates a room if none found.
                This operation is a combination of filter-based random matchmaking with the option to create a new room,
                if no fitting room exists.
                The benefit of that is that the room creation is done by the same operation and the room can be found
                by the very next client, looking for similar rooms.
    
                There are separate parameters for joining and creating a room.
    
                This method can only be called while connected to a Master Server.
                This client's State is set to ClientState.Joining immediately.
    
                Either IMatchmakingCallbacks.OnJoinedRoom or IMatchmakingCallbacks.OnCreatedRoom get called.
    
                More about matchmaking:
                https://doc.photonengine.com/en-us/realtime/current/reference/matchmaking-and-lobby
    
                Check the return value to make sure the operation will be called on the server.
                Note: There will be no callbacks if this method returned false.
                @method Photon.LoadBalancing.LoadBalancingClient#joinRandomOrCreateRoom
                @param {object} [options] Additional join options
                @property {object} options Additional options
                @property {object} [options.expectedCustomRoomProperties] If specified, a room will only be joined, if it matches these custom properties. Use null to accept rooms with any properties.
                @property {number} [options.expectedMaxPlayers] If specified, filters for a particular maxPlayer setting. Use 0 to accept any maxPlayer value.
                @property {Photon.LoadBalancing.Constants.MatchmakingMode} [options.matchmakingMode=MatchmakingMode.FillRoom] Selects one of the available matchmaking algorithms.
                @property {string} [options.lobbyName] Name of the lobby to search rooms in.
                @property {Photon.LoadBalancing.Constants.LobbyType} [options.lobbyType=LobbyType.Default] Type of the lobby.
                @property {string} [options.sqlLobbyFilter] Basically the "where" clause of a sql statement. Examples: 'C0 = 1 AND C2 > 50'. 'C5 = "Map2" AND C2 > 10 AND C2 < 20'
                @property {string[]} [options.expectedUsers] Expected users.
                @param {string} [createRoomName] New room name. Assigned automatically by server if empty or not specified.
                @param {object} [createOptions] Additional create options
                @property {object} createOptions Additional create options
                @property {boolean} [createOptions.isVisible=true] Shows the room in the lobby's room list.
                @property {boolean} [createOptions.isOpen=true] Keeps players from joining the room (or opens it to everyone).
                @property {number} [createOptions.maxPlayers=0] Max players before room is considered full (but still listed).
                @property {object} [createOptions.customGameProperties] Custom properties to apply to the room on creation (use string-typed keys but short ones).
                @property {string[]} [createOptions.propsListedInLobby] Defines the custom room properties that get listed in the lobby.
                @property {number} [createOptions.roomTTL=0] Room Time To Live (ms) in the server room cache after all clients have left the room.
                @property {number} [createOptions.playerTTL=0] Player Time To Live (ms) in the room after player suspended.
                @property {string[]} [createOptions.plugins] Expected server plugins.
                @returns {boolean} If the operation will be sent (requires connection to Master Server).
            */
            LoadBalancingClient.prototype.joinRandomOrCreateRoom = function (options, createRoomName, createOptions) {
                if (!this.masterPeer)
                    return false;
                this.joinRoomOptions = { createIfNotExists: true };
                this.createRoomOptions = createOptions || {};
                var op = [];
                this.fillJoinRandomRoomOptions(op, options);
                op.push(LoadBalancing.Constants.ParameterCode.JoinMode, Photon.TypeExt.Byte(LoadBalancingClient.JoinMode.CreateIfNotExists));
                if (createRoomName)
                    op.push(LoadBalancing.Constants.ParameterCode.RoomName, createRoomName);
                this.fillCreateRoomOptions(op, createOptions, LoadBalancing.Constants.ParameterCode.Properties);
                this.logger.info("Join Random or Create Room", options && options.lobbyName, options && options.lobbyType, createRoomName, op, "...");
                this.masterPeer.sendOperation(LoadBalancing.Constants.OperationCode.JoinRandomGame, op);
                return true;
            };
            LoadBalancingClient.prototype._setPropertiesOfRoom = function (properties, webForward, expectedProperties) {
                if (!this.gamePeer)
                    return;
                var op = [];
                op.push(LoadBalancing.Constants.ParameterCode.Properties);
                op.push(properties);
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                op.push(true);
                if (webForward) {
                    op.push(LoadBalancing.Constants.ParameterCode.WebFlags);
                    op.push(Photon.TypeExt.Byte(WebFlags.HttpForward));
                }
                if (expectedProperties) {
                    op.push(LoadBalancing.Constants.ParameterCode.ExpectedValues);
                    op.push(expectedProperties);
                }
                this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.SetProperties, op);
            };
            LoadBalancingClient.prototype._setPropertiesOfActor = function (actorNr, properties, webForward, expectedProperties) {
                if (!this.gamePeer)
                    return;
                var op = [];
                op.push(LoadBalancing.Constants.ParameterCode.ActorNr);
                op.push(Photon.TypeExt.Int(actorNr));
                op.push(LoadBalancing.Constants.ParameterCode.Properties);
                op.push(properties);
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                op.push(true);
                if (webForward) {
                    op.push(LoadBalancing.Constants.ParameterCode.WebFlags);
                    op.push(Photon.TypeExt.Byte(WebFlags.HttpForward));
                }
                if (expectedProperties) {
                    op.push(LoadBalancing.Constants.ParameterCode.ExpectedValues);
                    op.push(expectedProperties);
                }
                this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.SetProperties, op);
            };
            /**
                @summary Disconnects from all servers.
                @method Photon.LoadBalancing.LoadBalancingClient#disconnect
            */
            LoadBalancingClient.prototype.disconnect = function () {
                if (this.nameServerPeer) {
                    this.nameServerPeer.disconnect();
                }
                this._cleanupNameServerPeerData();
                if (this.masterPeer) {
                    this.masterPeer.disconnect();
                }
                this._cleanupMasterPeerData();
                if (this.gamePeer) {
                    this.gamePeer.disconnect();
                }
                this._cleanupGamePeerData();
                this.changeState(LoadBalancingClient.State.Disconnected);
            };
            /**
                @summary Disconnects client from Game server keeping player in room (to rejoin later) and connects to Master server if not connected.
                @method Photon.LoadBalancing.LoadBalancingClient#suspendRoom
                @property {object} options Additional options
                @property {boolean} [options.sendAuthCookie] Securely transmit the encrypted object AuthCookie to the web service in PathLeave webhook when available
            */
            LoadBalancingClient.prototype.suspendRoom = function (options) {
                if (this.isJoinedToRoom()) {
                    if (this.gamePeer) {
                        var params = [];
                        if (options) {
                            if (options.sendAuthCookie) {
                                params.push(LoadBalancing.Constants.ParameterCode.WebFlags, Photon.TypeExt.Byte(WebFlags.SendAuthCookie));
                            }
                        }
                        params.push(LoadBalancing.Constants.ParameterCode.IsInactive, true);
                        this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.Leave, params);
                        this.gamePeerWaitingForDisconnect = true;
                    }
                    this._cleanupGamePeerData();
                    if (this.isConnectedToMaster()) {
                        this.changeState(LoadBalancingClient.State.JoinedLobby);
                    }
                    else {
                        this.changeState(LoadBalancingClient.State.Disconnected);
                        this.connect(this.connectOptions);
                    }
                }
            };
            /**
                @summary Leaves room and connects to Master server if not connected.
                @method Photon.LoadBalancing.LoadBalancingClient#leaveRoom
                @property {object} options Additional options
                @property {boolean} [options.sendAuthCookie] Securely transmit the encrypted object AuthCookie to the web service in PathLeave webhook when available
            */
            LoadBalancingClient.prototype.leaveRoom = function (options) {
                if (this.isJoinedToRoom()) {
                    if (this.gamePeer) {
                        var params = [];
                        if (options) {
                            if (options.sendAuthCookie) {
                                params.push(LoadBalancing.Constants.ParameterCode.WebFlags, Photon.TypeExt.Byte(WebFlags.SendAuthCookie));
                            }
                        }
                        this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.Leave, params);
                        this.gamePeerWaitingForDisconnect = true;
                    }
                    this._cleanupGamePeerData();
                    if (this.isConnectedToMaster()) {
                        this.changeState(LoadBalancingClient.State.JoinedLobby);
                    }
                    else {
                        this.changeState(LoadBalancingClient.State.Disconnected);
                        this.connect(this.connectOptions);
                    }
                }
            };
            /**
                @summary Raises game custom event
                @method Photon.LoadBalancing.LoadBalancingClient#raiseEvent
                @param {number} eventCode Identifies this type of event (and the content). Your game's event codes can start with 0.
                @param {object} [data] Custom data you want to send along (use null, if none).
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {number} [options.interestGroup] The ID of the interest group this event goes to (exclusively).
                @property {Photon.LoadBalancing.Constants.EventCaching} [options.cache=EventCaching.DoNotCache] Events can be cached (merged and removed) for players joining later on.
                @property {Photon.LoadBalancing.Constants.ReceiverGroup} [options.receivers=ReceiverGroup.Others] Defines to which group of players the event is passed on.
                @property {number[]} [options.targetActors] Defines the target players who should receive the event (use only for small target groups).
                @property {boolean} [options.webForward=false] Forward to web hook.
            */
            LoadBalancingClient.prototype.raiseEvent = function (eventCode, data, options) {
                if (this.gamePeer && this.isJoinedToRoom()) {
                    this.gamePeer.raiseEvent(eventCode, data, options);
                }
            };
            /**
                @summary Changes client's interest groups (for events in room).<br/>
                Note the difference between passing null and []: null won't add/remove any groups, [] will add/remove all (existing) groups.<br/>
                First, removing groups is executed. This way, you could leave all groups and join only the ones provided.
                @method Photon.LoadBalancing.LoadBalancingClient#changeGroups
                @param {number[]} groupsToRemove Groups to remove from interest. Null will not leave any. A [] will remove all.
                @param {number[]} groupsToAdd Groups to add to interest. Null will not add any. A [] will add all current.
            */
            LoadBalancingClient.prototype.changeGroups = function (groupsToRemove, groupsToAdd) {
                if (this.gamePeer && this.isJoinedToRoom()) {
                    this.logger.debug("Group change:", groupsToRemove, groupsToAdd);
                    this.gamePeer.changeGroups(groupsToRemove, groupsToAdd);
                }
            };
            /**
                @summary Requests Master server for actors online status and joined rooms.<br/>
                Override {@link Photon.LoadBalancing.LoadBalancingClient#onFindFriendsResult onFindFriendsResult} to handle request results.
                @method Photon.LoadBalancing.LoadBalancingClient#findFriends
                @param {string[]} friendsToFind Actors names.
            **/
            LoadBalancingClient.prototype.findFriends = function (friendsToFind) {
                if (this.masterPeer && this.isConnectedToMaster()) {
                    if (friendsToFind && typeof (friendsToFind) == "object") {
                        this.findFriendsRequestList = new Array();
                        for (var i = 0; i < friendsToFind.length; ++i) {
                            if (typeof (friendsToFind[i]) == "string") {
                                this.findFriendsRequestList[i] = friendsToFind[i];
                            }
                            else {
                                this.logger.error("FindFriends request error:", "Friend name is not a string", i);
                                this.onFindFriendsResult(-1, "Friend name is not a string" + " " + i, {});
                                return;
                            }
                        }
                        this.logger.debug("Find friends:", friendsToFind);
                        this.masterPeer.findFriends(this.findFriendsRequestList);
                    }
                    else {
                        this.logger.error("FindFriends request error:", "Parameter is not an array");
                        this.onFindFriendsResult(-1, "Parameter is not an array", {});
                    }
                }
                else {
                    this.logger.error("FindFriends request error:", "Not connected to Master");
                    this.onFindFriendsResult(LoadBalancingClient.PeerErrorCode.MasterError, "Not connected to Master", {});
                }
            };
            /**
                @summary Requests Master server for lobbies statistics.<br/>
                Override {@link Photon.LoadBalancing.LoadBalancingClient#onLobbyStats onLobbyStats} to handle request results.<br/>
                Alternatively, automated updates can be set up during {@link Photon.LoadBalancing.LoadBalancingClient#connect connect}.
                @method Photon.LoadBalancing.LoadBalancingClient#requestLobbyStats
                @param {any[]} lobbiesToRequest Array of lobbies id pairs [ [lobbyName1, lobbyType1], [lobbyName2, lobbyType2], ... ]. If not specified or null, statistics for all lobbies requested.
    
            **/
            LoadBalancingClient.prototype.requestLobbyStats = function (lobbiesToRequest) {
                if (this.masterPeer && this.isConnectedToMaster()) {
                    this.lobbyStatsRequestList = new Array();
                    if (lobbiesToRequest) {
                        if (typeof (lobbiesToRequest) == "object") {
                            for (var i = 0; i < lobbiesToRequest.length; ++i) {
                                var l = lobbiesToRequest[i];
                                if (typeof (l) == "object") {
                                    var n = l[0];
                                    if (n) {
                                        var t;
                                        if (l[1] === undefined) {
                                            t = LoadBalancing.Constants.LobbyType.Default;
                                        }
                                        else {
                                            if (typeof (l[1]) == "number") {
                                                t = l[1];
                                            }
                                            else {
                                                this.requestLobbyStatsErr("Lobby type is invalid", i);
                                                return;
                                            }
                                        }
                                        this.lobbyStatsRequestList[i] = [n.toString(), t];
                                    }
                                    else {
                                        this.requestLobbyStatsErr("Lobby name is empty", i);
                                        return;
                                    }
                                }
                                else {
                                    this.requestLobbyStatsErr("Lobby id is not an array", i);
                                    return;
                                }
                            }
                        }
                        else {
                            this.requestLobbyStatsErr("Parameter is not an array");
                            return;
                        }
                    }
                    this.masterPeer.requestLobbyStats(this.lobbyStatsRequestList);
                }
                else {
                    this.logger.error("LobbyState request error:", "Not connected to Master");
                    this.onLobbyStats(LoadBalancingClient.PeerErrorCode.MasterError, "Not connected to Master", []);
                }
            };
            LoadBalancingClient.prototype.requestLobbyStatsErr = function (m, other) {
                if (other === void 0) { other = ""; }
                this.logger.error("LobbyState request error:", m, other);
                this.onLobbyStats(-1, m + " " + other, []);
            };
            /**
                @summary Requests NameServer for regions list.<br/>
                Override {@link Photon.LoadBalancing.LoadBalancingClient#onGetRegionsResult onGetRegionsResult} to handle request results.<br/>
                @method Photon.LoadBalancing.LoadBalancingClient#getRegions
            **/
            LoadBalancingClient.prototype.getRegions = function () {
                if (this.nameServerPeer && this.isConnectedToNameServer()) {
                    this.logger.debug("GetRegions...");
                    this.nameServerPeer.getRegions(this.appId);
                }
                else {
                    this.logger.error("GetRegions request error:", "Not connected to NameServer");
                    this.onGetRegionsResult(LoadBalancingClient.PeerErrorCode.NameServerError, "Not connected to NameServer", {});
                }
            };
            /**
                @summary Sends web rpc request to Master server.<br/ >
                Override {@link Photon.LoadBalancing.LoadBalancingClient#onWebRpcResult onWebRpcResult} to handle request results.<br/>
                @method Photon.LoadBalancing.LoadBalancingClient#webRpc
                @param {string} uriPath Request path.
                @param {object} parameters Request parameters.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.sendAuthCookie] Defines if the authentication cookie gets sent to a WebHook (if setup)
            **/
            LoadBalancingClient.prototype.webRpc = function (uriPath, parameters, options) {
                if (this.masterPeer && this.isConnectedToMaster()) {
                    this.logger.debug("WebRpc...");
                    this.masterPeer.webRpc(uriPath, parameters, options);
                }
                else if (this.gamePeer && this.isJoinedToRoom()) {
                    this.logger.debug("WebRpc...");
                    this.gamePeer.webRpc(uriPath, parameters, options);
                }
                else {
                    this.logger.error("WebRpc request error:", "Connected to neither Master nor Game server");
                    this.onWebRpcResult(LoadBalancingClient.PeerErrorCode.MasterError, "Connected to neither Master nor Game server", uriPath, 0, {});
                }
            };
            /**
                @summary Connects to a specific region's Master server, using the NameServer to find the IP.
                @method Photon.LoadBalancing.LoadBalancingClient#connectToRegionMaster
                @param {string} region Region connect to Master server of.
                @returns {boolean} True if current client state allows connection.
            **/
            LoadBalancingClient.prototype.connectToRegionMaster = function (region) {
                if (this.nameServerPeer && this.isConnectedToNameServer()) {
                    this.logger.debug("Connecting to Region Master", region, "...");
                    this.nameServerPeer.opAuth(this.appId, this.appVersion, this.userAuthType, this.userAuthParameters, this.userAuthData, this.userId, region);
                    return true;
                }
                else if (this.connectToNameServer({ region: region })) {
                    return true;
                }
                else {
                    this.logger.error("Connecting to Region Master error:", "Not connected to NameServer");
                    return false;
                }
            };
            /**
                @summary Returns the current client state.
                @method Photon.LoadBalancing.LoadBalancingClient#state
                @returns {number} {Photon.LoadBalancingClient.State} member.
            */
            LoadBalancingClient.prototype.state = function () {
                return this.state_;
            };
            /**
                @summary Checks if client is connected to Master server (usually joined to lobby and receives room list updates).
                @method Photon.LoadBalancing.LoadBalancingClient#isConnectedToMaster
                @returns {boolean} True if client is connected to Master server.
            */
            LoadBalancingClient.prototype.isConnectedToMaster = function () {
                return this.masterPeer && this.masterPeer.isConnected();
            };
            /**
                @summary Checks if client is connected to NameServer server.
                @method Photon.LoadBalancing.LoadBalancingClient#isConnectedToNameServer
                @returns {boolean} True if client is connected to NameServer server.
            */
            LoadBalancingClient.prototype.isConnectedToNameServer = function () {
                return this.nameServerPeer && this.nameServerPeer.isConnected();
            };
            /**
                @summary Checks if client is in lobby and ready to join or create game.
                @method Photon.LoadBalancing.LoadBalancingClient#isInLobby
                @returns {boolean} True if client is in lobby.
            */
            LoadBalancingClient.prototype.isInLobby = function () {
                return this.state() == LoadBalancingClient.State.JoinedLobby;
            };
            /**
                @summary Checks if client is joined to game.
                @method Photon.LoadBalancing.LoadBalancingClient#isJoinedToRoom
                @returns {boolean} True if client is joined to game.
            */
            LoadBalancingClient.prototype.isJoinedToRoom = function () {
                return this.state() == LoadBalancingClient.State.Joined;
            };
            /**
                @deprecated Use {isJoinedToRoom}
            */
            LoadBalancingClient.prototype.isConnectedToGame = function () {
                return this.isJoinedToRoom();
            };
            /**
                @summary Current room list from Master server.
                @method Photon.LoadBalancing.LoadBalancingClient#availableRooms
                @returns {Photon.LoadBalancing.RoomInfo[]} Current room list
            */
            LoadBalancingClient.prototype.availableRooms = function () { return this.roomInfos; };
            /**
                @summary Sets client log level
                @method Photon.LoadBalancing.LoadBalancingClient#setLogLevel
                @param {Photon.LogLevel} level Log level.
            */
            LoadBalancingClient.prototype.setLogLevel = function (level) {
                this.logger.setLevel(level);
                if (this.nameServerPeer) {
                    this.nameServerPeer.setLogLevel(level);
                }
                if (this.masterPeer) {
                    this.masterPeer.setLogLevel(level);
                }
                if (this.gamePeer) {
                    this.gamePeer.setLogLevel(level);
                }
            };
            LoadBalancingClient.prototype.addRoom = function (r) { this.roomInfos.push(r); this.roomInfosDict[r.name] = r; };
            LoadBalancingClient.prototype.clearRooms = function () { this.roomInfos = new Array(); this.roomInfosDict = {}; };
            LoadBalancingClient.prototype.purgeRemovedRooms = function () {
                this.roomInfos = this.roomInfos.filter(function (x) { return !x.removed; });
                for (var n in this.roomInfosDict) {
                    if (this.roomInfosDict[n].removed) {
                        delete this.roomInfosDict[n];
                    }
                }
            };
            LoadBalancingClient.prototype.addActor = function (a) {
                this.actors[a.actorNr] = a;
                this.actorsArray.push(a);
                this.currentRoom.playerCount = this.actorsArray.length;
                if (this.lowestActorId == 0 || this.lowestActorId > a.actorNr)
                    this.lowestActorId = a.actorNr;
            };
            LoadBalancingClient.prototype.removeActor = function (actorNr) {
                delete this.actors[actorNr];
                this.actorsArray = this.actorsArray.filter(function (x) { return x.actorNr != actorNr; });
                this.currentRoom.playerCount = this.actorsArray.length;
                if (this.lowestActorId == actorNr) {
                    if (this.actorsArray.length > 0)
                        this.lowestActorId = this.actorsArray.reduce(function (prev, curr) { return prev.actorNr < curr.actorNr ? prev : curr; }).actorNr;
                    else
                        this.lowestActorId = 0;
                }
            };
            LoadBalancingClient.prototype.clearActors = function () {
                this.actors = {};
                this.actorsArray = [];
                this.currentRoom.playerCount = 0;
                this.lowestActorId = 0;
            };
            LoadBalancingClient.prototype.changeState = function (nextState) {
                this.logger.info("State:", LoadBalancingClient.StateToName(this.state()), "->", LoadBalancingClient.StateToName(nextState));
                this.state_ = nextState;
                this.onStateChange(nextState);
            };
            LoadBalancingClient.prototype.createRoomInternal = function (peer, options) {
                var op = [];
                if (this.currentRoom.name)
                    op.push(LoadBalancing.Constants.ParameterCode.RoomName, this.currentRoom.name);
                this.fillCreateRoomOptions(op, options, LoadBalancing.Constants.ParameterCode.GameProperties);
                if (peer === this.masterPeer) {
                    this.createRoomOptions = options;
                }
                if (peer === this.gamePeer) {
                    op.push(LoadBalancing.Constants.ParameterCode.PlayerProperties);
                    op.push(this._myActor._getAllProperties());
                }
                var log = peer == this.gamePeer ? this.gamePeer._logger : (this.masterPeer ? this.masterPeer._logger : null);
                if (log) {
                    log.info("Create Room", options && options.lobbyName, options && options.lobbyType, "...");
                }
                peer.sendOperation(LoadBalancing.Constants.OperationCode.CreateGame, op);
            };
            LoadBalancingClient.prototype.updateUserIdAndNickname = function (vals, logger) {
                var userId = vals[LoadBalancing.Constants.ParameterCode.UserId];
                if (userId != undefined) {
                    this.setUserId(userId);
                    logger.info("Setting userId sent by server:", userId);
                }
                var nickname = vals[LoadBalancing.Constants.ParameterCode.Nickname];
                if (nickname != undefined) {
                    this.myActor().setName(nickname);
                    logger.info("Setting nickname sent by server:", nickname);
                }
            };
            LoadBalancingClient.prototype.initNameServerPeer = function (np) {
                var _this = this;
                np.setLogLevel(this.logger.getLevel());
                // errors
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.error, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.NameServerError, "NameServer peer error");
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectFailed, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.NameServerConnectFailed, "NameServer peer connect failed. " + _this.nameServerAddress);
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.timeout, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.NameServerTimeout, "NameServer peer timeout");
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connecting, function () {
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connect, function () {
                    np._logger.info("Connected");
                    _this.changeState(LoadBalancingClient.State.ConnectedToNameServer);
                    // connectToRegionMaster inited connection
                    if (_this.connectOptions.region != undefined) {
                        np.opAuth(_this.appId, _this.appVersion, _this.userAuthType, _this.userAuthParameters, _this.userAuthData, _this.userId, _this.connectOptions.region);
                    }
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.disconnect, function () {
                    if (np == _this.nameServerPeer) { // skip delayed disconnect response
                        _this._cleanupNameServerPeerData();
                        np._logger.info("Disconnected");
                    }
                });
                np.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectClosed, function () {
                    np._logger.info("Server closed connection");
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.NameServerConnectClosed, "NameServer server closed connection");
                });
                // events
                // responses - check operation result. data.errCode
                np.addResponseListener(LoadBalancing.Constants.OperationCode.GetRegions, function (data) {
                    np._logger.debug("resp GetRegions", data);
                    var regions = {};
                    if (data.errCode == 0) {
                        var r = data.vals[LoadBalancing.Constants.ParameterCode.Region];
                        var a = data.vals[LoadBalancing.Constants.ParameterCode.Address];
                        for (var i in r) {
                            regions[r[i]] = a[i];
                        }
                    }
                    else {
                        np._logger.error("GetRegions request error.", data.errCode);
                    }
                    _this.onGetRegionsResult(data.errCode, data.errMsg, regions);
                });
                np.addResponseListener(LoadBalancing.Constants.OperationCode.Authenticate, function (data) {
                    np._logger.debug("resp Authenticate", data);
                    if (data.errCode == 0) {
                        np._logger.info("Authenticated");
                        np.disconnect();
                        _this.updateUserIdAndNickname(data.vals, np._logger);
                        _this.masterServerAddress = data.vals[LoadBalancing.Constants.ParameterCode.Address];
                        np._logger.info("Connecting to Master server", _this.masterServerAddress, "...");
                        _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        _this.connect(_this.connectOptions);
                    }
                    else {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.NameServerAuthenticationFailed, "NameServer authentication failed: " + data.errCode + " " + data.errMsg);
                    }
                });
            };
            // protected
            LoadBalancingClient.prototype.initMasterPeer = function (mp) {
                var _this = this;
                mp.setLogLevel(this.logger.getLevel());
                // errors
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.error, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.MasterError, "Master peer error");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectFailed, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.MasterConnectFailed, "Master peer connect failed: " + _this.masterServerAddress);
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.timeout, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.MasterTimeout, "Master peer error timeout");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connecting, function () {
                });
                // status
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connect, function () {
                    //TODO: encryption phase
                    mp._logger.info("Connected");
                    var op = [];
                    // if NameSever gave us secret
                    if (_this.connectOptions.userAuthSecret) {
                        op.push(LoadBalancing.Constants.ParameterCode.Secret, _this.connectOptions.userAuthSecret);
                        mp.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op);
                        mp._logger.info("Authenticate with secret...");
                    }
                    else {
                        op.push(LoadBalancing.Constants.ParameterCode.ApplicationId);
                        op.push(_this.appId);
                        op.push(LoadBalancing.Constants.ParameterCode.AppVersion);
                        op.push(_this.appVersion);
                        if (_this.userAuthType != LoadBalancing.Constants.CustomAuthenticationType.None) {
                            op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationType, Photon.TypeExt.Byte(_this.userAuthType));
                            op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationParams, _this.userAuthParameters);
                            if (_this.userAuthData) {
                                op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationData, _this.userAuthData);
                            }
                        }
                        if (_this.userId) {
                            op.push(LoadBalancing.Constants.ParameterCode.UserId, _this.userId);
                        }
                        if (_this.connectOptions.lobbyStats) {
                            op.push(LoadBalancing.Constants.ParameterCode.LobbyStats, true);
                        }
                        mp.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op);
                        mp._logger.info("Authenticate...");
                    }
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.disconnect, function () {
                    if (mp == _this.masterPeer) { // skip delayed disconnect response
                        _this._cleanupMasterPeerData();
                        mp._logger.info("Disconnected");
                    }
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectClosed, function () {
                    mp._logger.info("Server closed connection");
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.MasterConnectClosed, "Master server closed connection");
                });
                //events
                mp.addEventListener(LoadBalancing.Constants.EventCode.GameList, function (data) {
                    var gameList = data.vals[LoadBalancing.Constants.ParameterCode.GameList];
                    _this.clearRooms();
                    for (var g in gameList) {
                        var r = new RoomInfo(g);
                        r._updateFromProps(gameList[g]);
                        _this.addRoom(r);
                    }
                    _this.onRoomList(_this.roomInfos);
                    mp._logger.debug("ev GameList", _this.roomInfos, gameList);
                });
                mp.addEventListener(LoadBalancing.Constants.EventCode.GameListUpdate, function (data) {
                    var gameList = data.vals[LoadBalancing.Constants.ParameterCode.GameList];
                    var roomsUpdated = new Array();
                    var roomsAdded = new Array();
                    var roomsRemoved = new Array();
                    for (var g in gameList) {
                        var exist = _this.roomInfos.filter(function (x) { return x.name == g; });
                        if (exist.length > 0) {
                            var r = exist[0];
                            r._updateFromProps(gameList[g]);
                            if (r.removed) {
                                roomsRemoved.push(r);
                            }
                            else {
                                roomsUpdated.push(r);
                            }
                        }
                        else {
                            var ri = new RoomInfo(g);
                            ri._updateFromProps(gameList[g]);
                            _this.addRoom(ri);
                            roomsAdded.push(ri);
                        }
                    }
                    _this.purgeRemovedRooms();
                    _this.onRoomListUpdate(_this.roomInfos, roomsUpdated, roomsAdded, roomsRemoved);
                    mp._logger.debug("ev GameListUpdate:", _this.roomInfos, "u:", roomsUpdated, "a:", roomsAdded, "r:", roomsRemoved, gameList);
                });
                // responses - check operation result: data.errCode
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.Authenticate, function (data) {
                    mp._logger.debug("resp Authenticate", data);
                    if (!data.errCode) {
                        mp._logger.info("Authenticated");
                        _this.updateUserIdAndNickname(data.vals, mp._logger);
                        if (data.vals[LoadBalancing.Constants.ParameterCode.Secret] != undefined) {
                            _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        }
                        _this.changeState(LoadBalancingClient.State.ConnectedToMaster);
                        var op = [];
                        if (_this.connectOptions.lobbyName) {
                            op.push(LoadBalancing.Constants.ParameterCode.LobbyName);
                            op.push(_this.connectOptions.lobbyName);
                            if (_this.connectOptions.lobbyType != undefined) {
                                op.push(LoadBalancing.Constants.ParameterCode.LobbyType);
                                op.push(Photon.TypeExt.Byte(_this.connectOptions.lobbyType));
                            }
                        }
                        if (_this.autoJoinLobby) {
                            mp.sendOperation(LoadBalancing.Constants.OperationCode.JoinLobby, op);
                            mp._logger.info("Join Lobby", _this.connectOptions.lobbyName, _this.connectOptions.lobbyType, "...");
                        }
                    }
                    else {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.MasterAuthenticationFailed, "Master authentication failed: " + data.errCode + " " + data.errMsg);
                    }
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinLobby, function (data) {
                    mp._logger.debug("resp JoinLobby", data);
                    if (!data.errCode) {
                        mp._logger.info("Joined to Lobby");
                        if (data.vals[LoadBalancing.Constants.ParameterCode.Secret] != undefined) {
                            _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        }
                        _this.changeState(LoadBalancingClient.State.JoinedLobby);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinLobby, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.CreateGame, function (data) {
                    mp._logger.debug("resp CreateGame", data);
                    if (!data.errCode) {
                        if (data.vals[LoadBalancing.Constants.ParameterCode.Secret] != undefined) {
                            _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        }
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Created/Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(LoadBalancing.Constants.OperationCode.CreateGame);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.CreateGame, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinGame, function (data) {
                    mp._logger.debug("resp JoinGame", data);
                    if (!data.errCode) {
                        if (data.vals[LoadBalancing.Constants.ParameterCode.Secret] != undefined) {
                            _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        }
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(LoadBalancing.Constants.OperationCode.JoinGame);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinGame, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinRandomGame, function (data) {
                    mp._logger.debug("resp JoinRandomGame", data);
                    if (!data.errCode) {
                        if (data.vals[LoadBalancing.Constants.ParameterCode.Secret] != undefined) {
                            _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        }
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(LoadBalancing.Constants.OperationCode.JoinRandomGame);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinRandomGame, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.FindFriends, function (data) {
                    mp._logger.debug("resp FindFriends", data);
                    var res = {};
                    if (!data.errCode) {
                        var onlines = data.vals[LoadBalancing.Constants.ParameterCode.FindFriendsResponseOnlineList] || {};
                        var roomIds = data.vals[LoadBalancing.Constants.ParameterCode.FindFriendsResponseRoomIdList] || {};
                        for (var i = 0; i < _this.findFriendsRequestList.length; ++i) {
                            var name = _this.findFriendsRequestList[i];
                            if (name) {
                                res[name] = { online: onlines[i], roomId: roomIds[i] };
                            }
                        }
                    }
                    else {
                        mp._logger.error("FindFriends request error:", data.errCode);
                    }
                    _this.onFindFriendsResult(data.errCode, data.errMsg, res);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.LobbyStats, function (data) {
                    mp._logger.debug("resp LobbyStats", data);
                    var res = new Array();
                    if (!data.errCode) {
                        var names = data.vals[LoadBalancing.Constants.ParameterCode.LobbyName]; // not inited intentionally
                        var types = data.vals[LoadBalancing.Constants.ParameterCode.LobbyType] || {};
                        var peers = data.vals[LoadBalancing.Constants.ParameterCode.PeerCount] || {};
                        var games = data.vals[LoadBalancing.Constants.ParameterCode.GameCount] || {};
                        if (names) {
                            for (var i = 0; i < names.length; ++i) {
                                res[i] = { lobbyName: names[i], lobbyType: types[i], peerCount: peers[i], gameCount: games[i] };
                            }
                        }
                        else {
                            for (var i = 0; i < _this.lobbyStatsRequestList.length; ++i) {
                                var l = _this.lobbyStatsRequestList[i];
                                res[i] = { lobbyName: l[0], lobbyType: l[1], peerCount: peers[i], gameCount: games[i] };
                            }
                        }
                    }
                    else {
                        mp._logger.error("LobbyStats request error:", data.errCode);
                    }
                    _this.onLobbyStats(data.errCode, data.errMsg, res);
                });
                mp.addEventListener(LoadBalancing.Constants.EventCode.LobbyStats, function (data) {
                    mp._logger.debug("ev LobbyStats", data);
                    var res = new Array();
                    var names = data.vals[LoadBalancing.Constants.ParameterCode.LobbyName]; // not inited intentionally
                    var types = data.vals[LoadBalancing.Constants.ParameterCode.LobbyType] || {};
                    var peers = data.vals[LoadBalancing.Constants.ParameterCode.PeerCount] || {};
                    var games = data.vals[LoadBalancing.Constants.ParameterCode.GameCount] || {};
                    if (names) {
                        for (var i = 0; i < names.length; ++i) {
                            res[i] = { lobbyName: names[i], lobbyType: types[i], peerCount: peers[i], gameCount: games[i] };
                        }
                    }
                    _this.onLobbyStats(0, "", res);
                });
                mp.addEventListener(LoadBalancing.Constants.EventCode.AppStats, function (data) {
                    mp._logger.debug("ev AppStats", data);
                    var res = {
                        peerCount: data.vals[LoadBalancing.Constants.ParameterCode.PeerCount],
                        masterPeerCount: data.vals[LoadBalancing.Constants.ParameterCode.MasterPeerCount],
                        gameCount: data.vals[LoadBalancing.Constants.ParameterCode.GameCount]
                    };
                    _this.onAppStats(0, "", res);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.Rpc, mp.webRpcHandler(this));
            };
            LoadBalancingClient.prototype.connectToGameServer = function (masterOpCode) {
                if (!this.connectOptions.keepMasterConnection && this.masterPeer) {
                    this.masterPeer.disconnect();
                }
                if (this.checkNextState(LoadBalancingClient.State.ConnectingToGameserver, true)) {
                    this.logger.info("Connecting to Game", this.currentRoom.address);
                    if (this.gamePeer)
                        this.gamePeer.Destroy();
                    this.gamePeer = new GamePeer(this, this.connectionProtocol, this.currentRoom.address, "");
                    this.gamePeerWaitingForDisconnect = false;
                    this.initGamePeer(this.gamePeer, masterOpCode);
                    this.gamePeer.connect(this.appId);
                    this.changeState(LoadBalancingClient.State.ConnectingToGameserver);
                    return true;
                }
                else {
                    return false;
                }
            };
            LoadBalancingClient.prototype.initGamePeer = function (gp, masterOpCode) {
                var _this = this;
                gp.setLogLevel(this.logger.getLevel());
                // errors
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.error, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.GameError, "Game peer error");
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectFailed, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.GameConnectFailed, "Game peer connect failed: " + _this.currentRoom.address);
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.timeout, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.GameTimeout, "Game peer timeout");
                });
                // status
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connect, function () {
                    gp._logger.info("Connected");
                    //TODO: encryption phase
                    var op = [];
                    op.push(LoadBalancing.Constants.ParameterCode.ApplicationId);
                    op.push(_this.appId);
                    op.push(LoadBalancing.Constants.ParameterCode.AppVersion);
                    op.push(_this.appVersion);
                    if (_this.connectOptions.userAuthSecret != undefined) { // may be w / o userAuthType
                        op.push(LoadBalancing.Constants.ParameterCode.Secret);
                        op.push(_this.connectOptions.userAuthSecret);
                    }
                    if (_this.userAuthType != LoadBalancing.Constants.CustomAuthenticationType.None) {
                        op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationType);
                        op.push(Photon.TypeExt.Byte(_this.userAuthType));
                    }
                    if (_this.userId) {
                        op.push(LoadBalancing.Constants.ParameterCode.UserId, _this.userId);
                    }
                    gp.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op);
                    gp._logger.info("Authenticate...");
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.disconnect, function () {
                    if (gp == _this.gamePeer) { // skip delayed disconnect response
                        _this._cleanupGamePeerData();
                        gp._logger.info("Disconnected");
                    }
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectClosed, function () {
                    gp._logger.info("Server closed connection");
                    if (!_this.gamePeerWaitingForDisconnect) {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.GameConnectClosed, "Game server closed connection");
                    }
                });
                // responses
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.Authenticate, function (data) {
                    gp._logger.debug("resp Authenticate", data);
                    if (!data.errCode) {
                        gp._logger.info("Authenticated");
                        gp._logger.info("Connected");
                        if (masterOpCode == LoadBalancing.Constants.OperationCode.CreateGame) {
                            _this.createRoomInternal(gp, _this.createRoomOptions);
                        }
                        else {
                            var op = [];
                            op.push(LoadBalancing.Constants.ParameterCode.RoomName);
                            op.push(_this.currentRoom.name);
                            op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                            op.push(true);
                            op.push(LoadBalancing.Constants.ParameterCode.PlayerProperties);
                            op.push(_this._myActor._getAllProperties());
                            if (_this.joinRoomOptions.createIfNotExists) {
                                op.push(LoadBalancing.Constants.ParameterCode.JoinMode, Photon.TypeExt.Byte(LoadBalancingClient.JoinMode.CreateIfNotExists));
                                _this.fillCreateRoomOptions(op, _this.createRoomOptions, LoadBalancing.Constants.ParameterCode.GameProperties);
                            }
                            if (_this.joinRoomOptions.rejoin) {
                                op.push(LoadBalancing.Constants.ParameterCode.JoinMode, Photon.TypeExt.Byte(LoadBalancingClient.JoinMode.RejoinOnly));
                            }
                            if (_this.joinRoomOptions.expectedUsers) {
                                op.push(LoadBalancing.Constants.ParameterCode.Add, Photon.TypeExt.String(_this.joinRoomOptions.expectedUsers));
                            }
                            gp.sendOperation(LoadBalancing.Constants.OperationCode.JoinGame, op);
                        }
                        _this.changeState(LoadBalancingClient.State.ConnectedToGameserver);
                    }
                    else {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this._onErrorInternal(LoadBalancingClient.PeerErrorCode.GameAuthenticationFailed, "Game authentication failed: " + data.errCode + " " + data.errMsg);
                    }
                });
                var actorInfo = function (a) {
                    return {
                        actorNr: a.actorNr,
                        userId: a.userId,
                        name: a.name,
                        customProperties: a.getCustomProperties(),
                    };
                };
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.CreateGame, function (data) {
                    gp._logger.debug("resp CreateGame", data);
                    if (!data.errCode) {
                        _this._myActor._updateMyActorFromResponse(data.vals);
                        gp._logger.info("myActor: ", actorInfo(_this._myActor));
                        _this.currentRoom._updateFromProps(data.vals[LoadBalancing.Constants.ParameterCode.GameProperties]);
                        _this.clearActors();
                        _this.addActor(_this._myActor);
                        _this.changeState(LoadBalancingClient.State.Joined);
                        _this.onJoinRoom(true);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.CreateGame, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinGame, function (data) {
                    gp._logger.debug("resp JoinGame", data);
                    if (!data.errCode) {
                        _this._myActor._updateMyActorFromResponse(data.vals);
                        gp._logger.info("myActor: ", actorInfo(_this._myActor));
                        _this.clearActors();
                        _this.addActor(_this._myActor);
                        var actorList = data.vals[LoadBalancing.Constants.ParameterCode.ActorList];
                        var actorProps = data.vals[LoadBalancing.Constants.ParameterCode.PlayerProperties];
                        if (actorList !== undefined) {
                            for (var i = 0; i < actorList.length; i++) {
                                var actorNr = actorList[i];
                                var props;
                                if (actorProps !== undefined)
                                    props = actorProps[actorNr];
                                var name = "";
                                if (props !== undefined) {
                                    name = props[LoadBalancing.Constants.ActorProperties.PlayerName];
                                }
                                var a;
                                if (actorNr == _this._myActor.actorNr)
                                    a = _this._myActor;
                                else {
                                    a = _this.actorFactoryInternal(name, actorNr);
                                    _this.addActor(a);
                                }
                                if (props !== undefined) {
                                    var userId = props[LoadBalancing.Constants.ActorProperties.UserId];
                                    if (userId != undefined)
                                        a.userId = userId;
                                }
                                if (props !== undefined) {
                                    a._updateFromProps(props);
                                }
                            }
                        }
                        _this.currentRoom._updateFromProps(data.vals[LoadBalancing.Constants.ParameterCode.GameProperties]);
                        _this.changeState(LoadBalancingClient.State.Joined);
                        _this.onJoinRoom(false);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinGame, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.SetProperties, function (data) {
                    gp._logger.debug("resp SetProperties", data);
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.SetProperties, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.Leave, function (data) {
                    gp._logger.debug("resp Leave", data);
                    gp.disconnect();
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.Leave, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.Rpc, gp.webRpcHandler(this));
                // events
                gp.addEventListener(LoadBalancing.Constants.EventCode.Join, function (data) {
                    gp._logger.debug("ev Join", data);
                    if (Actor._getActorNrFromResponse(data.vals) === _this._myActor.actorNr) {
                        //this._myActor._updateMyActorFromResponse(data.vals);
                        _this._myActor._updateFromResponse(data.vals);
                        //                    this.addActor(this._myActor);
                        _this.onActorJoin(_this._myActor); // let client read updated properties
                    }
                    else {
                        var actor = _this.actorFactoryInternal();
                        actor._updateFromResponse(data.vals);
                        _this.addActor(actor);
                        _this.onActorJoin(actor);
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.Leave, function (data) {
                    gp._logger.debug("ev Leave", data);
                    _this.myRoom()._updateFromEvent(data.vals); // updating masterClientId
                    var actorNr = Actor._getActorNrFromResponse(data.vals);
                    if (actorNr && _this.actors[actorNr]) {
                        var a = _this.actors[actorNr];
                        if (data.vals[LoadBalancing.Constants.ParameterCode.IsInactive]) {
                            a._setSuspended(true);
                            _this.onActorSuspend(a);
                        }
                        else {
                            _this.removeActor(actorNr);
                            _this.onActorLeave(a, false);
                        }
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.Disconnect, function (data) {
                    gp._logger.debug("ev Disconnect", data);
                    var actorNr = Actor._getActorNrFromResponse(data.vals);
                    if (actorNr && _this.actors[actorNr]) {
                        var a = _this.actors[actorNr];
                        a._setSuspended(true);
                        _this.onActorSuspend(a);
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.PropertiesChanged, function (data) {
                    gp._logger.debug("ev PropertiesChanged", data);
                    var targetActorNr = data.vals[LoadBalancing.Constants.ParameterCode.TargetActorNr];
                    if (targetActorNr !== undefined && targetActorNr > 0) {
                        if (_this.actors[targetActorNr] !== undefined) {
                            var actor = _this.actors[targetActorNr];
                            actor._updateFromProps(data.vals[LoadBalancing.Constants.ParameterCode.Properties]);
                            _this.onActorPropertiesChange(actor);
                        }
                    }
                    else {
                        _this.currentRoom._updateFromProps(data.vals[LoadBalancing.Constants.ParameterCode.Properties]);
                        _this.onMyRoomPropertiesChange();
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.AuthEvent, function (data) {
                    gp._logger.debug("ev AuthEvent", data);
                    _this.connectOptions.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.ErrorInfo, function (data) {
                    gp._logger.debug("ev ErrorInfo", data);
                    _this.onServerErrorInfo(data.vals[LoadBalancing.Constants.ParameterCode.Info]);
                });
            };
            LoadBalancingClient.prototype._cleanupNameServerPeerData = function () {
            };
            LoadBalancingClient.prototype._cleanupMasterPeerData = function () {
            };
            LoadBalancingClient.prototype._cleanupGamePeerData = function () {
                for (var i in this.actors) {
                    this.onActorLeave(this.actors[i], true);
                }
                this.clearActors();
                this.addActor(this._myActor);
            };
            LoadBalancingClient.prototype._onOperationResponseInternal2 = function (code, data) {
                if (data.errCode) {
                    this.logger.warn("Operation", code, "error:", data.errMsg, "(" + data.errCode + ")");
                }
                this.onOperationResponse(data.errCode, data.errMsg, code, data.vals);
            };
            LoadBalancingClient.prototype._onErrorInternal = function (errorCode, errorMsg) {
                this.logger.error("Error:", errorCode, errorMsg);
                this.onError(errorCode, errorMsg);
            };
            //TODO: ugly way to init const table
            LoadBalancingClient.prototype.initValidNextState = function () {
                this.validNextState[LoadBalancingClient.State.Error] = [LoadBalancingClient.State.ConnectingToMasterserver, LoadBalancingClient.State.ConnectingToNameServer];
                this.validNextState[LoadBalancingClient.State.Uninitialized] = [LoadBalancingClient.State.ConnectingToMasterserver, LoadBalancingClient.State.ConnectingToNameServer];
                this.validNextState[LoadBalancingClient.State.ConnectedToNameServer] = [LoadBalancingClient.State.ConnectingToMasterserver];
                this.validNextState[LoadBalancingClient.State.Disconnected] = [LoadBalancingClient.State.ConnectingToGameserver, LoadBalancingClient.State.ConnectingToMasterserver, LoadBalancingClient.State.ConnectingToNameServer];
                this.validNextState[LoadBalancingClient.State.ConnectedToMaster] = [LoadBalancingClient.State.JoinedLobby, LoadBalancingClient.State.ConnectingToGameserver];
                this.validNextState[LoadBalancingClient.State.JoinedLobby] = [LoadBalancingClient.State.ConnectingToGameserver];
                this.validNextState[LoadBalancingClient.State.ConnectingToGameserver] = [LoadBalancingClient.State.ConnectedToGameserver];
                this.validNextState[LoadBalancingClient.State.ConnectedToGameserver] = [LoadBalancingClient.State.Joined];
            };
            LoadBalancingClient.prototype.checkNextState = function (nextState, dontThrow) {
                if (dontThrow === void 0) { dontThrow = false; }
                var valid = this.validNextState[this.state()];
                var res = valid && valid.indexOf(nextState) >= 0;
                if (!res) {
                    if (dontThrow) {
                        this.logger.error("LoadBalancingPeer checkNextState fail: " + LoadBalancingClient.StateToName(this.state()) + " -> " + LoadBalancingClient.StateToName(nextState));
                    }
                    else {
                        this.logger.exception(501, "LoadBalancingPeer checkNextState fail: " + LoadBalancingClient.StateToName(this.state()) + " -> " + LoadBalancingClient.StateToName(nextState));
                    }
                }
                return res;
            };
            /**
                @summary Converts {@link Photon.LoadBalancing.LoadBalancingClient.State State} element to string name.
                @method Photon.LoadBalancing.LoadBalancingClient.StateToName
                @param {Photon.LoadBalancing.LoadBalancingClient.State} state Client state enum element.
                @returns {string} Specified element name or undefined if not found.
            */
            LoadBalancingClient.StateToName = function (value) {
                return LoadBalancingClient.stateName[value];
            };
            LoadBalancingClient.JoinMode = {
                Default: 0,
                CreateIfNotExists: 1,
                //            JoinOrejoin: 2,
                RejoinOnly: 3,
            };
            // tsc looses all comments after first static member
            // jsdoc reads comments from any place within class (and may be from any place in file)
            LoadBalancingClient.PeerErrorCode = {
                /**
                    @summary Enum for client peers error codes.
                    @member Photon.LoadBalancing.LoadBalancingClient.PeerErrorCode
                    @readonly
                    @property {number} Ok No Error.
                    @property {number} MasterError General Master server peer error.
                    @property {number} MasterConnectFailed Master server connection error.
                    @property {number} MasterConnectClosed Disconnected from Master server.
                    @property {number} MasterTimeout Disconnected from Master server for timeout.
                    @property {number} MasterEncryptionEstablishError Master server encryption establishing failed.
                    @property {number} MasterAuthenticationFailed Master server authentication failed.
                    @property {number} GameError General Game server peer error.
                    @property {number} GameConnectFailed Game server connection error.
                    @property {number} GameConnectClosed Disconnected from Game server.
                    @property {number} GameTimeout Disconnected from Game server for timeout.
                    @property {number} GameEncryptionEstablishError Game server encryption establishing failed.
                    @property {number} GameAuthenticationFailed Game server authentication failed.
                    @property {number} NameServerError General NameServer peer error.
                    @property {number} NameServerConnectFailed NameServer connection error.
                    @property {number} NameServerConnectClosed Disconnected from NameServer.
                    @property {number} NameServerTimeout Disconnected from NameServer for timeout.
                    @property {number} NameServerEncryptionEstablishError NameServer encryption establishing failed.
                    @property {number} NameServerAuthenticationFailed NameServer authentication failed.
                 */
                Ok: 0,
                MasterError: 1001,
                MasterConnectFailed: 1002,
                MasterConnectClosed: 1003,
                MasterTimeout: 1004,
                MasterEncryptionEstablishError: 1005,
                MasterAuthenticationFailed: 1101,
                GameError: 2001,
                GameConnectFailed: 2002,
                GameConnectClosed: 2003,
                GameTimeout: 2004,
                GameEncryptionEstablishError: 2005,
                GameAuthenticationFailed: 2101,
                NameServerError: 3001,
                NameServerConnectFailed: 3002,
                NameServerConnectClosed: 3003,
                NameServerTimeout: 3004,
                NameServerEncryptionEstablishError: 3005,
                NameServerAuthenticationFailed: 3101,
            };
            LoadBalancingClient.State = {
                /**
                    @summary Enum for client states.
                    @member Photon.LoadBalancing.LoadBalancingClient.State
                    @readonly
                    @property {number} Error Critical error occurred.
                    @property {number} Uninitialized Client is created but not used yet.
                    @property {number} ConnectingToNameServer Connecting to NameServer.
                    @property {number} ConnectedToNameServer Connected to NameServer.
                    @property {number} ConnectingToMasterserver Connecting to Master (includes connect, authenticate and joining the lobby).
                    @property {number} ConnectedToMaster Connected to Master server.
                    @property {number} JoinedLobby Connected to Master and joined lobby. Display room list and join/create rooms at will.
                    @property {number} ConnectingToGameserver Connecting to Game server(client will authenticate and join/create game).
                    @property {number} ConnectedToGameserver Connected to Game server (going to auth and join game).
                    @property {number} Joined The client joined room.
                    @property {number} Disconnected The client is no longer connected (to any server). Connect to Master to go on.
                */
                Error: -1,
                Uninitialized: 0,
                ConnectingToNameServer: 1,
                ConnectedToNameServer: 2,
                ConnectingToMasterserver: 3,
                ConnectedToMaster: 4,
                JoinedLobby: 5,
                ConnectingToGameserver: 6,
                ConnectedToGameserver: 7,
                Joined: 8,
                Disconnected: 10,
            };
            // Separate inverse dictionary required because State members may be obfuscated during minification
            LoadBalancingClient.stateName = (_a = {},
                _a[LoadBalancingClient.State.Error] = "Error",
                _a[LoadBalancingClient.State.Uninitialized] = "Uninitialized",
                _a[LoadBalancingClient.State.ConnectingToNameServer] = "ConnectingToNameServer",
                _a[LoadBalancingClient.State.ConnectedToNameServer] = "ConnectedToNameServer",
                _a[LoadBalancingClient.State.ConnectingToMasterserver] = "ConnectingToMasterserver",
                _a[LoadBalancingClient.State.ConnectedToMaster] = "ConnectedToMaster",
                _a[LoadBalancingClient.State.JoinedLobby] = "JoinedLobby",
                _a[LoadBalancingClient.State.ConnectingToGameserver] = "ConnectingToGameserver",
                _a[LoadBalancingClient.State.ConnectedToGameserver] = "ConnectedToGameserver",
                _a[LoadBalancingClient.State.Joined] = "Joined",
                _a[LoadBalancingClient.State.Disconnected] = "Disconnected",
                _a);
            return LoadBalancingClient;
        }());
        LoadBalancing.LoadBalancingClient = LoadBalancingClient;
        //TODO: internal
        var LbcPeer = /** @class */ (function (_super) {
            __extends(LbcPeer, _super);
            function LbcPeer() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            LbcPeer.prototype.webRpc = function (uriPath, parameters, options) {
                var params = [];
                params.push(LoadBalancing.Constants.ParameterCode.UriPath, uriPath);
                params.push(LoadBalancing.Constants.ParameterCode.RpcCallParams, parameters);
                if (options) {
                    if (options.sendAuthCookie) {
                        params.push(LoadBalancing.Constants.ParameterCode.WebFlags, Photon.TypeExt.Byte(WebFlags.SendAuthCookie));
                    }
                }
                this.sendOperation(LoadBalancing.Constants.OperationCode.Rpc, params);
            };
            LbcPeer.prototype.webRpcHandler = function (lbc) {
                var _this = this;
                return function (d) {
                    _this._logger.debug("resp Rpc", d);
                    var uriPath, message, data, resultCode;
                    if (d.errCode == 0) {
                        uriPath = d.vals[LoadBalancing.Constants.ParameterCode.UriPath];
                        data = d.vals[LoadBalancing.Constants.ParameterCode.RpcCallRetData];
                        resultCode = d.vals[LoadBalancing.Constants.ParameterCode.RpcCallRetCode];
                    }
                    else {
                        _this._logger.error("WebRpc request error:", d.errCode);
                    }
                    lbc.onWebRpcResult(d.errCode, d.errMsg, uriPath, resultCode, data);
                };
            };
            return LbcPeer;
        }(Photon.PhotonPeer));
        LoadBalancing.LbcPeer = LbcPeer;
        var NameServerPeer = /** @class */ (function (_super) {
            __extends(NameServerPeer, _super);
            function NameServerPeer(client, protocol, address, subprotocol) {
                var _this = _super.call(this, protocol, address, subprotocol, client.logger.getPrefix() + " NameServer") || this;
                _this.client = client;
                return _this;
            }
            // overrides
            NameServerPeer.prototype.onUnhandledEvent = function (code, args) {
                this.client.onEvent(code, args.vals[LoadBalancing.Constants.ParameterCode.CustomEventContent], args.vals[LoadBalancing.Constants.ParameterCode.ActorNr]);
            };
            NameServerPeer.prototype.onUnhandledResponse = function (code, args) {
                this.client.onOperationResponse(args.errCode, args.errMsg, code, args.vals);
            };
            NameServerPeer.prototype.getRegions = function (appId) {
                var params = [];
                params.push(LoadBalancing.Constants.ParameterCode.ApplicationId, appId);
                this.sendOperation(LoadBalancing.Constants.OperationCode.GetRegions, params, true, 0);
            };
            // this = LBC
            NameServerPeer.prototype.opAuth = function (appId, appVersion, userAuthType, userAuthParameters, userAuthData, userId, region) {
                var op = [];
                op.push(LoadBalancing.Constants.ParameterCode.ApplicationId, appId);
                op.push(LoadBalancing.Constants.ParameterCode.AppVersion, appVersion);
                if (userAuthType != LoadBalancing.Constants.CustomAuthenticationType.None) {
                    op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationType, Photon.TypeExt.Byte(userAuthType));
                    op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationParams, userAuthParameters);
                    if (userAuthData) {
                        op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationData, userAuthData);
                    }
                }
                if (userId) {
                    op.push(LoadBalancing.Constants.ParameterCode.UserId, userId);
                }
                //            if (this.connectOptions.lobbyStats) {
                //                op.push(Constants.ParameterCode.LobbyStats, true);
                //            }
                op.push(LoadBalancing.Constants.ParameterCode.Region, region);
                this.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op, true, 0);
                this._logger.info("Authenticate...");
            };
            return NameServerPeer;
        }(LbcPeer));
        LoadBalancing.NameServerPeer = NameServerPeer;
        //TODO: internal
        var MasterPeer = /** @class */ (function (_super) {
            __extends(MasterPeer, _super);
            function MasterPeer(client, protocol, address, subprotocol) {
                var _this = _super.call(this, protocol, address, subprotocol, client.logger.getPrefix() + " Master") || this;
                _this.client = client;
                return _this;
            }
            // overrides
            MasterPeer.prototype.onUnhandledEvent = function (code, args) {
                this.client.onEvent(code, args.vals[LoadBalancing.Constants.ParameterCode.CustomEventContent], args.vals[LoadBalancing.Constants.ParameterCode.ActorNr]);
            };
            MasterPeer.prototype.onUnhandledResponse = function (code, args) {
                this.client.onOperationResponse(args.errCode, args.errMsg, code, args.vals);
            };
            MasterPeer.prototype.findFriends = function (friendsToFind) {
                var params = [];
                params.push(LoadBalancing.Constants.ParameterCode.FindFriendsRequestList);
                params.push(Photon.TypeExt.String(friendsToFind));
                this.sendOperation(LoadBalancing.Constants.OperationCode.FindFriends, params);
            };
            MasterPeer.prototype.requestLobbyStats = function (lobbiesToRequest) {
                var params = [];
                if (lobbiesToRequest && lobbiesToRequest.length > 0) {
                    var n = new Array();
                    var t = new Array();
                    for (var i = 0; i < lobbiesToRequest.length; ++i) {
                        n[i] = lobbiesToRequest[i][0];
                        t[i] = lobbiesToRequest[i][1];
                    }
                    params.push(LoadBalancing.Constants.ParameterCode.LobbyName);
                    params.push(Photon.TypeExt.String(n));
                    params.push(LoadBalancing.Constants.ParameterCode.LobbyType);
                    params.push(Photon.TypeExt.Byte(t));
                }
                this.sendOperation(LoadBalancing.Constants.OperationCode.LobbyStats, params);
            };
            return MasterPeer;
        }(LbcPeer));
        LoadBalancing.MasterPeer = MasterPeer;
        //TODO: internal
        var GamePeer = /** @class */ (function (_super) {
            __extends(GamePeer, _super);
            function GamePeer(client, protocol, address, subprotocol) {
                var _this = _super.call(this, protocol, address, subprotocol, client.logger.getPrefix() + " Game") || this;
                _this.client = client;
                _this.onEventNative = function (code, vals) {
                    if (_this.client.onEventNative) {
                        return _this.client.onEventNative(code, vals);
                    }
                    else {
                        return false;
                    }
                };
                return _this;
            }
            // overrides
            GamePeer.prototype.onUnhandledEvent = function (code, args) {
                this.client.onEvent(code, args.vals[LoadBalancing.Constants.ParameterCode.CustomEventContent], args.vals[LoadBalancing.Constants.ParameterCode.ActorNr]);
            };
            // overrides
            GamePeer.prototype.onUnhandledResponse = function (code, args) {
                this.client.onOperationResponse(args.errCode, args.errMsg, code, args.vals);
            };
            GamePeer.prototype.raiseEvent = function (eventCode, data, options) {
                if (this.client.isJoinedToRoom()) {
                    this._logger.debug("raiseEvent", eventCode, data, options);
                    var params = [LoadBalancing.Constants.ParameterCode.Code, Photon.TypeExt.Byte(eventCode), LoadBalancing.Constants.ParameterCode.Data, data];
                    if (options) {
                        if (options.receivers != undefined && options.receivers !== LoadBalancing.Constants.ReceiverGroup.Others) {
                            params.push(LoadBalancing.Constants.ParameterCode.ReceiverGroup);
                            params.push(Photon.TypeExt.Byte(options.receivers));
                        }
                        if (options.cache != undefined && options.cache !== LoadBalancing.Constants.EventCaching.DoNotCache) {
                            params.push(LoadBalancing.Constants.ParameterCode.Cache);
                            params.push(Photon.TypeExt.Byte(options.cache));
                        }
                        if (options.interestGroup != undefined) {
                            if (this.checkGroupNumber(options.interestGroup)) {
                                params.push(LoadBalancing.Constants.ParameterCode.Group);
                                params.push(Photon.TypeExt.Byte(options.interestGroup));
                            }
                            else {
                                this._logger.exception(502, "raiseEvent - Group not a number: " + options.interestGroup);
                            }
                        }
                        if (options.targetActors != undefined) {
                            params.push(LoadBalancing.Constants.ParameterCode.ActorList);
                            params.push(Photon.TypeExt.Int(options.targetActors));
                        }
                        if (options.webForward) {
                            params.push(LoadBalancing.Constants.ParameterCode.WebFlags);
                            params.push(Photon.TypeExt.Byte(WebFlags.HttpForward));
                        }
                    }
                    this.sendOperation(LoadBalancing.Constants.OperationCode.RaiseEvent, params);
                }
                else {
                    throw new Error("raiseEvent - Not joined!");
                }
            };
            GamePeer.prototype.changeGroups = function (groupsToRemove, groupsToAdd) {
                var params = [];
                if (groupsToRemove != null && groupsToRemove != undefined) {
                    this.checkGroupArray(groupsToRemove, "groupsToRemove");
                    params.push(LoadBalancing.Constants.ParameterCode.Remove);
                    params.push(Photon.TypeExt.Byte(groupsToRemove));
                }
                if (groupsToAdd != null && groupsToAdd != undefined) {
                    this.checkGroupArray(groupsToAdd, "groupsToAdd");
                    params.push(LoadBalancing.Constants.ParameterCode.Add);
                    params.push(Photon.TypeExt.Byte(groupsToAdd));
                }
                this.sendOperation(LoadBalancing.Constants.OperationCode.ChangeGroups, params);
            };
            GamePeer.prototype.checkGroupNumber = function (g) {
                return !(typeof (g) != "number" || isNaN(g) || g === Infinity || g === -Infinity);
            };
            GamePeer.prototype.checkGroupArray = function (groups, groupsName) {
                if (Photon.Util.isArray(groups)) {
                    for (var i = 0; i < groups.length; ++i) {
                        var g = groups[i];
                        if (this.checkGroupNumber(g)) {
                        }
                        else {
                            this._logger.exception(503, "changeGroups - " + groupsName + " (" + groups + ") not an array of numbers: element " + i + " = " + g);
                        }
                    }
                }
                else {
                    this._logger.exception(504, "changeGroups - groupsToRemove not an array: " + groups);
                }
            };
            return GamePeer;
        }(LbcPeer));
        LoadBalancing.GamePeer = GamePeer;
    })(LoadBalancing = Photon.LoadBalancing || (Photon.LoadBalancing = {}));
})(Photon || (Photon = {}));
/**
    Photon Load Balancing API Constants
    @namespace Photon.LoadBalancing.Constants
*/
// Legacy Lite application codes used in LoadBalancing
var Photon;
(function (Photon) {
    var Lite;
    (function (Lite) {
        var Constants;
        (function (Constants) {
            Constants.LiteOpKey = {
                ActorList: 252,
                ActorNr: 254,
                ActorProperties: 249,
                Add: 238,
                Broadcast: 250,
                Cache: 247,
                Code: 244,
                Data: 245,
                GameId: 255,
                GameProperties: 248,
                Group: 240,
                Properties: 251,
                ReceiverGroup: 246,
                Remove: 239,
                TargetActorNr: 253,
                RoomTTL: 236,
            };
            Constants.LiteEventCode = {
                Join: 255,
                Leave: 254,
                PropertiesChanged: 253,
            };
            Constants.LiteOpCode = {
                ChangeGroups: 248,
                GetProperties: 251,
                Join: 255,
                Leave: 254,
                RaiseEvent: 253,
                SetProperties: 252,
            };
        })(Constants = Lite.Constants || (Lite.Constants = {}));
    })(Lite = Photon.Lite || (Photon.Lite = {}));
})(Photon || (Photon = {}));
(function (Photon) {
    var LoadBalancing;
    (function (LoadBalancing) {
        var Constants;
        (function (Constants) {
            var LiteOpKey = Photon.Lite.Constants.LiteOpKey;
            var LiteOpCode = Photon.Lite.Constants.LiteOpCode;
            var LiteEventCode = Photon.Lite.Constants.LiteEventCode;
            /**
                @summary Master and Game servers error codes.
                @member Photon.LoadBalancing.Constants.ErrorCode
                @readonly
                @property {number} Ok No Error.
                @property {number} OperationNotAllowedInCurrentState Operation can't be executed yet.
                @property {number} InvalidOperationCode The operation you called is not implemented on the server (application) you connect to. Make sure you run the fitting applications.
                @property {number} InternalServerError Something went wrong in the server. Try to reproduce and contact Exit Games.
                @property {number} InvalidAuthentication Authentication failed. Possible cause: AppId is unknown to Photon (in cloud service).
                @property {number} GameIdAlreadyExists GameId (name) already in use (can't create another). Change name.
                @property {number} GameFull Game is full. This can when players took over while you joined the game.
                @property {number} GameClosed Game is closed and can't be joined. Join another game.
                @property {number} ServerFull All servers are busy. This is a temporary issue and the game logic should try again after a brief wait time.
                @property {number} UserBlocked Not in use currently.
                @property {number} NoRandomMatchFound Random matchmaking only succeeds if a room exists thats neither closed nor full. Repeat in a few seconds or create a new room.
                @property {number} GameDoesNotExist Join can fail if the room (name) is not existing (anymore). This can happen when players leave while you join.
                @property {number} MaxCcuReached Authorization on the Photon Cloud failed becaus the concurrent users (CCU) limit of the app's subscription is reached.
                @property {number} InvalidRegion Authorization on the Photon Cloud failed because the app's subscription does not allow to use a particular region's server.
                @property {number} CustomAuthenticationFailed Custom Authentication of the user failed due to setup reasons (see Cloud Dashboard) or the provided user data (like username or token). Check error message for details.
                @property {number} AuthenticationTicketExpired The Authentication ticket expired. Usually, this is refreshed behind the scenes. Connect (and authorize) again.
                @property {number} PluginReportedError A server-side plugin (or webhook) failed to execute and reported an error. Check the OperationResponse.DebugMessage.
                @property {number} PluginMismatch CreateGame/JoinGame/Join operation fails if expected plugin does not correspond to loaded one.
                @property {number} JoinFailedPeerAlreadyJoined For join requests. Indicates the current peer already called join and is joined to the room.
                @property {number} JoinFailedFoundInactiveJoiner For join requests. Indicates the list of InactiveActors already contains an actor with the requested ActorNr or UserId.
                @property {number} JoinFailedWithRejoinerNotFound For join requests. Indicates the list of Actors (active and inactive) did not contain an actor with the requested ActorNr or UserId.
                @property {number} JoinFailedFoundExcludedUserId For join requests. Note: for future use - Indicates the requested UserId was found in the ExcludedList.
                @property {number} JoinFailedFoundActiveJoiner For join requests. Indicates the list of ActiveActors already contains an actor with the requested ActorNr or UserId.
                @property {number} HttpLimitReached For SetProerties and Raisevent (if flag HttpForward is true) requests. Indicates the maximum allowed http requests per minute was reached.
                @property {number} ExternalHttpCallFailed For WebRpc requests. Indicates the the call to the external service failed.
                @property {number} OperationLimitReached For operations with defined limits (as in calls per second, content count or size)
                @property {number} SlotErrorServer Error during matchmaking with slot reservation. E.g. the reserved slots can not exceed MaxPlayers.
                @property {number} InvalidEncryptionParameters Server will react with this error if invalid encryption parameters provided by token
            */
            Constants.ErrorCode = {
                Ok: 0,
                OperationNotAllowedInCurrentState: -3,
                InvalidOperationCode: -2,
                InternalServerError: -1,
                InvalidAuthentication: 0x7FFF,
                GameIdAlreadyExists: 0x7FFF - 1,
                GameFull: 0x7FFF - 2,
                GameClosed: 0x7FFF - 3,
                ServerFull: 0x7FFF - 5,
                UserBlocked: 0x7FFF - 6,
                NoRandomMatchFound: 0x7FFF - 7,
                GameDoesNotExist: 0x7FFF - 9,
                MaxCcuReached: 0x7FFF - 10,
                InvalidRegion: 0x7FFF - 11,
                CustomAuthenticationFailed: 0x7FFF - 12,
                AuthenticationTicketExpired: 0x7FF1,
                PluginReportedError: 0x7FFF - 15,
                PluginMismatch: 0x7FFF - 16,
                JoinFailedPeerAlreadyJoined: 32750, // 0x7FFF - 17,
                JoinFailedFoundInactiveJoiner: 32749, // 0x7FFF - 18,
                JoinFailedWithRejoinerNotFound: 32748, // 0x7FFF - 19,
                JoinFailedFoundExcludedUserId: 32747, // 0x7FFF - 20,
                JoinFailedFoundActiveJoiner: 32746, // 0x7FFF - 21,
                HttpLimitReached: 32745, // 0x7FFF - 22,
                ExternalHttpCallFailed: 32744, // 0x7FFF - 23,
                OperationLimitReached: 32743, // 0x7FFF - 24,
                SlotError: 32742, // 0x7FFF - 25,
                InvalidEncryptionParameters: 32741, // 0x7FFF - 24,
            };
            /** End user doesn't need this */
            // These  values define "well known" properties for an Actor / Player.
            // "Custom properties" have to use a string-type as key. They can be assigned at will.
            Constants.ActorProperties = {
                PlayerName: 255, // was: 1
                UserId: 253
            };
            /** End user doesn't need this */
            // These  values are for "well known" room/game properties used in Photon Loadbalancing.
            // "Custom properties" have to use a string-type as key. They can be assigned at will.
            Constants.GameProperties = {
                // (255) Max number of players that "fit" into this room. 0 is for "unlimited".
                MaxPlayers: 255,
                // (254) Makes this room listed or not in the lobby on Master.
                IsVisible: 254,
                // (253) Allows more players to join a room (or not).
                IsOpen: 253,
                // (252) Current count od players in the room. Used only in the lobby on Master.
                PlayerCount: 252,
                // (251) True if the room is to be removed from room listing (used in update to room list in lobby on Master)
                Removed: 251,
                // (250) A list of the room properties to pass to the RoomInfo list in a lobby. This is used in CreateRoom, which defines this list once per room.
                PropsListedInLobby: 250,
                // Equivalent of Operation Join parameter CleanupCacheOnLeave.
                CleanupCacheOnLeave: 249,
                // (248) Code for MasterClientId, which is synced by server. When sent as op-parameter this is (byte)203. As room property this is (byte)248.
                // Tightly related to ParameterCode.MasterClientId.
                MasterClientId: 248,
                // (247) Code for ExpectedUsers in a room. Matchmaking keeps a slot open for the players with these userIDs.
                ExpectedUsers: 247,
                // (246) Player Time To Live. How long any player can be inactive (due to disconnect or leave) before the user gets removed from the playerlist (freeing a slot).
                PlayerTTL: 246,
                // (245) Room Time To Live. How long a room stays available (and in server-memory), after the last player becomes inactive. After this time, the room gets persisted or destroyed.
                RoomTTL: 245,
            };
            /** End user doesn't need this */
            // These values are for events defined by Photon Loadbalancing.
            // They start at 255 and go DOWN. Your own in-game events can start at 0.
            Constants.EventCode = {
                // (230) Initial list of RoomInfos (in lobby on Master)
                GameList: 230,
                // (229) Update of RoomInfos to be merged into "initial" list (in lobby on Master)
                GameListUpdate: 229,
                // (228) Currently not used. State of queueing in case of server-full
                QueueState: 228,
                // (227) Currently not used. Event for matchmaking
                // Match: 227,
                // (226) Event with stats about this application (players, rooms, etc)
                AppStats: 226,
                // (210) Internally used in case of hosting by Azure
                AzureNodeInfo: 210,
                // (255) Event Join: someone joined the game. The new actorNumber is provided as well as the properties of that actor (if set in OpJoin).
                Join: LiteEventCode.Join,
                // (254) Event Leave: The player who left the game can be identified by the actorNumber.
                Leave: LiteEventCode.Leave,
                // (253) When you call OpSetProperties with the broadcast option "on", this event is fired. It contains the properties being set.
                PropertiesChanged: LiteEventCode.PropertiesChanged,
                // (252) When player left game unexpecable and playerTTL > 0 this event is fired
                Disconnect: 252,
                LobbyStats: 224,
                // (251) Sent by Photon Cloud when a plugin-call or webhook-call failed or events cache limit exceeded. Usually, the execution on the server continues, despite the issue. Contains: ParameterCode.Info.
                // see also https://doc.photonengine.com/en-us/realtime/current/reference/webhooks#options"
                ErrorInfo: 251,
                // (223) Sent by Photon to update a token before it times out.
                AuthEvent: 223,
            };
            /** End user doesn't need this */
            // Codes for parameters of Operations and Events.
            Constants.ParameterCode = {
                // (230) Address of a (Game) server to use.
                Address: 230,
                // (229) Count of players in this application in a rooms (used in stats event)
                PeerCount: 229,
                // (228) Count of games in this application (used in stats event)
                GameCount: 228,
                // (227) Count of players on the Master server (in this app, looking for rooms)
                MasterPeerCount: 227,
                // (225) User's ID
                UserId: 225,
                // (224) Your application's ID: a name on your own Photon or a GUID on the Photon Cloud
                ApplicationId: 224,
                // (223) Not used currently (as "Position"). If you get queued before connect, this is your position
                Position: 223,
                // (223) Modifies the matchmaking algorithm used for OpJoinRandom. Allowed parameter values are defined in enum MatchmakingMode.
                MatchMakingType: 223,
                // (222) List of RoomInfos about open / listed rooms
                GameList: 222,
                // (221) Internally used to establish encryption
                Secret: 221,
                // (220) Version of your application
                AppVersion: 220,
                // (210) Internally used in case of hosting by Azure
                AzureNodeInfo: 210, // only used within events, so use: EventCode.AzureNodeInfo
                // (209) Internally used in case of hosting by Azure
                AzureLocalNodeId: 209,
                // (208) Internally used in case of hosting by Azure
                AzureMasterNodeId: 208,
                // (255) Code for the gameId/roomName (a unique name per room). Used in OpJoin and similar.
                RoomName: LiteOpKey.GameId,
                // (250) Code for broadcast parameter of OpSetProperties method.
                Broadcast: LiteOpKey.Broadcast,
                // (252) Code for list of players in a room.
                ActorList: LiteOpKey.ActorList,
                // (254) Code of the Actor of an operation. Used for property get and set.
                ActorNr: LiteOpKey.ActorNr,
                // (249) Code for property set (Hashtable).
                PlayerProperties: LiteOpKey.ActorProperties,
                // (245) Code of data/custom content of an event. Used in OpRaiseEvent.
                CustomEventContent: LiteOpKey.Data,
                // (245) Code of data of an event. Used in OpRaiseEvent.
                Data: LiteOpKey.Data,
                // (244) Code used when sending some code-related parameter, like OpRaiseEvent's event-code.
                // This is not the same as the Operation's code, which is no longer sent as part of the parameter Dictionary in Photon 3.
                Code: LiteOpKey.Code,
                // (248) Code for property set (Hashtable).
                GameProperties: LiteOpKey.GameProperties,
                // (251) Code for property-set (Hashtable). This key is used when sending only one set of properties.
                // If either ActorProperties or GameProperties are used (or both), check those keys.
                Properties: LiteOpKey.Properties,
                // (253) Code of the target Actor of an operation. Used for property set. Is 0 for game
                TargetActorNr: LiteOpKey.TargetActorNr,
                // (246) Code to select the receivers of events (used in Lite, Operation RaiseEvent).
                ReceiverGroup: LiteOpKey.ReceiverGroup,
                // (247) Code for caching events while raising them.
                Cache: LiteOpKey.Cache,
                // (241) Boolean parameter of CreateGame Operation. If true, server cleans up roomcache of leaving players (their cached events get removed).
                CleanupCacheOnLeave: 241,
                // (240) Code for "group" operation-parameter (as used in Op RaiseEvent).
                Group: LiteOpKey.Group,
                // (239) The "Remove" operation-parameter can be used to remove something from a list. E.g. remove groups from player's interest groups.
                Remove: LiteOpKey.Remove,
                // (238) The "Add" operation-parameter can be used to add something to some list or set. E.g. add groups to player's interest groups.
                Add: LiteOpKey.Add,
                // (236) A parameter indicating how long a room instance should be keeped alive in the room cache after all players left the room.
                RoomTTL: LiteOpKey.RoomTTL,
                PlayerTTL: 235,
                Plugins: 204,
                // (217) This key's (byte) value defines the target custom authentication type/service the client connects with. Used in OpAuthenticate.
                ClientAuthenticationType: 217,
                // (216) This key's (string) value provides parameters sent to the custom authentication type/service the client connects with. Used in OpAuthenticate.
                ClientAuthenticationParams: 216,
                ClientAuthenticationData: 214,
                // (215) The JoinMode enum defines which variant of joining a room will be executed: Join only if available, create if not exists or re -join.
                // Replaces CreateIfNotExists which was only a bool -value.
                JoinMode: 215,
                // (203) Code for MasterClientId, which is synced by server. When sent as op-parameter this is code 203.
                // Tightly related to GamePropertyKey.MasterClientId.
                MasterClientId: 203,
                // (1) Used in Op FindFriends request. Value must be string[] of friends to look up.
                FindFriendsRequestList: 1,
                // (1) Used in Op FindFriends response. Contains boolean[] list of online states (false if not online).
                FindFriendsResponseOnlineList: 1,
                // (2) Used in Op FindFriends response. Contains string[] of room names ("" where not known or no room joined).
                FindFriendsResponseRoomIdList: 2,
                // (213) Used in matchmaking-related methods and when creating a room to name a lobby (to join or to attach a room to).
                LobbyName: 213,
                // (212) Used in matchmaking-related methods and when creating a room to define the type of a lobby. Combined with the lobby name this identifies the lobby.
                LobbyType: 212,
                LobbyStats: 211,
                // (210) Used for region values in OpAuth and OpGetRegions.
                Region: 210,
                IsInactive: 233,
                CheckUserOnJoin: 232,
                // (231) Code for "Check And Swap" (CAS) when changing properties.
                ExpectedValues: 231,
                UriPath: 209,
                RpcCallParams: 208,
                RpcCallRetCode: 207,
                RpcCallRetMessage: 206,
                RpcCallRetData: 208,
                WebFlags: 234,
                // Used by the server in Operation Responses, when it sends the nickname of the client (the user's nickname).
                Nickname: 202,
                // Used in Op Join to define if UserIds of the players are broadcast in the room. Useful for FindFriends and reserving slots for expected users.
                PublishUserId: 239,
                // Content for EventCode.ErrorInfo and internal debug operations
                Info: 218,
            };
            /**
                @summary Codes for parameters and events used in Photon Load Balancing API.
                @member Photon.LoadBalancing.Constants.OperationCode
                @readonly
                @property {number} Authenticate Authenticates this peer and connects to a virtual application.
                @property {number} JoinLobby Joins lobby (on Master).
                @property {number} LeaveLobby Leaves lobby (on Master).
                @property {number} CreateGame Creates a game (or fails if name exists).
                @property {number} JoinGame Joins room (by name).
                @property {number} JoinRandomGame Joins random room (on Master).
                @property {number} Leave Leaves the room.
                @property {number} RaiseEvent Raises event (in a room, for other actors/players).
                @property {number} SetProperties Sets Properties (of room or actor/player).
                @property {number} GetProperties Gets Properties.
                @property {number} ChangeGroups Changes interest groups in room.
                @property {number} FindFriends Requests Master server for actors online status and joined rooms.
                @property {number} LobbyStats Requests Master server for lobbies statistics.
                @property {number} GetRegions Gets list of regional servers from a NameServer.
                @property {number} Rpc Rpc operation.
        
            */
            Constants.OperationCode = {
                Authenticate: 230,
                JoinLobby: 229,
                LeaveLobby: 228,
                CreateGame: 227,
                JoinGame: 226,
                JoinRandomGame: 225,
                Leave: LiteOpCode.Leave,
                RaiseEvent: LiteOpCode.RaiseEvent,
                SetProperties: LiteOpCode.SetProperties,
                GetProperties: LiteOpCode.GetProperties,
                ChangeGroups: LiteOpCode.ChangeGroups,
                FindFriends: 222,
                LobbyStats: 221,
                GetRegions: 220,
                Rpc: 219,
            };
            /**
                @summary Options for matchmaking rules for joinRandomGame.
                @member Photon.LoadBalancing.Constants.MatchmakingMode
                @readonly
                @property {number} FillRoom Default. FillRoom Fills up rooms (oldest first) to get players together as fast as possible. Makes most sense with MaxPlayers > 0 and games that can only start with more players.
                @property {number} SerialMatching Distributes players across available rooms sequentially but takes filter into account. Without filter, rooms get players evenly distributed.
                @property {number} RandomMatching Joins a (fully) random room. Expected properties must match but aside from this, any available room might be selected.
            */
            Constants.MatchmakingMode = {
                FillRoom: 0,
                SerialMatching: 1,
                RandomMatching: 2
            };
            /**
                @summary Caching options for events.
                @member Photon.LoadBalancing.Constants.EventCaching
                @readonly
                @property {number} DoNotCache Default. Do not cache.
                @property {number} MergeCache Will merge this event's keys with those already cached.
                @property {number} ReplaceCache Replaces the event cache for this eventCode with this event's content.
                @property {number} RemoveCache Removes this event (by eventCode) from the cache.
                @property {number} AddToRoomCache Adds an event to the room's cache.
                @property {number} AddToRoomCacheGlobal Adds this event to the cache for actor 0 (becoming a "globally owned" event in the cache).
                @property {number} RemoveFromRoomCache Remove fitting event from the room's cache.
                @property {number} RemoveFromRoomCacheForActorsLeft Removes events of players who already left the room (cleaning up).
            */
            Constants.EventCaching = {
                DoNotCache: 0,
                MergeCache: 1,
                ReplaceCache: 2,
                RemoveCache: 3,
                AddToRoomCache: 4,
                AddToRoomCacheGlobal: 5,
                RemoveFromRoomCache: 6,
                RemoveFromRoomCacheForActorsLeft: 7,
            };
            /**
                @summary Options for choosing room's actors who should receive events.
                @member Photon.LoadBalancing.Constants.ReceiverGroup
                @readonly
                @property {number} Others Default. Anyone else gets my event.
                @property {number} All Everyone in the current room (including this peer) will get this event.
                @property {number} MasterClient The "master client" does not have special rights but is the one who is in this room the longest time.
            */
            Constants.ReceiverGroup = {
                Others: 0,
                All: 1,
                MasterClient: 2,
            };
            /**
                @summary Options for optional "Custom Authentication" services used with Photon.
                @member Photon.LoadBalancing.Constants.CustomAuthenticationType
                @readonly
                @property {number} Custom Default. Use a custom authentification service.
                @property {number} Steam Authenticates users by their Steam Account. Set Steam's ticket as "ticket" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} Facebook Authenticates users by their Facebook Account. Set Facebooks's tocken as "token" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} Oculus Authenticates users by their Oculus Account and token. Set Oculus' userid as "userid" and nonce as "nonce" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} PlayStation4 Authenticates users by their PSN Account and token on PS4. Set token as "token", env as "env" and userName as "userName" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} Xbox Authenticates users by their Xbox Account. Pass the XSTS token via "authData" parameter of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} Viveport Authenticates users by their HTC Viveport Account. Set userToken as "userToken" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} NintendoSwitch Authenticates users by their NSA ID. Set token  as "token" and appversion as "appversion" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}(). The appversion is optional.
                @property {number} PlayStation5 Authenticates users by their PSN Account and token on PS5. Set token as "token", env as "env" and userName as "userName" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} Epic Authenticates users with Epic Online Services (EOS). Set token as "token" and ownershipToken as "ownershipToken" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}(). The ownershipToken is optional.
                @property {number} FacebookGaming Authenticates users with Facebook Gaming api. Set token as "token" via "authParameters" of {@link Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication setCustomAuthentication}().
                @property {number} None Disables custom authentification.
            */
            Constants.CustomAuthenticationType = {
                Custom: 0,
                Steam: 1,
                Facebook: 2,
                Oculus: 3,
                PlayStation4: 4,
                Xbox: 5,
                Viveport: 10,
                NintendoSwitch: 11,
                PlayStation5: 12,
                Epic: 13,
                FacebookGaming: 15,
                None: 255
            };
            /**
                @summary Options of lobby types available. Lobby types might be implemented in certain Photon versions and won't be available on older servers.
                @member Photon.LoadBalancing.Constants.LobbyType
                @readonly
                @property {number} Default This lobby is used unless another is defined by game or JoinRandom. Room-lists will be sent and JoinRandomRoom can filter by matching properties.
                @property {number} SqlLobby This lobby type lists rooms like Default but JoinRandom has a parameter for SQL-like "where" clauses for filtering. This allows bigger, less, or and and combinations.
                @property {number} AsyncRandomLobby This lobby does not send lists of games. It is only used for OpJoinRandomRoom. It keeps rooms available for a while when there are only inactive users left.
            **/
            Constants.LobbyType = {
                Default: 0,
                SqlLobby: 2,
                AsyncRandomLobby: 3
            };
        })(Constants = LoadBalancing.Constants || (LoadBalancing.Constants = {}));
    })(LoadBalancing = Photon.LoadBalancing || (Photon.LoadBalancing = {}));
})(Photon || (Photon = {}));
/// <reference path="photon-common.ts"/>
/**
    Photon Chat API Constants
    @namespace Photon.Chat.Constants
*/
var Photon;
(function (Photon) {
    var Chat;
    (function (Chat) {
        var Constants;
        (function (Constants) {
            var _a;
            Constants.ParameterCode = {
                Channels: 0, // Array of chat channels.
                Channel: 1, // Name of a single chat channel.
                Messages: 2, // Array of chat messages.
                Message: 3, // A single chat message.
                Senders: 4, // Array of names of the users who sent the array of chat mesages.
                Sender: 5, // Name of a the user who sent a chat message.
                ChannelUserCount: 6, // Not used.
                UserId: 225, // Name of user to send a(private) message to.
                MsgId: 8, // Id of a message.
                MsgIds: 9, // Array of messages ids
                SubscribeResults: 15, // Subscribe operation result parameter.A boolean[] with result per channel.
                Status: 10, // Status
                Friends: 11, // Friends
                SkipMessage: 12, // SkipMessage is used in SetUserStatus and if true, the message is not being broadcast.
                HistoryLength: 14, // Number of message to fetch from history. 0: no history. 1 and higher: number of messages in history. -1: all history.</summary>
                WebFlags: 21, // WebFlags object for changing behaviour of webhooks from client.
                Properties: 22, // Properties of channel or user.
                ChannelSubscribers: 23, //Array of UserIds of users already subscribed to a channel.
            };
            //- Codes for parameters and events used in Photon Chat API.
            Constants.OperationCode = {
                Subscribe: 0, // Operation to subscribe to chat channels.
                Unsubscribe: 1, // Operation to unsubscribe from chat channels.
                Publish: 2, // Operation to publish a message in a chat channel.
                SendPrivate: 3, // Operation to send a private message to some other user.
                ChannelHistory: 4, // Not used yet.
                UpdateStatus: 5, // Set your (client's) status.
                AddFriendds: 6, // Adds users to the list that should update you of their status.
                RemoveFriends: 7 // Removes users from the list that should update you of their status.
            };
            //  Events used for opertion result notifications because user can be connected from multiple devices.
            Constants.EventCode = {
                ChatMessages: 0,
                Users: 1, // List of users or List of changes for List of users
                PrivateMessage: 2,
                FriendsList: 3,
                StatusUpdate: 4,
                Subscribe: 5, // My subscribe operation result.
                Unsubscribe: 6, // My unsubscribe operation result.
                UserSubscribe: 8, // Other user subscribed
                UserUnsubscribe: 9, // Other user unsubscribed
            };
            /**
                @summary Contains commonly used status values for {@link Photon.Chat.ChatClient#setUserStatus}.You can define your own.<br/>
                While "online"(Online and up), the status message will be sent to anyone who has you on his friend list.<br/>
                Define custom online status values as you like with these rules:<br/>
                0: Means "offline".It will be used when you are not connected. In this status, there is no status message.<br/>
                1: Means "invisible" and is sent to friends as "offline". They see status 0, no message but you can chat.<br/>
                2: And any higher value will be treated as "online". Status can be set.<br/>
                @readonly
                @property {number} Offline Offline.
                @property {number} Invisible Offline. Be invisible to everyone. Sends no message.
                @property {number} Online Online and available.
                @property {number} Away Online but not available.
                @property {number} Dnd Do not disturb.
                @property {number} Lfg Looking For Game / Group. Could be used when you want to be invited or do matchmaking.
                @property {number} Playing Could be used when in a room, playing.
                @member Photon.Chat.Constants.UserStatus
            */
            Constants.UserStatus = {
                Offline: 0,
                Invisible: 1,
                Online: 2,
                Away: 3,
                Dnd: 4,
                Lfg: 5,
                Playing: 6,
            };
            var userStatusName = (_a = {},
                _a[Constants.UserStatus.Offline] = "Offline",
                _a[Constants.UserStatus.Invisible] = "Invisible",
                _a[Constants.UserStatus.Online] = "Online",
                _a[Constants.UserStatus.Away] = "Away",
                _a[Constants.UserStatus.Dnd] = "Dnd",
                _a[Constants.UserStatus.Lfg] = "Lfg",
                _a[Constants.UserStatus.Playing] = "Playing",
                _a);
            Constants.ChannelProperties = {
                MaxSubscribers: 255,
                PublishSubscribers: 254,
            };
            /**
                @summary Converts {@link Photon.Chat.Constants.UserStatus} element to string name.
                @param {Photon.Chat.Constants.UserStatus} status User status enum element.
                @returns {string} Specified element name or undefined if not found.
                @method Photon.Chat.Constants.UserStatusToName
            */
            function UserStatusToName(status) {
                return userStatusName[status];
            }
            Constants.UserStatusToName = UserStatusToName;
        })(Constants = Chat.Constants || (Chat.Constants = {}));
    })(Chat = Photon.Chat || (Photon.Chat = {}));
})(Photon || (Photon = {}));
/// <reference path="photon-loadbalancing.ts"/>
/// <reference path="photon-chat-constants.ts"/>
/**
    Photon Chat API
    @namespace Photon.Chat
*/
var Photon;
(function (Photon) {
    var Chat;
    (function (Chat) {
        var _a;
        var WebFlags = {
            HttpForward: 0x01,
            SendAuthCookie: 0x02,
            SendSync: 0x04,
            SendState: 0x08,
        };
        /**
            @class Photon.Chat.Message
            @classdesc Encapsulates chat message data.
        */
        var Message = /** @class */ (function () {
            function Message(sender, content) {
                this.sender = sender;
                this.content = content;
            }
            /**
                @summary Returns message sender.
                @return {string} Message sender.
                @method Photon.Chat.Message#getSender
            */
            Message.prototype.getSender = function () {
                return this.sender;
            };
            /**
                @summary Returns message content.
                @return {any} Message content.
                @method Photon.Chat.Message#getContent
            */
            Message.prototype.getContent = function () {
                return this.content;
            };
            return Message;
        }());
        Chat.Message = Message;
        /**
            @class Photon.Chat.Channel
            @classdesc Represents chat channel.
        */
        var Channel = /** @class */ (function () {
            function Channel(name, isPrivat) {
                this.name = name;
                this.isPrivat = isPrivat;
                this.messages = [];
                this.lastId = 0;
                this.properties = {};
                this.publishSubscribers = false;
                this.maxSubscribers = 0;
                this.subscribers = {};
            }
            /**
                @summary Returns channel name (counterpart user id for private channel).
                @return {string} Channel name.
                @method Photon.Chat.Channel#getName
            */
            Channel.prototype.getName = function () {
                return this.name;
            };
            /**
                @summary Returns true if channel is private.
                @return {boolean} Channel private status.
                @method Photon.Chat.Channel#isPrivate
            */
            Channel.prototype.isPrivate = function () {
                return this.isPrivat;
            };
            /**
                @summary Returns messages cache.
                @return {Photon.Chat.Message[]} Array of messages.
                @method Photon.Chat.Channel#getMessages
            */
            Channel.prototype.getMessages = function () {
                return this.messages;
            };
            /**
                @summary Returns ID of the last message received.
                @return {number} Last message ID.
                @method Photon.Chat.Channel#getLastId
            */
            Channel.prototype.getLastId = function () {
                return this.lastId;
            };
            /**
                @summary Clears messages cache.
                @method Photon.Chat.Channel#clearMessages
            */
            Channel.prototype.clearMessages = function () {
                this.messages.splice(0);
            };
            // internal
            Channel.prototype.addMessages = function (senders, messages) {
                var newMessages = [];
                for (var i = 0; i < senders.length; i++) {
                    if (i < messages.length) {
                        var m = new Message(senders[i], messages[i]);
                        this.messages.push(m);
                        newMessages.push(m);
                    }
                }
                return newMessages;
            };
            Channel.prototype.readProperties = function (props) {
                if (props) {
                    for (var p in props) {
                        if (props[p] == null)
                            this.properties[p] = undefined;
                        else
                            this.properties[p] = props[p];
                    }
                    var x = props[Chat.Constants.ChannelProperties.PublishSubscribers];
                    if (x != undefined) {
                        this.publishSubscribers = x;
                    }
                    x = props[Chat.Constants.ChannelProperties.MaxSubscribers];
                    if (x != undefined) {
                        this.maxSubscribers = x;
                    }
                }
            };
            // returns false in case max subscribers exceeded
            Channel.prototype.addSubscriber = function (user) {
                if (this.subscribers[user]) // ignore if already added
                    return false;
                if (Object.keys(this.subscribers).length > this.maxSubscribers) {
                    return false;
                }
                else {
                    this.subscribers[user] = true;
                    return true;
                }
            };
            // returns false in case max subscribers exceeded
            Channel.prototype.removeSubscriber = function (user) {
                if (!this.subscribers[user]) // ignore if not exisst
                    return false;
                delete this.subscribers[user];
                return true;
            };
            Channel.prototype.reset = function () {
                this.subscribers = {};
                this.properties = {};
            };
            return Channel;
        }());
        Chat.Channel = Channel;
        var ChatClient = /** @class */ (function (_super) {
            __extends(ChatClient, _super);
            /**
                @classdesc Implements the Photon Chat API workflow.<br/>
                This class should be extended to handle system or custom events and operation responses.<br/>
    
                @borrows Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication
    //            @borrows Photon.LoadBalancing.LoadBalancingClient#connectToNameServer // overrides with connectToNameServer with different parameters
                @borrows Photon.LoadBalancing.LoadBalancingClient#getRegions
                @borrows Photon.LoadBalancing.LoadBalancingClient#onGetRegionsResult
                @borrows Photon.LoadBalancing.LoadBalancingClient#isConnectedToNameServer
                @borrows Photon.LoadBalancing.LoadBalancingClient#disconnect
                @borrows Photon.LoadBalancing.LoadBalancingClient#setLogLevel
    
                @constructor Photon.Chat.ChatClient
                @param {Photon.ConnectionProtocol} protocol Connecton protocol.
                @param {string} appId Cloud application ID.
                @param {string} appVersion Cloud application version.
            */
            function ChatClient(protocol, appId, appVersion) {
                var _this = _super.call(this, protocol, appId, appVersion) || this;
                _this.DefaultMaxSubscribers = 100;
                _this.publicChannels = {};
                _this.privateChannels = {};
                _this.subscribeRequests = [];
                _this.unsubscribeRequests = [];
                _this.autoJoinLobby = false;
                return _this;
            }
            /**
                @summary Called on client state change. Override to handle it.
                @method Photon.Chat.ChatClient#onStateChange
                @param {Photon.Chat.ChatClient.ChatState} state New client state.
            */
            ChatClient.prototype.onStateChange = function (state) { };
            /**
                @summary Called if client error occures. Override to handle it.
                @method Chat.ChatClient#onError
                @param {Chat.ChatClient.ChatPeerErrorCode} errorCode Client error code.
                @param {string} errorMsg Error message.
            */
            ChatClient.prototype.onError = function (errorCode, errorMsg) { };
            /**
                @summary Called when {@link Photon.Chat.ChatClient#subscribe subscribe} request completed.<br/ >
                Override to handle request results.
                @param {object} results Object with channel names as keys and boolean results as values.
                @method Photon.Chat.ChatClient#onSubscribeResult
            */
            ChatClient.prototype.onSubscribeResult = function (results) { };
            /**
                @summary Called when {@link Photon.Chat.ChatClient#unsubscribe unsubscribe} request completed.<br/ >
                Override to handle request results.
                @param {object} results Object with channel names as keys and boolean results as values.
                @method Photon.Chat.ChatClient#onUnsubscribeResult
            */
            ChatClient.prototype.onUnsubscribeResult = function (results) { };
            /**
                @summary Called when new chat messages received.<br/ >
                Override to handle messages receive event.
                @param {string} channelName Chat channel name.
                @param {Photon.Chat.Message[]} messages Array of received messages.
                @method Photon.Chat.ChatClient#onChatMessages
            */
            ChatClient.prototype.onChatMessages = function (channelName, messages) { };
            /**
                @summary Called when new private message received.<br/ >
                Override to handle message receive event.
                @param {string} channelName Private channel name(counterpart user id).
                @param {Photon.Chat.Message} message Received message.
                @method Photon.Chat.ChatClient#onPrivateMessage
            */
            ChatClient.prototype.onPrivateMessage = function (channelName, message) { };
            /**
                @summary Called when user from friend list changes state.<br/ >
                Override to handle change state event.
                @param {string} userId User id.
                @param {number} status New User status. Predefined {@link Photon.chat.Constants.UserStatus Constants.UserStatus} or custom.
                @param {boolean} gotMessage True if status message updated.
                @param {string} statusMessage Optional status message (may be null even if gotMessage = true).
                @method Photon.Chat.ChatClient#onUserStatusUpdate
            */
            ChatClient.prototype.onUserStatusUpdate = function (userId, status, gotMessage, statusMessage) { };
            /**
                @summary A user has subscribed to a public chat channel
                @param {string} channelName Chat channel name.
                @param {string} userId User id.
                @method Photon.Chat.ChatClient#onUserSubscribe
            */
            ChatClient.prototype.onUserSubscribe = function (channelName, userId) { };
            /**
                @summary A user has unsubscribed from a public chat channel
                @param {string} channelName Chat channel name.
                @param {string} userId User id.
                @method Photon.Chat.ChatClient#onUserUnsubscribe
            */
            ChatClient.prototype.onUserUnsubscribe = function (channelName, userId) { };
            /**
                @summary Starts connection to NameServer.
                @method Photon.Chat.ChatClient#connectToNameServer
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {string} [options.region] If specified, Connect to region master after succesfull connection to name server
                @returns {boolean} True if current client state allows connection.
            */
            ChatClient.prototype.connectToNameServer = function (options) {
                return _super.prototype.connectToNameServer.call(this, options);
            };
            /**
                @summary Connects to a specific region's Master server, using the NameServer to find the IP.
                Override {@link Photon.Chat.ChatClient#onWebRpcResult onWebRpcResult} to handle request results.<br/>
                @method Photon.Chat.ChatClient#connectToRegionFrontEnd
                @param {string} region Region connect to Master server of.
                @returns {boolean} True if current client state allows connection.
            **/
            ChatClient.prototype.connectToRegionFrontEnd = function (region) {
                return this.connectToRegionMaster(region);
            };
            /**
                @summary Returns true if client connected to Front End.When connected, client can send messages, subscribe to channels and so on.
                @return {boolean} True if connected.
                @method Photon.Chat.ChatClient#isConnectedToFrontEnd
            */
            ChatClient.prototype.isConnectedToFrontEnd = function () {
                return this.state() == ChatClient.ChatState.ConnectedToFrontEnd;
            };
            /**
                @summary Sends operation to subscribe to a list of channels by name.<br/>
                Override {@link Photon.Chat.ChatClient#onSubscribeResult onSubscribeResult} to handle request results.
                @param {string[]} channelNames Array of channel names to subscribe to.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {number} [options.historyLength] Controls messages history sent on subscription. Not specified or 0: no history. 1 and higher: number of messages in history. -1: all history.
                @property {number[]} [options.lastIds] Array of IDs of last messages received per channel. Useful when resubscribing to receive only messages we missed.
                @param {object} [createOptions] Room options for creation
                @property {object} createOptions Room options for creation
                @property {boolean} [createOptions.publishSubscribers=false] Whether or not the channel to be created will allow client to keep a list of users.
                @property {number} [createOptions.maxSubscribers=0] Limit of the number of users subscribed to the channel to be created.
                @return {boolean} True if operation sent.
                @method Photon.Chat.ChatClient#subscribe
            */
            ChatClient.prototype.subscribe = function (channelNames, options) {
                // backward compatibility
                if (typeof (options) == "number") {
                    options = { historyLength: options };
                }
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    this.logger.debug("Subscribe channels:", channelNames);
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Channels, Photon.TypeExt.String(channelNames));
                    if (options) {
                        if (options.historyLength) {
                            params.push(Chat.Constants.ParameterCode.HistoryLength, Photon.TypeExt.Int(options.historyLength));
                        }
                        if (options.lastIds) {
                            params.push(Chat.Constants.ParameterCode.MsgIds, Photon.TypeExt.Int(options.lastIds));
                            if (options.historyLength === undefined) {
                                params.push(Chat.Constants.ParameterCode.HistoryLength, Photon.TypeExt.Int(-1));
                            }
                        }
                        if (options.createOptions) {
                            if (options.createOptions.publishSubscribers) {
                                if (options.createOptions.maxSubscribers > this.DefaultMaxSubscribers) {
                                    this.logger.error("Cannot set MaxSubscribers > " + this.DefaultMaxSubscribers + " when PublishSubscribers == true.");
                                    return false;
                                }
                                var props = Photon.TypeExt.DictTypedKeys(Photon.TypeExtType.Object, Photon.TypeExtType.Object);
                                Photon.TypeExt.PutTypedKey(props, Photon.TypeExt.Byte(Chat.Constants.ChannelProperties.PublishSubscribers), true);
                                Photon.TypeExt.PutTypedKey(props, Photon.TypeExt.Byte(Chat.Constants.ChannelProperties.MaxSubscribers), Photon.TypeExt.Int(options.createOptions.maxSubscribers));
                                params.push(Chat.Constants.ParameterCode.Properties, props);
                            }
                        }
                    }
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.Subscribe, params);
                    return true;
                }
                else {
                    this.logger.error("subscribe request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Sends operation to unsubscribe from a list of channels by name.<br/ >
                Override {@link Photon.Chat.ChatClient#onUnsubscribeResult onUnsubscribeResult} to handle request results.
                @param {string[]} channelNames Array of channel names to unsubscribe from.
                @return {boolean} True if operation sent.
                @method Photon.Chat.ChatClient#unsubscribe
            */
            ChatClient.prototype.unsubscribe = function (channelNames) {
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    this.logger.debug("Unsubscribe channels:", channelNames);
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Channels, Photon.TypeExt.String(channelNames));
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.Unsubscribe, params);
                    return true;
                }
                else {
                    this.logger.error("unsubscribe request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Sends a message to a public channel.<br/>
                Channel should be subscribed before publishing to it.
                Everyone in that channel will get the message.
                @param {string} channelName Channel name to send message to.
                @param {any} content Text string or arbitrary data to send.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.webForward] Optionally, private messages can be forwarded as webhooks. Configure webhooks for your Chat app to use this.
                @return {boolean} True if message sent.
                @method Photon.Chat.ChatClient#publishMessage
            */
            ChatClient.prototype.publishMessage = function (channelName, content, options) {
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Channel, channelName);
                    params.push(Chat.Constants.ParameterCode.Message, content);
                    if (options) {
                        if (options.webForward) {
                            params.push(Chat.Constants.ParameterCode.WebFlags);
                            params.push(Photon.TypeExt.Byte(WebFlags.HttpForward));
                        }
                    }
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.Publish, params);
                    return true;
                }
                else {
                    this.logger.error("publishMessage request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Sends a private message to a single target user.<br/>
                @param {string} userId User id to send this message to.
                @param {any} content Text string or arbitrary data to send.
                @param {object} [options] Additional options
                @property {object} options Additional options
                @property {boolean} [options.webForward] Optionally, private messages can be forwarded as webhooks. Configure webhooks for your Chat app to use this.
                @return {boolean} True if message sent.
                @method Photon.Chat.ChatClient#sendPrivateMessage
            */
            ChatClient.prototype.sendPrivateMessage = function (userId, content, options) {
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.UserId, userId);
                    params.push(Chat.Constants.ParameterCode.Message, content);
                    if (options) {
                        if (options.webForward) {
                            params.push(Chat.Constants.ParameterCode.WebFlags);
                            params.push(Photon.TypeExt.Byte(WebFlags.HttpForward));
                        }
                    }
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.SendPrivate, params);
                    return true;
                }
                else {
                    this.logger.error("sendPrivateMessage request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Sets the user's status (pre-defined or custom) and an optional message.<br/>
                The predefined status values can be found in {@link Photon.Chat.Constants.UserStatus Constants.UserStatus}.<br/>
                State UserStatus.Invisible will make you offline for everyone and send no message.
                @param {number} status User status to set.
                @param {string} [message=null] State message.
                @param {boolean} [skipMessage=false] If true { client does not send state message.
                @return {boolean} True if command sent.
                @method Photon.Chat.ChatClient#setUserStatus
            */
            ChatClient.prototype.setUserStatus = function (status, statusMessage, skipMessage) {
                if (statusMessage === void 0) { statusMessage = null; }
                if (skipMessage === void 0) { skipMessage = false; }
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Status, Photon.TypeExt.Int(status));
                    if (skipMessage)
                        params.push(Chat.Constants.ParameterCode.SkipMessage, true);
                    else
                        params.push(Chat.Constants.ParameterCode.Message, statusMessage);
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.UpdateStatus, params);
                    return true;
                }
                else {
                    this.logger.error("setUserStatus request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Adds users to the list on the Chat Server which will send you status updates for those.
                @tparam string[] userIds Array of user ids.
                @return {boolean} True if command sent.
            */
            ChatClient.prototype.addFriends = function (userIds) {
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Friends, Photon.TypeExt.String(userIds));
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.AddFriendds, params);
                    return true;
                }
                else {
                    this.logger.error("addFriends request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Removes users from the list on the Chat Server which will send you status updates for those.
                @tparam string[] friends Array of user ids.
                @return {boolean} True if command sent.
            */
            ChatClient.prototype.removeFriends = function (userIds) {
                if (this.masterPeer && this.isConnectedToFrontEnd()) {
                    var params = [];
                    params.push(Chat.Constants.ParameterCode.Friends, Photon.TypeExt.String(userIds));
                    this.masterPeer.sendOperation(Chat.Constants.OperationCode.RemoveFriends, params);
                    return true;
                }
                else {
                    this.logger.error("removeFriends request error:", "Not connected to Front End");
                    return false;
                }
            };
            /**
                @summary Returns list of public channels client subscribed to.
                @return Channel[] Array of public channels.
            */
            ChatClient.prototype.getPublicChannels = function () {
                return this.publicChannels;
            };
            /**
                @summary Returns list of channels representing current private conversation.
                @return Channel[] Array of private channels.
            */
            ChatClient.prototype.getPrivateChannels = function () {
                return this.privateChannels;
            };
            // private
            ChatClient.prototype.getOrAddChannel = function (channels, name, isPrivate) {
                if (channels[name] == undefined) {
                    channels[name] = new Channel(name, isPrivate);
                }
                return channels[name];
            };
            // internal
            ChatClient.prototype.initMasterPeer = function (mp) {
                var _this = this;
                _super.prototype.initMasterPeer.call(this, mp);
                // onOperationResponse called if no listener exists
                //mp.addResponseListener(Constants.OperationCode.Publish, (data: any) => {
                //    mp._logger.debug("resp Publish", data.errCode, data.errMsg);
                //});
                //mp.addResponseListener(Constants.OperationCode.SendPrivate, (data: any) => {
                //    mp._logger.debug("resp SendPrivate", data.errCode, data.errMsg);
                //});
                //mp.addResponseListener(Constants.OperationCode.UpdateStatus, (data: any) => {
                //    mp._logger.debug("resp UpdateStatus", data.errCode, data.errMsg);
                //});
                //mp.addResponseListener(Constants.OperationCode.FriendList, (data: any) => {
                //    mp._logger.debug("resp FriendList", data.errCode, data.errMsg);
                //});
                mp.addEventListener(Chat.Constants.EventCode.ChatMessages, function (data) {
                    var senders = data.vals[Chat.Constants.ParameterCode.Senders];
                    var messages = data.vals[Chat.Constants.ParameterCode.Messages];
                    var channelName = data.vals[Chat.Constants.ParameterCode.Channel];
                    var ch = _this.publicChannels[channelName];
                    if (ch) {
                        var newMessages = ch.addMessages(senders, messages);
                        ch.lastId = data.vals[Chat.Constants.ParameterCode.MsgId];
                        _this.onChatMessages(channelName, newMessages);
                    }
                    else {
                        mp._logger.warn("ev ChatMessages: Got message from unsubscribed channel ", channelName);
                    }
                });
                mp.addEventListener(Chat.Constants.EventCode.PrivateMessage, function (data) {
                    var sender = data.vals[Chat.Constants.ParameterCode.Sender];
                    var message = data.vals[Chat.Constants.ParameterCode.Message];
                    var userId = data.vals[Chat.Constants.ParameterCode.UserId];
                    var channelName = "";
                    if (_this.getUserId() == sender)
                        channelName = userId;
                    else
                        channelName = sender;
                    var ch = _this.getOrAddChannel(_this.privateChannels, channelName, true);
                    ch.lastId = data.vals[Chat.Constants.ParameterCode.MsgId];
                    _this.onPrivateMessage(channelName, new Message(sender, message));
                });
                mp.addEventListener(Chat.Constants.EventCode.StatusUpdate, function (data) {
                    var sender = data.vals[Chat.Constants.ParameterCode.Sender];
                    var status = data.vals[Chat.Constants.ParameterCode.Status];
                    var message = data.vals[Chat.Constants.ParameterCode.Message];
                    var gotMessage = message !== undefined;
                    _this.onUserStatusUpdate(sender, status, gotMessage, message);
                });
                mp.addEventListener(Chat.Constants.EventCode.Subscribe, function (data) {
                    mp._logger.debug("ev Subscribe", data);
                    var res = {};
                    var channels = data.vals[Chat.Constants.ParameterCode.Channels] || [];
                    var results = data.vals[Chat.Constants.ParameterCode.SubscribeResults] || [];
                    var readProps = false;
                    var channelProperties = data.vals[Chat.Constants.ParameterCode.Properties];
                    var subscribers = data.vals[Chat.Constants.ParameterCode.ChannelSubscribers];
                    if (channelProperties != undefined) {
                        if (channels.length == 1) {
                            readProps = true;
                        }
                        else {
                            _this.logger.error("Subscribe event for multiple channels with channels properties returned. Ignoring properties.");
                        }
                    }
                    for (var i = 0; i < channels.length; i++) {
                        var channelName = channels[i];
                        res[channelName] = false;
                        if (i < results.length && results[i]) {
                            var ch = _this.getOrAddChannel(_this.publicChannels, channelName, false);
                            ch.reset();
                            res[channelName] = true;
                            if (readProps) {
                                ch.readProperties(channelProperties);
                                if (subscribers) {
                                    for (var i = 0; i < subscribers.length; i++) {
                                        if (!ch.addSubscriber(subscribers[i])) {
                                            mp._logger.error("Subscribe: channel '" + channelName + "' max subscribers exceeded");
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    _this.onSubscribeResult(res);
                });
                mp.addEventListener(Chat.Constants.EventCode.Unsubscribe, function (data) {
                    mp._logger.debug("ev Unsubscribe", data);
                    var res = {};
                    var channels = data.vals[Chat.Constants.ParameterCode.Channels] || [];
                    for (var i = 0; i < channels.length; i++) {
                        var ch = channels[i];
                        delete (_this.publicChannels[ch]);
                        res[ch] = true;
                    }
                    _this.onUnsubscribeResult(res);
                });
                mp.addEventListener(Chat.Constants.EventCode.UserSubscribe, function (data) {
                    mp._logger.debug("ev UserSubscribe", data);
                    var res = {};
                    var channelName = data.vals[Chat.Constants.ParameterCode.Channel];
                    var userId = data.vals[Chat.Constants.ParameterCode.UserId];
                    var ch = _this.publicChannels[channelName];
                    if (ch == undefined) {
                        mp._logger.error("UserSubscribe: channel '" + channelName + "' not found");
                    }
                    else {
                        if (!ch.addSubscriber(userId)) {
                            mp._logger.error("UserSubscribe: channel '" + channelName + "' max subscribers exceeded");
                        }
                    }
                    _this.onUserSubscribe(channelName, userId);
                });
                mp.addEventListener(Chat.Constants.EventCode.UserUnsubscribe, function (data) {
                    mp._logger.debug("ev UserUnsubscribe", data);
                    var res = {};
                    var channelName = data.vals[Chat.Constants.ParameterCode.Channel];
                    var userId = data.vals[Chat.Constants.ParameterCode.UserId];
                    var ch = _this.publicChannels[channelName];
                    if (ch == undefined) {
                        mp._logger.debug("UserUnsubscribe: channel '" + channelName + "' not found");
                    }
                    else {
                        if (!ch.removeSubscriber(userId)) {
                            mp._logger.debug("UserUnsubscribe: subscriber '" + userId + "' not found in channel '" + channelName + "'");
                        }
                    }
                    _this.onUserUnsubscribe(channelName, userId);
                });
            };
            /**
                @summary Converts {@link Photon.Chat.ChatClient.ChatState ChatState} element to string name.
                @method Photon.Chat.ChatClient.StateToName
                @param {Photon.Chat.ChatClient.ChatState} state Client state.
                @returns {string} Specified element name or undefined if not found.
            */
            ChatClient.StateToName = function (value) {
                var x = ChatClient.chatStateName[value];
                if (x === undefined) {
                    // Super class states support - useless since all states overridden but may help somehow when debugging
                    return _super.StateToName.call(this, value);
                }
                else {
                    return x;
                }
            };
            ChatClient.ChatPeerErrorCode = {
                /**
                    @summary Enum for client peers error codes.
                    @member Photon.Chat.ChatClient.ChatPeerErrorCode
                    @readonly
                    @property {number} Ok No Error.
                    @property {number} FrontEndError General FrontEnd server peer error.
                    @property {number} FrontEndConnectFailed FrontEnd server connection error.
                    @property {number} FrontEndConnectClosed Disconnected from FrontEnd server.
                    @property {number} FrontEndTimeout Disconnected from FrontEnd server for timeout.
                    @property {number} FrontEndEncryptionEstablishError FrontEnd server encryption establishing failed.
                    @property {number} FrontEndAuthenticationFailed FrontEnd server authentication failed.
                    @property {number} NameServerError General NameServer peer error.
                    @property {number} NameServerConnectFailed NameServer connection error.
                    @property {number} NameServerConnectClosed Disconnected from NameServer.
                    @property {number} NameServerTimeout Disconnected from NameServer for timeout.
                    @property {number} NameServerEncryptionEstablishError NameServer encryption establishing failed.
                    @property {number} NameServerAuthenticationFailed NameServer authentication failed.
                 */
                Ok: 0,
                FrontEndError: 1001,
                FrontEndConnectFailed: 1002,
                FrontEndConnectClosed: 1003,
                FrontEndTimeout: 1004,
                FrontEndEncryptionEstablishError: 1005,
                FrontEndAuthenticationFailed: 1101,
                NameServerError: 3001,
                NameServerConnectFailed: 3002,
                NameServerConnectClosed: 3003,
                NameServerTimeout: 3004,
                NameServerEncryptionEstablishError: 300,
                NameServerAuthenticationFailed: 3101,
            };
            ChatClient.ChatState = {
                /**
                    @summary Enum for client states.
                    @member Photon.Chat.ChatClient.ChatState
                    @readonly
                    @property {number} Error Critical error occurred.
                    @property {number} Uninitialized Client is created but not used yet.
                    @property {number} ConnectingToNameServer Connecting to NameServer.
                    @property {number} ConnectedToNameServer Connected to NameServer.
                    @property {number} ConnectingToFrontEnd Connecting to FrontEnd server.
                    @property {number} ConnectedToFrontEnd Connected to FrontEnd server.
                    @property {number} Disconnected The client is no longer connected (to any server).
                */
                Error: -1,
                Uninitialized: 0,
                ConnectingToNameServer: 1,
                ConnectedToNameServer: 2,
                ConnectingToFrontEnd: 3,
                ConnectedToFrontEnd: 4,
                Disconnected: 10,
            };
            ChatClient.chatStateName = (_a = {},
                _a[ChatClient.ChatState.Error] = "Error",
                _a[ChatClient.ChatState.Uninitialized] = "Uninitialized",
                _a[ChatClient.ChatState.ConnectingToNameServer] = "ConnectingToNameServer",
                _a[ChatClient.ChatState.ConnectedToNameServer] = "ConnectedToNameServer",
                _a[ChatClient.ChatState.ConnectingToFrontEnd] = "ConnectingToFrontEnd",
                _a[ChatClient.ChatState.ConnectedToFrontEnd] = "ConnectedToFrontEnd",
                _a[ChatClient.ChatState.Disconnected] = "Disconnected",
                _a);
            return ChatClient;
        }(Photon.LoadBalancing.LoadBalancingClient));
        Chat.ChatClient = ChatClient;
    })(Chat = Photon.Chat || (Photon.Chat = {}));
})(Photon || (Photon = {}));
var Photon;
(function (Photon) {
    /**
    @summary True if Photon library is built with Emscripten.
    @member Photon.IsEmscriptenBuild
    */
    Photon.IsEmscriptenBuild = Photon["IsEmscriptenBuildInternal"];
    /**
    @summary Photon library version.
    @member Photon.Version
    */
    Photon.Version = "4.4.0.0"; // @PHOTON-VERSION@
})(Photon || (Photon = {}));
