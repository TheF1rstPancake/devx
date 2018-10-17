const axios = require('axios');
const database = require('./database');
const RateLimiter = require('limiter').RateLimiter;

// stack's limit is 30 requests per second
// we will limit to 29 just to be safe
const limiter = new RateLimiter(29, 'second');

const config = { base_uri: 'https://api.stackexchange.com', api_version: '2.2' };

const request = axios.create({
  baseURL: `${ config.base_uri }/${ config.api_version }`,
  timeout: 5000,
});

const search = async function(query, params) {
  params.page = params.page === undefined ? 1 : params.page;
  params.pagesize = params.pagesize === undefined ? 100 : params.pagesize;
  
  //let params = { q: query, site: 'stackoverflow', pagesize: 100, sort: 'relevance', page: page };
  console.log('Requesting /search/advanced', params);
  var can = limiter.tryRemoveTokens(1);
  while (!can) {
    can = limiter.tryRemoveTokens(1);
  } 
  var d = await request.get('/search/advanced', { params: params });
  return d.data;
};


module.exports  = {
  request: request,
  search: search
};

