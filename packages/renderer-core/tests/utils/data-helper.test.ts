// @ts-nocheck
const mockJsonp = jest.fn();
const mockRequest = jest.fn();
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../../src/utils/request', () => {
    return {
      jsonp: () => { mockJsonp();},
      request: () => { mockRequest();},
      get: () => { mockGet();},
      post: () => { mockPost();},
    }
  });

import { DataHelper, doRequest } from '../../src/utils/data-helper';
import { parseData } from '../../src/utils/common';

describe('test DataHelper ', () => {
  beforeEach(() => {
    jest.resetModules();
  })
  it('can be inited', () => {
    const mockHost = {};
    let mockDataSourceConfig = {};
    const mockAppHelper = {};
    const mockParser = (config: any) => parseData(config);
    let dataHelper = new DataHelper(mockHost, mockDataSourceConfig, mockAppHelper, mockParser);

    expect(dataHelper).toBeTruthy();
    expect(dataHelper.host).toBe(mockHost);
    expect(dataHelper.config).toBe(mockDataSourceConfig);
    expect(dataHelper.appHelper).toBe(mockAppHelper);
    expect(dataHelper.parser).toBe(mockParser);


    dataHelper = new DataHelper(mockHost, undefined, mockAppHelper, mockParser);
    expect(dataHelper.config).toStrictEqual({});
    expect(dataHelper.ajaxList).toStrictEqual([]);

    mockDataSourceConfig = { 
      list: [ 
        {
          id: 'ds1',
        }, {
          id: 'ds2',
        },
      ]
    };
    dataHelper = new DataHelper(mockHost, mockDataSourceConfig, mockAppHelper, mockParser);
    expect(dataHelper.config).toBe(mockDataSourceConfig);
    expect(dataHelper.ajaxList.length).toBe(2);
    expect(dataHelper.ajaxMap.ds1).toStrictEqual({
      id: 'ds1',
    });
  });
  it('should handle generateDataSourceMap properly in constructor', () => {
    const mockHost = {};
    let mockDataSourceConfig = {};
    const mockAppHelper = {};
    const mockParser = (config: any) => parseData(config);
    let dataHelper = new DataHelper(mockHost, mockDataSourceConfig, mockAppHelper, mockParser);

    // test generateDataSourceMap logic
    mockDataSourceConfig = { 
      list: [ 
        {
          id: 'getInfo',
          isInit: true,
          type: 'fetch',  // fetch/mtop/jsonp/custom
          options: {
            uri: 'mock/info.json',
            method: 'GET',
            params: { a: 1 },
            timeout: 5000,
          },
        }, {
          id: 'postInfo',
          isInit: true,
          type: 'fetch',
          options: {
            uri: 'mock/info.json',
            method: 'POST',
            params: { a: 1 },
            timeout: 5000,
          },
        },
      ]
    };
    dataHelper = new DataHelper(mockHost, mockDataSourceConfig, mockAppHelper, mockParser);
    expect(Object.keys(dataHelper.dataSourceMap).length).toBe(2);
    expect(dataHelper.dataSourceMap.getInfo.status).toBe('init');
    expect(typeof dataHelper.dataSourceMap.getInfo.load).toBe('function');
  });

  it('getInitDataSourseConfigs should work', () => {
    const mockHost = {};
    let mockDataSourceConfig = {};
    const mockAppHelper = {};
    const mockParser = (config: any) => parseData(config);

    // test generateDataSourceMap logic
    mockDataSourceConfig = { 
      list: [ 
        {
          id: 'getInfo',
          isInit: true,
          type: 'fetch',  // fetch/mtop/jsonp/custom
          options: {
            uri: 'mock/info.json',
            method: 'GET',
            params: { a: 1 },
            timeout: 5000,
          },
        }, 
        {
          id: 'postInfo',
          isInit: false,
          type: 'fetch',
          options: {
            uri: 'mock/info.json',
            method: 'POST',
            params: { a: 1 },
            timeout: 5000,
          },
        }, 
        {
          id: 'getInfoLater',
          isInit: false,
          type: 'fetch',
          options: {
            uri: 'mock/info.json',
            method: 'POST',
            params: { a: 1 },
            timeout: 5000,
          },
        },
        {
          id: 'getInfoLater2',
          isInit: 'not a valid boolean',
          type: 'fetch',
          options: {
            uri: 'mock/info.json',
            method: 'POST',
            params: { a: 1 },
            timeout: 5000,
          },
        },
      ],
    };

    const dataHelper = new DataHelper(mockHost, mockDataSourceConfig, mockAppHelper, mockParser);
    expect(dataHelper.getInitDataSourseConfigs().length).toBe(1);
    expect(dataHelper.getInitDataSourseConfigs()[0].id).toBe('getInfo');
  });
  it('util function doRequest should work', () => {
    doRequest('jsonp', {
      uri: 'https://www.baidu.com',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockJsonp).toBeCalled();

    // test GET
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'get',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockGet).toBeCalled();

    mockGet.mockClear();
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'Get',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockGet).toBeCalled();

    mockGet.mockClear();
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'GET',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockGet).toBeCalled();

    mockGet.mockClear();

    // test POST
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'post',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockPost).toBeCalled();
    mockPost.mockClear();

    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'POST',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockPost).toBeCalled();
    mockPost.mockClear();
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'Post',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockPost).toBeCalled();
    mockPost.mockClear();

    // test default
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      method: 'whatever',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockRequest).toBeCalled();
    mockRequest.mockClear();
    mockGet.mockClear();
    
    // method will be GET when not provided
    doRequest('fetch', {
      uri: 'https://www.baidu.com',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockRequest).toBeCalledTimes(0);
    expect(mockGet).toBeCalledTimes(1);

    mockRequest.mockClear();
    mockGet.mockClear();
    mockPost.mockClear();
    mockJsonp.mockClear();

    doRequest('someOtherType', {
      uri: 'https://www.baidu.com',
      params: { a: 1 },
      otherStuff1: 'aaa',
    });
    expect(mockRequest).toBeCalledTimes(0);
    expect(mockGet).toBeCalledTimes(0);
    expect(mockPost).toBeCalledTimes(0);
    expect(mockJsonp).toBeCalledTimes(0);
  });
});
