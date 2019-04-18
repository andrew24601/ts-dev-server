"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }Object.defineProperty(exports, "__esModule", {value: true});var _CJSImportProcessor = require('./CJSImportProcessor'); var _CJSImportProcessor2 = _interopRequireDefault(_CJSImportProcessor);
var _computeSourceMap = require('./computeSourceMap'); var _computeSourceMap2 = _interopRequireDefault(_computeSourceMap);
var _identifyShadowedGlobals = require('./identifyShadowedGlobals'); var _identifyShadowedGlobals2 = _interopRequireDefault(_identifyShadowedGlobals);
var _NameManager = require('./NameManager'); var _NameManager2 = _interopRequireDefault(_NameManager);
var _parser = require('./parser');

var _TokenProcessor = require('./TokenProcessor'); var _TokenProcessor2 = _interopRequireDefault(_TokenProcessor);
var _RootTransformer = require('./transformers/RootTransformer'); var _RootTransformer2 = _interopRequireDefault(_RootTransformer);
var _formatTokens = require('./util/formatTokens'); var _formatTokens2 = _interopRequireDefault(_formatTokens);
var _getTSImportedNames = require('./util/getTSImportedNames'); var _getTSImportedNames2 = _interopRequireDefault(_getTSImportedNames);



























































 function getVersion() {
  // eslint-disable-next-line
  return require("../package.json").version;
} exports.getVersion = getVersion;

 function transform(code, options) {
  try {
    const sucraseContext = getSucraseContext(code, options);
    const transformer = new (0, _RootTransformer2.default)(
      sucraseContext,
      options.transforms,
      Boolean(options.enableLegacyBabel5ModuleInterop),
      options,
    );
    let result = {code: transformer.transform()};
    if (options.sourceMapOptions) {
      if (!options.filePath) {
        throw new Error("filePath must be specified when generating a source map.");
      }
      result = {
        ...result,
        sourceMap: _computeSourceMap2.default.call(void 0, result.code, options.filePath, options.sourceMapOptions),
      };
    }
    return result;
  } catch (e) {
    if (options.filePath) {
      e.message = `Error transforming ${options.filePath}: ${e.message}`;
    }
    throw e;
  }
} exports.transform = transform;

/**
 * Return a string representation of the sucrase tokens, mostly useful for
 * diagnostic purposes.
 */
 function getFormattedTokens(code, options) {
  const tokens = getSucraseContext(code, options).tokenProcessor.tokens;
  return _formatTokens2.default.call(void 0, code, tokens);
} exports.getFormattedTokens = getFormattedTokens;

/**
 * Call into the parser/tokenizer and do some further preprocessing:
 * - Come up with a set of used names so that we can assign new names.
 * - Preprocess all import/export statements so we know which globals we are interested in.
 * - Compute situations where any of those globals are shadowed.
 *
 * In the future, some of these preprocessing steps can be skipped based on what actual work is
 * being done.
 */
function getSucraseContext(code, options) {
  const isJSXEnabled = options.transforms.includes("jsx");
  const isTypeScriptEnabled = options.transforms.includes("typescript");
  const isFlowEnabled = options.transforms.includes("flow");
  const file = _parser.parse.call(void 0, code, isJSXEnabled, isTypeScriptEnabled, isFlowEnabled);
  const tokens = file.tokens;
  const scopes = file.scopes;

  const tokenProcessor = new (0, _TokenProcessor2.default)(code, tokens, isFlowEnabled);
  const nameManager = new (0, _NameManager2.default)(tokenProcessor);
  nameManager.preprocessNames();
  const enableLegacyTypeScriptModuleInterop = Boolean(options.enableLegacyTypeScriptModuleInterop);

  let importProcessor = null;
  if (options.transforms.includes("imports")) {
    importProcessor = new (0, _CJSImportProcessor2.default)(
      nameManager,
      tokenProcessor,
      enableLegacyTypeScriptModuleInterop,
      options,
      options.transforms.includes("typescript"),
    );
    importProcessor.preprocessTokens();
    // We need to mark shadowed globals after processing imports so we know that the globals are,
    // but before type-only import pruning, since that relies on shadowing information.
    _identifyShadowedGlobals2.default.call(void 0, tokenProcessor, scopes, importProcessor.getGlobalNames());
    if (options.transforms.includes("typescript")) {
      importProcessor.pruneTypeOnlyImports();
    }
  } else if (options.transforms.includes("typescript")) {
    _identifyShadowedGlobals2.default.call(void 0, tokenProcessor, scopes, _getTSImportedNames2.default.call(void 0, tokenProcessor));
  }
  return {tokenProcessor, scopes, nameManager, importProcessor};
}
/*
const fs = require('fs');

const path = 'src/transformers/ESMImportTransformer.ts';
const txform = transform(fs.readFileSync(path, 'utf-8'), {
  transforms:["typescript", "jsx"],
  jsxPragma: "usx",
  filePath: path,
  moduleResolver(name:string) {
    const packageJSON = JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`, 'utf-8'));
    return `node_modules/${name}/${packageJSON.module}`;
  }
});
fs.writeFileSync('transform.js', txform.code);
*/