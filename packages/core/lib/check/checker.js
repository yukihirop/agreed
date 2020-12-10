"use strict";

const isInclude = require("./isInclude");
const url = require("url");
const logger = require("../utils/logger");
const { hasTemplate } = require("../template/hasTemplate");
const tmplBind = require("../template/bind");

const nullishStrings = ["undefined", "null", ""];

class Checker {
  static validRequest(result, request, req, debug) {
    if (!result || !result.error) {
      return true;
    }

    if (debug) {
      logger.log(result.error);
      logger.log("agreed request", request);
      logger.log("actual request", req);
    }

    return false;
  }

  static request(request, req, options) {
    const parsedUrl = url.parse(req.url);
    let similarity = 0;
    // method
    let result = Checker.method(request.method, req.method);
    similarity = result.similarity;
    if (
      !Checker.validRequest(result, request, req, options.debug) ||
      similarity == 0
    ) {
      return { result: false, similarity: 0, error: result.error };
    }
    // url
    result = Checker.url(request.pathToRegexp, parsedUrl.pathname, options);
    similarity = result.similarity;
    if (
      !Checker.validRequest(result, request, req, options.debug) ||
      similarity == 0
    ) {
      return { result: false, similarity: 0, error: result.error };
    }
    // headers
    result = Checker.headers(request.headers, req.headers, options);
    similarity = result.similarity;
    if (
      !Checker.validRequest(result, request, req, options.debug) ||
      similarity == 0
    ) {
      return { result: false, similarity: 0, error: result.error };
    }
    // query
    result = Checker.query(request.query, req.query, options);
    similarity = result.similarity;
    if (
      !Checker.validRequest(result, request, req, options.debug) ||
      similarity == 0
    ) {
      return { result: false, similarity: 0, error: result.error };
    }
    // body
    result = Checker.body(request.body, req.body, options);
    similarity = result.similarity;
    if (
      !Checker.validRequest(result, request, req, options.debug) ||
      similarity == 0
    ) {
      return { result: false, similarity: 0, error: result.error };
    }
    return { result: true, similarity };
  }

  static method(entryMethod, reqMethod) {
    const result = { similarity: 1 };
    if (entryMethod.toLowerCase() !== reqMethod.toLowerCase()) {
      result.type = "METHOD";
      result.error = `Does not match METHOD, expect ${entryMethod}, but ${reqMethod}.`;
      result.similarity = 0;
    }
    return result;
  }

  static url(entryUrl, reqUrl, options) {
    const result = { similarity: 1 };
    const match = entryUrl.exec(reqUrl);
    const { pathToRegexpKeys, values = {} } = options;
    if (!match) {
      result.type = "URL";
      result.error = `Does not match URL, expect ${entryUrl}, but ${reqUrl}.`;
      result.similarity = 0;
      return result;
    }
    const paths = {};
    pathToRegexpKeys.forEach((pathKey, index) => {
      paths[pathKey.name] = match[index + 1];
    });

    let valuesSimilarity = 1;
    if (pathToRegexpKeys.length !== 0) {
      let matched = 0;
      Object.keys(paths).forEach((k) => {
        if (paths[k] === values[k] + "") {
          matched++;
        }
      });
      valuesSimilarity = matched / pathToRegexpKeys.length;
    }

    const nullish = Checker.checkNullish(paths);
    const nullishError = nullish.error;
    const nullishSimilarity = nullish.similarity;
    result.type = "URL";
    result.error = nullishError;
    result.similarity = nullishSimilarity;

    if (result.similarity >= 1) {
      result.similarity += valuesSimilarity;
    }

    return result;
  }

  static headers(entryHeaders, reqHeaders, options) {
    const result = { similarity: 1 };
    if (!entryHeaders) return result;
    if (!isInclude(entryHeaders, reqHeaders)) {
      result.type = "HEADERS";
      result.error = `Does not include header, expect ${JSON.stringify(
        entryHeaders
      )} but ${JSON.stringify(reqHeaders)}`;
      result.similarity = 0;
      return result;
    }

    const nullish = Checker.checkNullish(reqHeaders);
    const nullishError = nullish.error;
    const nullishSimilarity = nullish.similarity;
    if (nullish) {
      result.type = "HEADERS";
      result.error = nullishError;
      result.similarity = nullishSimilarity;
      return result;
    }
    return result;
  }

  static body(entryBody, reqBody, options) {
    const result = { similarity: 1 };
    if (!entryBody) return result;
    if (!isInclude(entryBody, reqBody)) {
      result.type = "BODY";
      result.error = `Does not include body, expect ${JSON.stringify(
        entryBody
      )} but ${JSON.stringify(reqBody)}`;
      result.similarity = 0;
    }
    return result;
  }

  static query(entryQuery, reqQuery, options) {
    const result = { similarity: 1 };
    if (!entryQuery) return result;
    if (!isInclude(entryQuery, reqQuery)) {
      result.type = "QUERY";
      result.error = `Does not include query, expect ${JSON.stringify(
        entryQuery
      )} but ${JSON.stringify(reqQuery)}`;
      result.similarity = 0;
    }

    const existEntryQuery = Object.keys(entryQuery).length > 0;
    // e.g.) { q: "{:someQueryStrings }" }
    
    if (!!existEntryQuery) {
      // e.g.) { id: "yosuke", someQueryStrings: "bar" }
      // include path parameters
      const entryParameters = options.values;
      
      // e.g.) reqQuery = { q: "bar" }
      const isMatch = Object.keys(reqQuery).every((key) => {
        if (entryQuery[key] != undefined) {
          const tmpl = hasTemplate(entryQuery[key]);
          const hasTmpl = tmpl !== null && tmpl.length > 0;
          
          // e.g.) {":someQueryStrings"} => someQueryStrings
          // e.g.) {"someQueryStrings"} => someQueryStrings
          const normalizedKey = hasTmpl
            ? entryQuery[key].replace(/\{|\}|\:/g, "")
            : entryQuery[key];
          
          const reqValue = reqQuery[key];
          if (hasTmpl) {
            // e.g.) { "someQueryStrings": "bar" }
            const calcEntryParameters = tmplBind(entryQuery, reqQuery);
            const calcEntryQueryValue = calcEntryParameters[normalizedKey];
            const entryQueryValue = entryParameters[normalizedKey];
            return (
              calcEntryQueryValue == entryQueryValue &&
              reqValue === entryQueryValue
            );
          } else {
            // e.g.) entryQuery = { foo: "foo", bar: "bar" }
            // e.g.) entryParameters = { id: "yosuke" }
            const entryQueryValue = entryQuery[normalizedKey];
            return reqValue === entryQueryValue;
          }
        } else {
          return false;
        }
      });
      result.similarity = isMatch ? 1 : 0;
    }
    return result;
  }

  static checkNullish(obj = {}) {
    const result = { similarity: 1 };
    const keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      const key = keys[i];
      const realValue = obj[key];

      if (typeof realValue === "object" && realValue) {
        return Checker.checkNullish(realValue);
      }

      if (nullishStrings.indexOf(realValue) >= 0) {
        result.error = `Request value has nullish strings ${realValue} in ${key}`;
        result.similarity = 0.5;
        return result;
      }
    }
    return result;
  }
}

module.exports = Checker;
