/* eslint-disable no-console */
/* eslint-disable max-len */
/* eslint-disable object-curly-newline */
import { isJSFunction } from '@alilc/lowcode-types';
import { transformArrayToMap, transformStringToFunction, clone } from './common';
import { jsonp, request, get, post } from './request';
import logger from './logger';
import { DataSource, DataSourceItem, IRendererAppHelper } from '../types';

const DS_STATUS = {
  INIT: 'init',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
};

type DataSourceType = 'fetch' | 'jsonp';

/**
 * do request for standard DataSourceType
 * @param {DataSourceType} type type of DataSourceItem
 * @param {any} options
 */
export function doRequest(type: DataSourceType, options: any) {
  // eslint-disable-next-line prefer-const
  let { uri, url, method = 'GET', headers, params, ...otherProps } = options;
  otherProps = otherProps || {};
  if (type === 'jsonp') {
    return jsonp(uri, params, otherProps);
  }

  if (type === 'fetch') {
    switch (method.toUpperCase()) {
      case 'GET':
        return get(uri, params, headers, otherProps);
      case 'POST':
        return post(uri, params, headers, otherProps);
      default:
        return request(uri, method, params, headers, otherProps);
    }
  }

  logger.log(`Engine default dataSource does not support type:[${type}] dataSource request!`, options);
}

export class DataHelper {
  /**
   * host object that will be "this" object when excuting dataHandler
   *
   * @type {*}
   * @memberof DataHelper
   */
  host: any;

  /**
   * data source config
   *
   * @type {DataSource}
   * @memberof DataHelper
   */
  config: DataSource;

  /**
   * a parser function which will be called to process config data
   * which eventually will call common/utils.processData() to process data
   * (originalConfig) => parsedConfig
   * @type {*}
   * @memberof DataHelper
   */
  parser: any;

  /**
   * config.list
   *
   * @type {any[]}
   * @memberof DataHelper
   */
  ajaxList: any[];

  ajaxMap: any;

  dataSourceMap: any;

  appHelper: IRendererAppHelper;

  constructor(comp: any, config: DataSource, appHelper: IRendererAppHelper, parser: any) {
    this.host = comp;
    this.config = config || {};
    this.parser = parser;
    this.ajaxList = config?.list || [];
    this.ajaxMap = transformArrayToMap(this.ajaxList, 'id');
    this.dataSourceMap = this.generateDataSourceMap();
    this.appHelper = appHelper;
  }

  // 重置config，dataSourceMap状态会被重置；
  // resetConfig(config = {}) {
  //   this.config = config as DataSource;
  //   this.ajaxList = (config as DataSource)?.list || [];
  //   this.ajaxMap = transformArrayToMap(this.ajaxList, 'id');
  //   this.dataSourceMap = this.generateDataSourceMap();
  //   return this.dataSourceMap;
  // }

  // 更新config，只会更新配置，状态保存；
  updateConfig(config = {}) {
    this.config = config as DataSource;
    this.ajaxList = (config as DataSource)?.list || [];
    const ajaxMap: any = transformArrayToMap(this.ajaxList, 'id');
    // 删除已经移除的接口
    Object.keys(this.ajaxMap).forEach((key) => {
      if (!ajaxMap[key]) {
        delete this.dataSourceMap[key];
      }
    });
    this.ajaxMap = ajaxMap;
    // 添加未加入到dataSourceMap中的接口
    this.ajaxList.forEach((item) => {
      if (!this.dataSourceMap[item.id]) {
        this.dataSourceMap[item.id] = {
          status: DS_STATUS.INIT,
          load: (...args: any) => {
            // @ts-ignore
            return this.getDataSource(item.id, ...args);
          },
        };
      }
    });
    return this.dataSourceMap;
  }

  generateDataSourceMap() {
    const res: any = {};
    this.ajaxList.forEach((item) => {
      res[item.id] = {
        status: DS_STATUS.INIT,
        load: (...args: any) => {
          // @ts-ignore
          return this.getDataSource(item.id, ...args);
        },
      };
    });
    return res;
  }

  updateDataSourceMap(id: string, data: any, error: any) {
    this.dataSourceMap[id].error = error || undefined;
    this.dataSourceMap[id].data = data;
    this.dataSourceMap[id].status = error ? DS_STATUS.ERROR : DS_STATUS.LOADED;
  }

  /**
   * get all dataSourceItems which marked as isInit === true
   * @private
   * @returns
   * @memberof DataHelper
   */
  getInitDataSourseConfigs() {
    const initConfigs = this.parser(this.ajaxList).filter((item: DataSourceItem) => {
      // according to [spec](https://lowcode-engine.cn/lowcode), isInit should be boolean true to be working
      if (item.isInit === true) {
        this.dataSourceMap[item.id].status = DS_STATUS.LOADING;
        return true;
      }
      return false;
    });
    return initConfigs;
  }

  /**
   * process all dataSourceItems which marked as isInit === true, and get dataSource request results.
   * @public
   * @returns
   * @memberof DataHelper
   */
  getInitData() {
    const initSyncData = this.getInitDataSourseConfigs();
    // 所有 datasource 的 datahandler
    return this.asyncDataHandler(initSyncData).then((res) => {
      let { dataHandler } = this.config;
      if (isJSFunction(dataHandler)) {
        dataHandler = transformStringToFunction(dataHandler.value);
      }
      if (!dataHandler || typeof dataHandler !== 'function') return res;
      try {
        return (dataHandler as any).call(this.host, res);
      } catch (e) {
        console.error('请求数据处理函数运行出错', e);
      }
    });
  }

  getDataSource(id: string, params: any, otherOptions: any, callback: any) {
    const req = this.parser(this.ajaxMap[id]);
    const options = req.options || {};
    if (typeof otherOptions === 'function') {
      callback = otherOptions;
      otherOptions = {};
    }
    const { headers, ...otherProps } = otherOptions || {};
    if (!req) {
      console.warn(`getDataSource API named ${id} not exist`);
      return;
    }
    return this.asyncDataHandler([
      {
        ...req,
        options: {
          ...options,
          // 支持参数为array的情况，当参数为array时，不做参数合并
          params:
            Array.isArray(options.params) || Array.isArray(params)
              ? params || options.params
              : {
                ...options.params,
                ...params,
              },
          headers: {
            ...options.headers,
            ...headers,
          },
          ...otherProps,
        },
      },
    ])
      .then((res: any) => {
        try {
          callback && callback(res && res[id]);
        } catch (e) {
          console.error('load请求回调函数报错', e);
        }

        return res && res[id];
      })
      .catch((err) => {
        try {
          callback && callback(null, err);
        } catch (e) {
          console.error('load请求回调函数报错', e);
        }

        return err;
      });
  }

  asyncDataHandler(asyncDataList: any[]) {
    return new Promise((resolve, reject) => {
      const allReq: any[] = [];
      asyncDataList.forEach((req) => {
        const { id, type } = req;
        // TODO: need refactoring to remove 'legao' related logic
        if (!id || !type || type === 'legao') {
          return;
        }
        allReq.push(req);
      });

      if (allReq.length === 0) {
        resolve({});
      }
      const res: any = {};

      Promise.all(
        allReq.map((item: any) => {
          return new Promise((innerResolve) => {
            const { id, dataHandler } = item;

            const fetchHandler = (data: any, error: any) => {
              res[id] = this.dataHandler(id, dataHandler, data, error);
              this.updateDataSourceMap(id, res[id], error);
              innerResolve({});
            };

            const doFetch = (type: string, options: any) => {
              doRequest(type as any, options)
                ?.then((data: any) => {
                  if (this.appHelper && this.appHelper.utils && this.appHelper.utils.afterRequest) {
                    this.appHelper.utils.afterRequest(item, data, undefined, (innerData: any, error: any) => {
                      fetchHandler(innerData, error);
                    });
                  } else {
                    fetchHandler(data, undefined);
                  }
                })
                .catch((err: Error) => {
                  if (this.appHelper && this.appHelper.utils && this.appHelper.utils.afterRequest) {
                    // 必须要这么调用，否则beforeRequest中的this会丢失
                    this.appHelper.utils.afterRequest(item, undefined, err, (innerData: any, error: any) => {
                      fetchHandler(innerData, error);
                    });
                  } else {
                    fetchHandler(undefined, err);
                  }
                });
            };

            this.dataSourceMap[id].status = DS_STATUS.LOADING;
            // 请求切片
            if (this.appHelper && this.appHelper.utils && this.appHelper.utils.beforeRequest) {
              // 必须要这么调用，否则beforeRequest中的this会丢失
              this.appHelper.utils.beforeRequest(item, clone(options), (options: any) => doFetch(type, options));
            } else {
              doFetch(type, options);
            }
          });
        }),
      ).then(() => {
        resolve(res);
      }).catch((e) => {
        reject(e);
      });
    });
  }

  // dataHandler todo:
  dataHandler(id: string, dataHandler: any, data: any, error: any) {
    let dataHandlerFun = dataHandler;
    if (isJSFunction(dataHandler)) {
      dataHandlerFun = transformStringToFunction(dataHandler.value);
    }
    if (!dataHandlerFun || typeof dataHandlerFun !== 'function') {
      return data;
    }
    try {
      return dataHandler.call(this.host, data, error);
    } catch (e) {
      console.error(`[${id}]单个请求数据处理函数运行出错`, e);
    }
  }
}
